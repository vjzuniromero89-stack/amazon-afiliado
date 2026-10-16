-- "Fotos" library: reusable photos, stored in the product-images bucket.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists photos_user_created on public.photos (user_id, created_at desc);
alter table public.photos enable row level security;
drop policy if exists owner_read on public.photos;
create policy owner_read on public.photos for select to authenticated
  using ((select auth.uid()) = user_id);
