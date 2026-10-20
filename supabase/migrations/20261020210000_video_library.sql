-- Video library ("Fotos" > "Videos"): every product video lives here; a
-- video can be assigned to one product (products.video_path points at it).
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,
  name text not null default '',
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists videos_user on public.videos (user_id);
alter table public.videos enable row level security;
revoke all on public.videos from anon, authenticated;
grant all on public.videos to service_role;
grant select on public.videos to authenticated;
drop policy if exists owner_read on public.videos;
create policy owner_read on public.videos for select to authenticated using ((select auth.uid()) = user_id);

-- Videos already uploaded from a product row join the library.
insert into public.videos (user_id, path, name, product_id)
select user_id, video_path, 'Video del producto', id from public.products where video_path is not null
on conflict (path) do nothing;
