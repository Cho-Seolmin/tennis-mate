-- Host controls for chat rooms.
-- Any signed-in user can create and join. Only the host can delete a room or remove another member.
-- Capacity is 2 to 10. Existing larger rooms are capped so the new check can be applied.

update public.rooms
set max_participants = 10
where max_participants > 10;

alter table public.rooms drop constraint rooms_capacity;
alter table public.rooms
  add constraint rooms_capacity check (max_participants between 2 and 10);

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

  if p_max_participants is null or p_max_participants not between 2 and 10 then
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

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select host_id into host from public.rooms where id = p_room_id;

  if host is null then
    raise exception 'room_not_found';
  end if;

  if host = auth.uid() then
    raise exception 'host_must_delete';
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = auth.uid();

  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;

create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from public.rooms
  where id = p_room_id
    and host_id = auth.uid();

  if not found then
    raise exception 'not_host';
  end if;
end;
$$;

create or replace function public.kick_room_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select host_id
  into host
  from public.rooms
  where id = p_room_id
  for update;

  if host is null then
    raise exception 'room_not_found';
  end if;

  if host is distinct from auth.uid() then
    raise exception 'not_host';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot_kick_host';
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id;

  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;

revoke all on function public.delete_room(uuid) from public, anon;
revoke all on function public.kick_room_member(uuid, uuid) from public, anon;
grant execute on function public.delete_room(uuid) to authenticated, service_role;
grant execute on function public.kick_room_member(uuid, uuid) to authenticated, service_role;

alter table public.room_members replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'room_members'
    ) then
    alter publication supabase_realtime add table public.room_members;
  end if;
end $$;
