-- Analytics audit (2026-10-23, diagnosis A2).
--
-- 1. The account's own daily totals from GET /v5/user_account/analytics.
--    The app measured only the Pins it published (25), while the account
--    also has Pins uploaded straight on Pinterest (37 on 2026-10-07), so its
--    numbers looked lower than Pinterest's. Only consolidated days (READY or
--    ESTIMATE) are stored: PROCESSING days come with zeros that are not data.
create table if not exists public.account_analytics (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  impressions bigint check (impressions >= 0),
  outbound_clicks bigint check (outbound_clicks >= 0),
  saves bigint check (saves >= 0),
  engagements bigint check (engagements >= 0),
  pin_clicks bigint check (pin_clicks >= 0),
  fetched_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.account_analytics enable row level security;
revoke all on public.account_analytics from anon, authenticated;
grant select on public.account_analytics to authenticated;
grant all on public.account_analytics to service_role;
drop policy if exists owner_read on public.account_analytics;
create policy owner_read on public.account_analytics for select to authenticated
  using ((select auth.uid()) = user_id);

-- 2. A Pin's history outlives its product. Deleting a product used to delete
--    its publications and their metrics while the Pins stayed live on
--    Pinterest. Publications now keep the product's name and no longer
--    depend on the product, its Pin designs or its queue rows.
alter table public.publications add column if not exists product_title text;
update public.publications p
   set product_title = pr.title
  from public.products pr
 where pr.id = p.product_id and p.product_title is null;
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.publications'::regclass and contype = 'f'
       and confrelid in ('public.publication_queue'::regclass, 'public.creatives'::regclass, 'public.products'::regclass)
  loop
    execute format('alter table public.publications drop constraint %I', c);
  end loop;
end $$;
