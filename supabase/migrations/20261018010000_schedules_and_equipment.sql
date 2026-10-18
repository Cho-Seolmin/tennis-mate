create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  memo text,
  created_at timestamptz not null default now(),
  constraint schedules_title_length check (char_length(title) between 1 and 100),
  constraint schedules_time_order check (end_at > start_at),
  constraint schedules_location_length check (
    location is null or char_length(location) between 1 and 200
  ),
  constraint schedules_memo_length check (
    memo is null or char_length(memo) between 1 and 500
  )
);

create index schedules_user_start_idx on public.schedules (user_id, start_at);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  brand text not null,
  model text not null,
  created_at timestamptz not null default now(),
  constraint equipment_category_value check (category in ('racket', 'shoes', 'other')),
  constraint equipment_brand_length check (char_length(brand) between 1 and 50),
  constraint equipment_model_length check (char_length(model) between 1 and 50)
);

create index equipment_user_created_idx on public.equipment (user_id, created_at desc);

alter table public.schedules enable row level security;
alter table public.equipment enable row level security;

revoke all on table public.schedules from public, anon, authenticated;
revoke all on table public.equipment from public, anon, authenticated;
grant select, insert, update, delete on table public.schedules to authenticated;
grant select, insert, update, delete on table public.equipment to authenticated;
grant all on table public.schedules to service_role;
grant all on table public.equipment to service_role;

create policy schedules_select_own
  on public.schedules
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy schedules_insert_own
  on public.schedules
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy schedules_update_own
  on public.schedules
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy schedules_delete_own
  on public.schedules
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy equipment_select_own
  on public.equipment
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy equipment_insert_own
  on public.equipment
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy equipment_update_own
  on public.equipment
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy equipment_delete_own
  on public.equipment
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.prepare_schedule_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from old.user_id or old.user_id is distinct from auth.uid() then
    raise exception 'user_id cannot be changed';
  end if;

  new.title := btrim(new.title);
  new.location := nullif(btrim(coalesce(new.location, '')), '');
  new.memo := nullif(btrim(coalesce(new.memo, '')), '');
  return new;
end;
$$;

create trigger schedules_prepare_write
  before insert or update on public.schedules
  for each row
  execute function public.prepare_schedule_write();

create or replace function public.prepare_equipment_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from old.user_id or old.user_id is distinct from auth.uid() then
    raise exception 'user_id cannot be changed';
  end if;

  new.brand := btrim(new.brand);
  new.model := btrim(new.model);
  return new;
end;
$$;

create trigger equipment_prepare_write
  before insert or update on public.equipment
  for each row
  execute function public.prepare_equipment_write();

revoke all on function public.prepare_schedule_write() from public, anon;
revoke all on function public.prepare_equipment_write() from public, anon;
grant execute on function public.prepare_schedule_write() to authenticated, service_role;
grant execute on function public.prepare_equipment_write() to authenticated, service_role;
