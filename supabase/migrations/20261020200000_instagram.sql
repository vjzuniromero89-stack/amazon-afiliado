-- Instagram: the connected professional account, a video per product and
-- one Reel per product (the chain: first Pin out -> Reel).
create table if not exists public.instagram_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ig_user_id text not null,
  username text not null default '',
  access_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.instagram_connections enable row level security;
revoke all on public.instagram_connections from anon, authenticated;
grant all on public.instagram_connections to service_role;

alter table public.products add column if not exists video_path text;

create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','published','failed')),
  scheduled_at timestamptz not null default now(),
  container_id text,
  media_id text,
  permalink text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create unique index if not exists instagram_posts_one_per_product on public.instagram_posts (user_id, product_id);
alter table public.instagram_posts enable row level security;
revoke all on public.instagram_posts from anon, authenticated;
grant all on public.instagram_posts to service_role;
grant select on public.instagram_posts to authenticated;
drop policy if exists owner_read on public.instagram_posts;
create policy owner_read on public.instagram_posts for select to authenticated using ((select auth.uid()) = user_id);

-- Private bucket; Instagram gets a 2-hour signed link to each video.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-videos', 'product-videos', false, 104857600, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;
