create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar_url text,
  wallet_address text,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 1 and 20),
  constraint profiles_avatar_url_https check (avatar_url is null or avatar_url ~ '^https://'),
  constraint profiles_wallet_address_format check (
    wallet_address is null or wallet_address ~ '^0x[0-9a-fA-F]{40}$'
  )
);

create unique index profiles_wallet_address_key
  on public.profiles (wallet_address)
  where wallet_address is not null;

create table public.wallet_secrets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wallet_address text not null unique,
  encrypted_private_key text not null,
  created_at timestamptz not null default now(),
  constraint wallet_secrets_address_format check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  constraint wallet_secrets_payload_length check (char_length(encrypted_private_key) between 16 and 2000)
);

comment on table public.wallet_secrets is
  'Server-only encrypted custodial private keys. Clients have no privileges.';

alter table public.profiles enable row level security;
alter table public.wallet_secrets enable row level security;

revoke all on table public.wallet_secrets from public, anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;
grant all on table public.wallet_secrets to service_role;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.protect_profile_wallet()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot be changed';
  end if;

  if new.wallet_address is distinct from old.wallet_address then
    if old.wallet_address is not null then
      raise exception 'wallet address cannot be changed';
    end if;

    if coalesce(auth.role(), '') is distinct from 'service_role'
      and coalesce(current_setting('app.wallet_write', true), '') is distinct from 'on' then
      raise exception 'wallet address can only be set by the server';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_wallet
  before update on public.profiles
  for each row
  execute function public.protect_profile_wallet();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_nickname text;
begin
  next_nickname := left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'player'), 20);

  insert into public.profiles (id, nickname)
  values (new.id, next_nickname)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.store_custodial_wallet(
  target_user uuid,
  address text,
  encrypted_key text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not allowed';
  end if;

  perform set_config('app.wallet_write', 'on', true);

  if target_user is null or address !~ '^0x[0-9a-fA-F]{40}$' then
    raise exception 'invalid wallet';
  end if;

  if encrypted_key is null or char_length(encrypted_key) < 16 or char_length(encrypted_key) > 2000 then
    raise exception 'invalid key payload';
  end if;

  insert into public.profiles (id, nickname)
  values (target_user, 'player')
  on conflict (id) do nothing;

  select wallet_address
  into stored
  from public.profiles
  where id = target_user
  for update;

  if stored is not null then
    return stored;
  end if;

  insert into public.wallet_secrets (user_id, wallet_address, encrypted_private_key)
  values (target_user, address, encrypted_key);

  update public.profiles
  set wallet_address = address
  where id = target_user
    and wallet_address is null;

  return address;
exception
  when unique_violation then
    select wallet_address
    into stored
    from public.wallet_secrets
    where user_id = target_user;

    if stored is null then
      raise;
    end if;

    update public.profiles
    set wallet_address = stored
    where id = target_user
      and wallet_address is null;

    return stored;
end;
$$;

revoke all on function public.store_custodial_wallet(uuid, text, text) from public, anon, authenticated;
grant execute on function public.store_custodial_wallet(uuid, text, text) to service_role;
