-- Products can come from Amazon, Target or Walmart. Amazon keeps its ASIN;
-- Target and Walmart store T/W + their product number and the ready-made
-- affiliate link from Impact in url.
alter table public.products add column if not exists store text not null default 'amazon';
alter table public.products drop constraint if exists products_store_check;
alter table public.products add constraint products_store_check
  check (store in ('amazon', 'target', 'walmart'));
alter table public.products drop constraint if exists products_asin_check;
alter table public.products add constraint products_asin_check check (
  (store = 'amazon' and asin ~ '^[A-Z0-9]{10}$')
  or (store <> 'amazon' and asin ~ '^[TW][0-9]{5,15}$')
);
