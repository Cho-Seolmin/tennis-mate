create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reward_date date not null,
  amount numeric(78, 0) not null,
  tx_hash text,
  status text not null,
  attempt_id uuid not null,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_user_date_key unique (user_id, reward_date),
  constraint attendance_amount_value check (amount = 10),
  constraint attendance_status_value check (status in ('pending', 'confirming', 'completed', 'failed')),
  constraint attendance_tx_hash_format check (
    tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$'
  ),
  constraint attendance_completed_has_tx check (status <> 'completed' or tx_hash is not null)
);

create unique index attendance_tx_hash_key
  on public.attendance (tx_hash)
  where tx_hash is not null;

alter table public.attendance enable row level security;

revoke all on table public.attendance from public, anon, authenticated;
grant select on table public.attendance to authenticated;
grant all on table public.attendance to service_role;

create policy attendance_select_own
  on public.attendance
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.begin_attendance_claim(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (timezone('Asia/Seoul', now()))::date;
  existing public.attendance%rowtype;
  v_attempt uuid;
  v_reason text := 'new';
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not allowed';
  end if;

  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_date::text, 0));

  select *
  into existing
  from public.attendance
  where user_id = p_user_id
    and reward_date = v_date
  for update;

  if not found then
    v_attempt := gen_random_uuid();

    insert into public.attendance (
      user_id,
      reward_date,
      amount,
      status,
      attempt_id,
      locked_until
    )
    values (
      p_user_id,
      v_date,
      10,
      'pending',
      v_attempt,
      now() + interval '3 minutes'
    )
    returning * into existing;

    return jsonb_build_object(
      'action', 'mint',
      'reason', v_reason,
      'id', existing.id,
      'attempt_id', existing.attempt_id,
      'tx_hash', existing.tx_hash,
      'status', existing.status,
      'reward_date', existing.reward_date
    );
  end if;

  if existing.status = 'completed' then
    return jsonb_build_object(
      'action', 'done',
      'reason', 'completed',
      'id', existing.id,
      'attempt_id', existing.attempt_id,
      'tx_hash', existing.tx_hash,
      'status', existing.status,
      'reward_date', existing.reward_date
    );
  end if;

  if existing.status = 'failed' then
    v_reason := 'retry';
  elsif existing.tx_hash is not null and existing.status in ('pending', 'confirming') then
    return jsonb_build_object(
      'action', 'reconcile',
      'reason', 'confirming',
      'id', existing.id,
      'attempt_id', existing.attempt_id,
      'tx_hash', existing.tx_hash,
      'status', existing.status,
      'reward_date', existing.reward_date
    );
  elsif existing.locked_until is not null and existing.locked_until > now() then
    return jsonb_build_object(
      'action', 'wait',
      'reason', 'locked',
      'id', existing.id,
      'attempt_id', existing.attempt_id,
      'tx_hash', existing.tx_hash,
      'status', existing.status,
      'reward_date', existing.reward_date
    );
  else
    v_reason := 'retry';
  end if;

  v_attempt := gen_random_uuid();

  update public.attendance
  set status = 'pending',
      attempt_id = v_attempt,
      tx_hash = null,
      locked_until = now() + interval '3 minutes',
      updated_at = now()
  where id = existing.id
  returning * into existing;

  return jsonb_build_object(
    'action', 'mint',
    'reason', v_reason,
    'id', existing.id,
    'attempt_id', existing.attempt_id,
    'tx_hash', existing.tx_hash,
    'status', existing.status,
    'reward_date', existing.reward_date
  );
end;
$$;

create or replace function public.attach_attendance_tx(
  p_id uuid,
  p_attempt uuid,
  p_tx_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not allowed';
  end if;

  if p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' then
    raise exception 'invalid_tx_hash';
  end if;

  update public.attendance
  set tx_hash = p_tx_hash,
      status = 'confirming',
      locked_until = now() + interval '10 minutes',
      updated_at = now()
  where id = p_id
    and attempt_id = p_attempt
    and status = 'pending';

  if not found then
    raise exception 'attendance_conflict';
  end if;
end;
$$;

create or replace function public.finish_attendance(
  p_id uuid,
  p_attempt uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not allowed';
  end if;

  if p_status is distinct from 'completed' and p_status is distinct from 'failed' then
    raise exception 'invalid_status';
  end if;

  update public.attendance
  set status = p_status,
      locked_until = null,
      updated_at = now()
  where id = p_id
    and attempt_id = p_attempt
    and status in ('pending', 'confirming')
    and (p_status <> 'completed' or tx_hash is not null);

  if not found then
    raise exception 'attendance_conflict';
  end if;
end;
$$;

revoke all on function public.begin_attendance_claim(uuid) from public, anon, authenticated;
revoke all on function public.attach_attendance_tx(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_attendance(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.begin_attendance_claim(uuid) to service_role;
grant execute on function public.attach_attendance_tx(uuid, uuid, text) to service_role;
grant execute on function public.finish_attendance(uuid, uuid, text) to service_role;
