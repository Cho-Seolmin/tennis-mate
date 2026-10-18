create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  location text not null,
  scheduled_at timestamptz not null,
  max_participants integer not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint rooms_title_length check (char_length(title) between 1 and 100),
  constraint rooms_location_length check (char_length(location) between 1 and 200),
  constraint rooms_capacity check (max_participants between 2 and 30),
  constraint rooms_status_value check (status in ('open', 'closed'))
);

create index rooms_scheduled_idx on public.rooms (scheduled_at);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_length check (char_length(content) between 1 and 500)
);

create index chat_messages_room_cursor_idx
  on public.chat_messages (room_id, created_at desc, id desc);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.rooms from public, anon, authenticated;
revoke all on table public.room_members from public, anon, authenticated;
revoke all on table public.chat_messages from public, anon, authenticated;

grant select on table public.rooms to authenticated;
grant select on table public.room_members to authenticated;
grant select, insert on table public.chat_messages to authenticated;
grant all on table public.rooms to service_role;
grant all on table public.room_members to service_role;
grant all on table public.chat_messages to service_role;

create policy rooms_select_authenticated
  on public.rooms
  for select
  to authenticated
  using (true);

create policy room_members_select_authenticated
  on public.room_members
  for select
  to authenticated
  using (true);

create policy chat_messages_select_member
  on public.chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_members
      where room_members.room_id = chat_messages.room_id
        and room_members.user_id = (select auth.uid())
    )
  );

create policy chat_messages_insert_member
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.room_members
      where room_members.room_id = chat_messages.room_id
        and room_members.user_id = (select auth.uid())
    )
  );

create or replace function public.prepare_chat_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  new.sender_id := auth.uid();
  new.content := btrim(new.content);
  return new;
end;
$$;

create trigger chat_messages_prepare_write
  before insert on public.chat_messages
  for each row
  execute function public.prepare_chat_message();

create or replace function public.create_room(
  p_title text,
  p_location text,
  p_scheduled_at timestamptz,
  p_max_participants integer
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.rooms%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  p_title := btrim(coalesce(p_title, ''));
  p_location := btrim(coalesce(p_location, ''));

  if char_length(p_title) not between 1 and 100 then
    raise exception 'invalid_title';
  end if;

  if char_length(p_location) not between 1 and 200 then
    raise exception 'invalid_location';
  end if;

  if p_scheduled_at is null then
    raise exception 'invalid_schedule';
  end if;

  if p_max_participants is null or p_max_participants not between 2 and 30 then
    raise exception 'invalid_capacity';
  end if;

  insert into public.rooms (host_id, title, location, scheduled_at, max_participants, status)
  values (auth.uid(), p_title, p_location, p_scheduled_at, p_max_participants, 'open')
  returning * into created;

  insert into public.room_members (room_id, user_id)
  values (created.id, auth.uid());

  return created;
end;
$$;

create or replace function public.join_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.rooms%rowtype;
  member_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select *
  into target
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  if target.status <> 'open' then
    raise exception 'room_closed';
  end if;

  if exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
  ) then
    raise exception 'already_joined';
  end if;

  select count(*)
  into member_count
  from public.room_members
  where room_id = p_room_id;

  if member_count >= target.max_participants then
    raise exception 'room_full';
  end if;

  insert into public.room_members (room_id, user_id)
  values (p_room_id, auth.uid());
exception
  when unique_violation then
    raise exception 'already_joined';
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = auth.uid();

  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;

create or replace function public.list_chat_messages(
  p_room_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  page_limit integer := 20;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_room_id is null then
    raise exception 'room_not_found';
  end if;

  if (p_before_created_at is null) is distinct from (p_before_id is null) then
    raise exception 'invalid_cursor';
  end if;

  if p_page_size is distinct from 20 then
    raise exception 'invalid_page_size';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
  ) then
    raise exception 'not_a_member';
  end if;

  with page as (
    select id, room_id, sender_id, content, created_at
    from public.chat_messages
    where room_id = p_room_id
      and (
        p_before_created_at is null
        or (created_at, id) < (p_before_created_at, p_before_id)
      )
    order by created_at desc, id desc
    limit page_limit + 1
  ),
  limited as (
    select *
    from page
    order by created_at desc, id desc
    limit page_limit
  )
  select jsonb_build_object(
    'has_more', (select count(*) from page) > page_limit,
    'messages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', limited.id,
            'room_id', limited.room_id,
            'sender_id', limited.sender_id,
            'content', limited.content,
            'created_at', limited.created_at
          )
          order by limited.created_at asc, limited.id asc
        )
        from limited
      ),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$$;

create or replace function public.profile_nicknames(p_user_ids uuid[])
returns table (id uuid, nickname text)
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id, profiles.nickname
  from public.profiles
  where profiles.id = any (coalesce(p_user_ids, array[]::uuid[]))
  limit 200;
$$;

revoke all on function public.prepare_chat_message() from public, anon;
revoke all on function public.create_room(text, text, timestamptz, integer) from public, anon;
revoke all on function public.join_room(uuid) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;
revoke all on function public.list_chat_messages(uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function public.profile_nicknames(uuid[]) from public, anon;

grant execute on function public.prepare_chat_message() to authenticated, service_role;
grant execute on function public.create_room(text, text, timestamptz, integer) to authenticated, service_role;
grant execute on function public.join_room(uuid) to authenticated, service_role;
grant execute on function public.leave_room(uuid) to authenticated, service_role;
grant execute on function public.list_chat_messages(uuid, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function public.profile_nicknames(uuid[]) to authenticated, service_role;

alter table public.chat_messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_messages'
    ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
