-- Taps on the store buttons of ivethskin.com: product, page, source site.
create table if not exists public.shop_clicks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  page text not null default '',
  source text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists shop_clicks_user_time on public.shop_clicks (user_id, created_at desc);
alter table public.shop_clicks enable row level security;
revoke all on public.shop_clicks from anon, authenticated;
grant all on public.shop_clicks to service_role;
grant select on public.shop_clicks to authenticated;
drop policy if exists owner_read on public.shop_clicks;
create policy owner_read on public.shop_clicks for select to authenticated using ((select auth.uid()) = user_id);
