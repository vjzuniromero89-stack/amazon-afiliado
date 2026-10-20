-- Facebook Page: the connected Page, a Reel per product (same video as
-- Instagram) and a daily link post to the product page on ivethskin.com.
create table if not exists public.facebook_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  page_id text not null,
  page_name text not null default '',
  access_token text not null,
  auto_posts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.facebook_connections enable row level security;
revoke all on public.facebook_connections from anon, authenticated;
grant all on public.facebook_connections to service_role;

create table if not exists public.facebook_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null default 'reel' check (kind in ('reel', 'link')),
  status text not null default 'pending' check (status in ('pending','processing','published','failed')),
  scheduled_at timestamptz not null default now(),
  video_id text,
  post_id text,
  permalink text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create unique index if not exists facebook_posts_one_reel_per_product
  on public.facebook_posts (user_id, product_id) where kind = 'reel';
create index if not exists facebook_posts_user_time on public.facebook_posts (user_id, scheduled_at);
alter table public.facebook_posts enable row level security;
revoke all on public.facebook_posts from anon, authenticated;
grant all on public.facebook_posts to service_role;
grant select on public.facebook_posts to authenticated;
drop policy if exists owner_read on public.facebook_posts;
create policy owner_read on public.facebook_posts for select to authenticated using ((select auth.uid()) = user_id);
