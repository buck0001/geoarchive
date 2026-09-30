create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_one_per_user_per_photo unique (photo_id, user_id)
);

create index if not exists reviews_photo_created_idx
  on public.reviews (photo_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "Anyone can read reviews on public places" on public.reviews;
create policy "Anyone can read reviews on public places"
  on public.reviews for select
  using (
    exists (
      select 1
      from public.photos
      where photos.id = reviews.photo_id
        and photos.visibility = 'public'
    )
  );

drop policy if exists "Users can review public places" on public.reviews;
create policy "Users can review public places"
  on public.reviews for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.photos
      where photos.id = reviews.photo_id
        and photos.visibility = 'public'
    )
  );

drop policy if exists "Users can edit their reviews on public places" on public.reviews;
create policy "Users can edit their reviews on public places"
  on public.reviews for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.photos
      where photos.id = reviews.photo_id
        and photos.visibility = 'public'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.photos
      where photos.id = reviews.photo_id
        and photos.visibility = 'public'
    )
  );

drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Users can delete their own reviews"
  on public.reviews for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.reviews to anon, authenticated;
grant insert, delete on public.reviews to authenticated;
grant update (body, updated_at) on public.reviews to authenticated;
