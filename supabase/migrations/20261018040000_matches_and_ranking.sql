-- Match token transfers and a server-built ranking snapshot.
-- The browser cannot insert a match, choose a wallet, or read wallet secrets.

create table public.matches (
  id uuid primary key,
  winner_id uuid not null references auth.users (id) on delete cascade,
  loser_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(20, 6) not null,
  status text not null,
  tx_hash text,
  played_at timestamptz not null,
  attempt_id uuid not null,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_distinct_players check (winner_id <> loser_id),
  constraint matches_amount_range check (amount > 0 and amount <= 100 and amount = round(amount, 6)),
  constraint matches_status_check check (status in ('pending', 'confirming', 'completed', 'failed')),
  constraint matches_tx_hash_check check (
    tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$'
  ),
  constraint matches_completed_has_tx check (
    status <> 'completed' or tx_hash is not null
  )
);

create index matches_winner_idx on public.matches (winner_id, created_at desc);
create index matches_loser_idx on public.matches (loser_id, created_at desc);
create unique index matches_tx_hash_key on public.matches (tx_hash) where tx_hash is not null;

create table public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.ranking_entries (
  snapshot_id uuid not null references public.ranking_snapshots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null,
  balance_wei numeric(78, 0) not null,
  rank integer not null,
  primary key (snapshot_id, user_id),
  unique (snapshot_id, rank),
  constraint ranking_entries_balance_check check (balance_wei >= 0),
  constraint ranking_entries_rank_check check (rank > 0)
);

alter table public.matches enable row level security;
alter table public.ranking_snapshots enable row level security;
alter table public.ranking_entries enable row level security;

create policy "Participants read their matches"
on public.matches
for select
to authenticated
using (winner_id = (select auth.uid()) or loser_id = (select auth.uid()));

revoke all on table public.matches from public, anon;
revoke insert, update, delete on table public.matches from authenticated;
grant select on table public.matches to authenticated;
grant all on table public.matches to service_role;

revoke all on table public.ranking_snapshots from public, anon, authenticated;
revoke all on table public.ranking_entries from public, anon, authenticated;
grant all on table public.ranking_snapshots to service_role;
grant all on table public.ranking_entries to service_role;

create or replace function public.begin_match_transfer(
  p_match_id uuid,
  p_winner_id uuid,
  p_loser_id uuid,
  p_amount numeric,
  p_played_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.matches%rowtype;
  attempt uuid;
  winner_wallet text;
  loser_wallet text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_match_id is null or p_winner_id is null or p_loser_id is null or p_played_at is null then
    raise exception 'invalid_match';
  end if;

  if p_winner_id = p_loser_id or p_amount is null or p_amount <= 0 or p_amount > 100 or p_amount <> round(p_amount, 6) then
    raise exception 'invalid_match';
  end if;

  select wallet_address into winner_wallet from public.profiles where id = p_winner_id;
  select wallet_address into loser_wallet from public.profiles where id = p_loser_id;

  if winner_wallet is null or loser_wallet is null then
    raise exception 'missing_wallet';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  select * into existing from public.matches where id = p_match_id for update;

  if not found then
    attempt := gen_random_uuid();

    insert into public.matches (
      id, winner_id, loser_id, amount, status, played_at, attempt_id, locked_until
    ) values (
      p_match_id, p_winner_id, p_loser_id, p_amount, 'pending', p_played_at,
      attempt, now() + interval '2 minutes'
    );

    return jsonb_build_object(
      'action', 'transfer',
      'match_id', p_match_id,
      'attempt_id', attempt,
      'amount', p_amount::text,
      'winner_wallet', winner_wallet,
      'loser_wallet', loser_wallet,
      'tx_hash', null
    );
  end if;

  if existing.winner_id <> p_winner_id
    or existing.loser_id <> p_loser_id
    or existing.amount <> p_amount
    or existing.played_at <> p_played_at then
    raise exception 'match_conflict';
  end if;

  if existing.status = 'completed' and existing.tx_hash is not null then
    return jsonb_build_object(
      'action', 'done',
      'match_id', existing.id,
      'attempt_id', existing.attempt_id,
      'amount', existing.amount::text,
      'winner_wallet', winner_wallet,
      'loser_wallet', loser_wallet,
      'tx_hash', existing.tx_hash
    );
  end if;

  if existing.status = 'confirming' and existing.tx_hash is not null then
    return jsonb_build_object(
      'action', 'reconcile',
      'match_id', existing.id,
      'attempt_id', existing.attempt_id,
      'amount', existing.amount::text,
      'winner_wallet', winner_wallet,
      'loser_wallet', loser_wallet,
      'tx_hash', existing.tx_hash
    );
  end if;

  if existing.status = 'pending'
    and existing.locked_until is not null
    and existing.locked_until > now()
    and existing.tx_hash is null then
    return jsonb_build_object(
      'action', 'wait',
      'match_id', existing.id,
      'attempt_id', existing.attempt_id,
      'amount', existing.amount::text,
      'winner_wallet', winner_wallet,
      'loser_wallet', loser_wallet,
      'tx_hash', null
    );
  end if;

  attempt := gen_random_uuid();

  update public.matches
  set status = 'pending',
      attempt_id = attempt,
      tx_hash = null,
      locked_until = now() + interval '2 minutes',
      updated_at = now()
  where id = existing.id;

  return jsonb_build_object(
    'action', 'transfer',
    'match_id', existing.id,
    'attempt_id', attempt,
    'amount', trim(to_char(existing.amount, 'FM999999990.999999')),
    'winner_wallet', winner_wallet,
    'loser_wallet', loser_wallet,
    'tx_hash', null
  );
end;
$$;

create or replace function public.attach_match_tx(
  p_match_id uuid,
  p_attempt_id uuid,
  p_tx_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' then
    raise exception 'invalid_tx';
  end if;

  update public.matches
  set tx_hash = p_tx_hash,
      status = 'confirming',
      locked_until = now() + interval '5 minutes',
      updated_at = now()
  where id = p_match_id
    and attempt_id = p_attempt_id
    and status in ('pending', 'confirming');

  if not found then
    raise exception 'attempt_mismatch';
  end if;
end;
$$;

create or replace function public.finish_match_transfer(
  p_match_id uuid,
  p_attempt_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if p_status not in ('completed', 'failed') then
    raise exception 'invalid_status';
  end if;

  update public.matches
  set status = p_status,
      locked_until = null,
      updated_at = now()
  where id = p_match_id
    and attempt_id = p_attempt_id
    and (
      (p_status = 'completed' and tx_hash is not null)
      or (p_status = 'failed' and status in ('pending', 'confirming', 'failed'))
    );

  if not found then
    raise exception 'attempt_mismatch';
  end if;
end;
$$;

create or replace function public.replace_ranking_snapshot(p_entries jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot uuid;
  entry jsonb;
  seen int := 0;
  expected int;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'invalid_ranking';
  end if;

  snapshot := gen_random_uuid();
  insert into public.ranking_snapshots (id) values (snapshot);

  for entry in select value from jsonb_array_elements(p_entries)
  loop
    seen := seen + 1;

    if (entry->>'user_id') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(entry->>'nickname', '') = ''
      or (entry->>'balance_wei') !~ '^[0-9]+$'
      or (entry->>'rank') !~ '^[0-9]+$'
      or (entry->>'rank')::int <> seen then
      raise exception 'invalid_ranking';
    end if;

    insert into public.ranking_entries (snapshot_id, user_id, nickname, balance_wei, rank)
    values (
      snapshot,
      (entry->>'user_id')::uuid,
      entry->>'nickname',
      (entry->>'balance_wei')::numeric,
      seen
    );
  end loop;

  expected := jsonb_array_length(p_entries);

  if seen <> expected then
    raise exception 'invalid_ranking';
  end if;

  delete from public.ranking_snapshots where id <> snapshot;
  return snapshot;
end;
$$;

create or replace function public.list_ranking_page(
  p_after_rank integer,
  p_page_size integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  snapshot public.ranking_snapshots%rowtype;
  page_rows jsonb;
  extra int;
  mine_rank integer;
  mine_balance text;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  if p_after_rank is null or p_after_rank < 0 or p_page_size is distinct from 20 then
    raise exception 'invalid_page';
  end if;

  select * into snapshot from public.ranking_snapshots order by created_at desc limit 1;

  if not found then
    return jsonb_build_object(
      'snapshotId', null,
      'createdAt', null,
      'myRank', null,
      'myBalanceWei', null,
      'hasMore', false,
      'entries', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(page) order by page.rank), '[]'::jsonb)
  into page_rows
  from (
    select
      user_id as "userId",
      nickname,
      balance_wei::text as "balanceWei",
      rank
    from public.ranking_entries
    where snapshot_id = snapshot.id
      and rank > p_after_rank
    order by rank asc
    limit 20
  ) page;

  select count(*) into extra
  from public.ranking_entries
  where snapshot_id = snapshot.id
    and rank > p_after_rank + 20;

  select rank, balance_wei::text
  into mine_rank, mine_balance
  from public.ranking_entries
  where snapshot_id = snapshot.id
    and user_id = auth.uid();

  return jsonb_build_object(
    'snapshotId', snapshot.id,
    'createdAt', snapshot.created_at,
    'myRank', mine_rank,
    'myBalanceWei', mine_balance,
    'hasMore', extra > 0,
    'entries', page_rows
  );
end;
$$;

create or replace function public.list_match_opponents()
returns table (id uuid, nickname text)
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id, profiles.nickname
  from public.profiles
  where auth.uid() is not null
    and profiles.id <> auth.uid()
    and profiles.wallet_address is not null
  order by profiles.nickname asc, profiles.id asc
  limit 200;
$$;

revoke all on function public.begin_match_transfer(uuid, uuid, uuid, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.attach_match_tx(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_match_transfer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.replace_ranking_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.list_ranking_page(integer, integer) from public, anon;
revoke all on function public.list_match_opponents() from public, anon;

grant execute on function public.begin_match_transfer(uuid, uuid, uuid, numeric, timestamptz) to service_role;
grant execute on function public.attach_match_tx(uuid, uuid, text) to service_role;
grant execute on function public.finish_match_transfer(uuid, uuid, text) to service_role;
grant execute on function public.replace_ranking_snapshot(jsonb) to service_role;
grant execute on function public.list_ranking_page(integer, integer) to authenticated, service_role;
grant execute on function public.list_match_opponents() to authenticated, service_role;
