create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (
    username is null or char_length(username) between 3 and 32
  )
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'Other'
    check (category in ('Building', 'Road', 'Nature', 'Water', 'Infrastructure', 'Landmark', 'Agriculture', 'Other')),
  image_path text not null unique,
  latitude double precision,
  longitude double precision,
  location_name text not null default '',
  location_precision text not null default 'none'
    check (location_precision in ('exact', 'approximate', 'none')),
  visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  constraint photos_coordinates_pair check (
    (latitude is null and longitude is null)
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  ),
  constraint photos_location_precision check (
    (location_precision = 'none' and latitude is null and longitude is null)
    or (location_precision <> 'none' and latitude is not null and longitude is not null)
  )
);

create index if not exists photos_user_created_idx
  on public.photos (user_id, created_at desc);
create index if not exists photos_public_category_idx
  on public.photos (category, created_at desc)
  where visibility = 'public';
create index if not exists photos_coordinates_idx
  on public.photos (latitude, longitude)
  where latitude is not null and longitude is not null;

alter table public.profiles enable row level security;
alter table public.photos enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can read public photos and their own photos" on public.photos;
create policy "Users can read public photos and their own photos"
  on public.photos for select
  using (visibility = 'public' or (select auth.uid()) = user_id);

drop policy if exists "Users can create their own photos" on public.photos;
create policy "Users can create their own photos"
  on public.photos for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own photos" on public.photos;
create policy "Users can update their own photos"
  on public.photos for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own photos" on public.photos;
create policy "Users can delete their own photos"
  on public.photos for delete
  using ((select auth.uid()) = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own photos" on storage.objects;
create policy "Users can upload their own photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can read their own photos and public photos" on storage.objects;
create policy "Users can read their own photos and public photos"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.photos
        where photos.image_path = storage.objects.name
          and photos.visibility = 'public'
      )
    )
  );

drop policy if exists "Users can update their own stored photos" on storage.objects;
create policy "Users can update their own stored photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own stored photos" on storage.objects;
create policy "Users can delete their own stored photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.nearby_photos(
  center_latitude double precision,
  center_longitude double precision,
  radius_meters double precision
)
returns setof public.photos
language sql
stable
security invoker
set search_path = ''
as $$
  select photo.*
  from public.photos as photo
  where photo.latitude is not null
    and photo.longitude is not null
    and radius_meters between 0 and 100000
    and center_latitude between -90 and 90
    and center_longitude between -180 and 180
    and 6371000 * 2 * asin(
      sqrt(
        power(sin(radians(photo.latitude - center_latitude) / 2), 2)
        + cos(radians(center_latitude))
        * cos(radians(photo.latitude))
        * power(sin(radians(photo.longitude - center_longitude) / 2), 2)
      )
    ) <= radius_meters
  order by photo.created_at desc;
$$;

revoke all on function public.nearby_photos(double precision, double precision, double precision) from public;
grant execute on function public.nearby_photos(double precision, double precision, double precision) to authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.photos to authenticated;
grant select on public.photos to anon;
