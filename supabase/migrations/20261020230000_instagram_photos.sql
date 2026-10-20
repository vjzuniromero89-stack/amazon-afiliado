-- Instagram posts beyond Reels: a daily product photo and a Sunday carousel,
-- planned by the app. Reels stay one per product; photos may repeat a
-- product on another day.
alter table public.instagram_posts add column if not exists kind text not null default 'reel';
alter table public.instagram_posts drop constraint if exists instagram_posts_kind_check;
alter table public.instagram_posts add constraint instagram_posts_kind_check check (kind in ('reel', 'photo', 'carousel'));
alter table public.instagram_posts add column if not exists product_ids uuid[];
drop index if exists public.instagram_posts_one_per_product;
create unique index if not exists instagram_posts_one_reel_per_product
  on public.instagram_posts (user_id, product_id) where kind = 'reel';
create index if not exists instagram_posts_user_time on public.instagram_posts (user_id, scheduled_at);

-- The owner's switch for the automatic photos and carousels (on by default).
alter table public.instagram_connections add column if not exists auto_photos boolean not null default true;
