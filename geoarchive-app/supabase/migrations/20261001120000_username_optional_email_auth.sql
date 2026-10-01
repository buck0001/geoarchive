alter table public.profiles drop constraint if exists profiles_username_key;
drop index if exists public.profiles_username_key;

create temporary table _profile_username_migration as
select id, username, display_name
from public.profiles;

update public.profiles set username = null;

do $$
declare
  profile_row record;
  base_name text;
  candidate text;
  suffix_length integer;
  uuid_suffix text;
begin
  for profile_row in
    select * from _profile_username_migration order by id
  loop
    base_name := lower(trim(coalesce(profile_row.username, '')));
    if base_name !~ '^[a-z0-9_]{3,32}$' then
      base_name := trim(both '_' from regexp_replace(
        lower(coalesce(profile_row.display_name, '')),
        '[^a-z0-9]+',
        '_',
        'g'
      ));
    end if;
    if char_length(base_name) < 3 then base_name := 'user'; end if;

    candidate := left(base_name, 32);
    if exists (select 1 from public.profiles where lower(username) = candidate) then
      uuid_suffix := replace(profile_row.id::text, '-', '');
      suffix_length := 8;
      loop
        candidate := left(base_name, 31 - suffix_length) || '_' || left(uuid_suffix, suffix_length);
        exit when not exists (
          select 1 from public.profiles where lower(username) = candidate
        );
        if suffix_length >= 30 then
          raise exception 'Could not assign a unique username to profile %', profile_row.id;
        end if;
        suffix_length := suffix_length + 1;
      end loop;
    end if;

    update public.profiles set username = candidate where id = profile_row.id;
  end loop;
end;
$$;

alter table public.profiles alter column username set not null;
alter table public.profiles
  add constraint profiles_username_format
  check (username = lower(username) and username ~ '^[a-z0-9_]{3,32}$');
create unique index profiles_username_ci_idx on public.profiles (lower(username));

create table if not exists public.account_contacts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  updated_at timestamptz not null default now(),
  constraint account_contacts_email_length check (email is null or char_length(email) <= 320)
);

alter table public.account_contacts enable row level security;
revoke all on public.account_contacts from anon, public;
grant select, insert, update, delete on public.account_contacts to authenticated;
grant all on public.account_contacts to service_role;

drop policy if exists "Users can read their account contact" on public.account_contacts;
create policy "Users can read their account contact"
  on public.account_contacts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their account contact" on public.account_contacts;
create policy "Users can create their account contact"
  on public.account_contacts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their account contact" on public.account_contacts;
create policy "Users can update their account contact"
  on public.account_contacts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_username text;
begin
  profile_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if profile_username !~ '^[a-z0-9_]{3,32}$' then
    profile_username := 'user_' || left(replace(new.id::text, '-', ''), 27);
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    profile_username,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;

drop table _profile_username_migration;
