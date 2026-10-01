create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  category text not null default 'Other'
    check (category in ('Building', 'Road', 'Nature', 'Water', 'Infrastructure', 'Landmark', 'Agriculture', 'Other')),
  latitude double precision,
  longitude double precision,
  location_name text not null default '',
  description text not null default '' check (char_length(description) <= 1000),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  constraint places_coordinates_pair check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  )
);

alter table public.places enable row level security;
grant select, insert, update, delete on public.places to authenticated;
grant select on public.places to anon;

drop policy if exists "Public places and owners can read places" on public.places;
create policy "Public places and owners can read places"
  on public.places for select
  using (visibility = 'public' or (select auth.uid()) = created_by);

drop policy if exists "Users can create their own places" on public.places;
create policy "Users can create their own places"
  on public.places for insert to authenticated
  with check ((select auth.uid()) = created_by);

drop policy if exists "Owners can update their places" on public.places;
create policy "Owners can update their places"
  on public.places for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint contributions_one_per_user_per_place unique (place_id, user_id)
);

create index if not exists contributions_user_created_idx
  on public.contributions (user_id, created_at desc);
alter table public.contributions enable row level security;
grant select on public.contributions to anon, authenticated;
grant insert on public.contributions to authenticated;

drop policy if exists "Public contributions and own contributions are readable" on public.contributions;
create policy "Public contributions and own contributions are readable"
  on public.contributions for select
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.places
      where places.id = contributions.place_id and places.visibility = 'public'
    )
  );

create or replace function public.attach_place_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.place_id is not null then
    insert into public.contributions (place_id, user_id)
    values (new.place_id, new.user_id)
    on conflict (place_id, user_id) do update
      set place_id = excluded.place_id
    returning id into new.contribution_id;
  end if;
  return new;
end;
$$;

create table if not exists public._photo_place_migration (
  photo_id uuid primary key,
  place_id uuid not null unique
);

insert into public._photo_place_migration (photo_id, place_id)
select id, gen_random_uuid()
from public.photos
on conflict (photo_id) do nothing;

insert into public.places (
  id, created_by, name, category, latitude, longitude, location_name, description, visibility, created_at
)
select mapping.place_id,
       photo.user_id,
       photo.title,
       photo.category,
       photo.latitude,
       photo.longitude,
       photo.location_name,
       '',
       photo.visibility,
       photo.created_at
from public.photos as photo
join public._photo_place_migration as mapping on mapping.photo_id = photo.id
on conflict (id) do nothing;

alter table public.photos add column if not exists place_id uuid;
alter table public.photos add column if not exists contribution_id uuid;
update public.photos as photo
set place_id = mapping.place_id
from public._photo_place_migration as mapping
where mapping.photo_id = photo.id and photo.place_id is null;
alter table public.photos
  add constraint photos_place_id_fkey foreign key (place_id) references public.places (id) on delete cascade;
alter table public.photos
  add constraint photos_contribution_id_fkey foreign key (contribution_id) references public.contributions (id) on delete set null;

insert into public.contributions (place_id, user_id)
select place_id, user_id from public.photos where place_id is not null
union
select mapping.place_id, review.user_id
from public.reviews as review
join public.photos as photo on photo.id = review.photo_id
join public._photo_place_migration as mapping on mapping.photo_id = photo.id
on conflict (place_id, user_id) do nothing;

update public.photos as photo
set contribution_id = contribution.id
from public.contributions as contribution
where contribution.place_id = photo.place_id
  and contribution.user_id = photo.user_id
  and photo.contribution_id is null;

alter table public.reviews add column if not exists place_id uuid;
alter table public.reviews add column if not exists contribution_id uuid;
update public.reviews as review
set place_id = photo.place_id
from public.photos as photo
where photo.id = review.photo_id and review.place_id is null;
update public.reviews as review
set contribution_id = contribution.id
from public.contributions as contribution
where contribution.place_id = review.place_id
  and contribution.user_id = review.user_id
  and review.contribution_id is null;

alter table public.reviews alter column photo_id drop not null;
alter table public.reviews alter column place_id set not null;
alter table public.reviews
  add constraint reviews_place_id_fkey foreign key (place_id) references public.places (id) on delete cascade;
alter table public.reviews
  add constraint reviews_contribution_id_fkey foreign key (contribution_id) references public.contributions (id) on delete set null;
alter table public.reviews drop constraint if exists reviews_one_per_user_per_photo;
alter table public.reviews add constraint reviews_one_per_user_per_place unique (place_id, user_id);

alter table public.photos alter column place_id set not null;
create index if not exists photos_place_created_idx on public.photos (place_id, created_at desc);
create index if not exists reviews_place_created_idx on public.reviews (place_id, created_at desc);

create or replace function public.place_has_no_contributions(place_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.photos where place_id = place_uuid)
     and not exists (select 1 from public.reviews where place_id = place_uuid);
$$;

revoke all on function public.place_has_no_contributions(uuid) from public;
grant execute on function public.place_has_no_contributions(uuid) to authenticated;

drop policy if exists "Owners can delete their unused places" on public.places;
create policy "Owners can delete their unused places"
  on public.places for delete to authenticated
  using ((select auth.uid()) = created_by and public.place_has_no_contributions(id));

drop trigger if exists photos_attach_contribution on public.photos;
create trigger photos_attach_contribution
  before insert or update of place_id, user_id on public.photos
  for each row execute function public.attach_place_contribution();

drop trigger if exists reviews_attach_contribution on public.reviews;
create trigger reviews_attach_contribution
  before insert or update of place_id, user_id on public.reviews
  for each row execute function public.attach_place_contribution();

drop policy if exists "Users can create their own photos" on public.photos;
create policy "Users can create their own photos"
  on public.photos for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.places
      where places.id = photos.place_id
        and (places.created_by = (select auth.uid()) or places.visibility = 'public')
    )
  );

drop policy if exists "Anyone can read reviews on public places" on public.reviews;
create policy "Anyone can read reviews on public places"
  on public.reviews for select
  using (
    exists (
      select 1 from public.places
      where places.id = reviews.place_id and places.visibility = 'public'
    )
    or (
      (select auth.uid()) = user_id
      and exists (
        select 1 from public.places
        where places.id = reviews.place_id and places.created_by = (select auth.uid())
      )
    )
  );

drop policy if exists "Users can review public places" on public.reviews;
create policy "Users can review public places"
  on public.reviews for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.places
      where places.id = reviews.place_id
        and (places.visibility = 'public' or places.created_by = (select auth.uid()))
    )
  );

drop policy if exists "Users can edit their reviews on public places" on public.reviews;
create policy "Users can edit their reviews on public places"
  on public.reviews for update
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.places
      where places.id = reviews.place_id
        and (places.visibility = 'public' or places.created_by = (select auth.uid()))
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.places
      where places.id = reviews.place_id
        and (places.visibility = 'public' or places.created_by = (select auth.uid()))
    )
  );

create or replace function public.nearby_places(
  center_latitude double precision,
  center_longitude double precision,
  radius_meters double precision
)
returns setof public.places
language sql
stable
security invoker
set search_path = ''
as $$
  select place.*
  from public.places as place
  where place.latitude is not null
    and place.longitude is not null
    and radius_meters between 0 and 100000
    and center_latitude between -90 and 90
    and center_longitude between -180 and 180
    and (place.visibility = 'public' or place.created_by = (select auth.uid()))
    and 6371000 * 2 * asin(
      sqrt(
        power(sin(radians(place.latitude - center_latitude) / 2), 2)
        + cos(radians(center_latitude))
        * cos(radians(place.latitude))
        * power(sin(radians(place.longitude - center_longitude) / 2), 2)
      )
    ) <= radius_meters
  order by place.created_at desc;
$$;

revoke all on function public.nearby_places(double precision, double precision, double precision) from public;
grant execute on function public.nearby_places(double precision, double precision, double precision) to anon, authenticated;

drop table public._photo_place_migration;
