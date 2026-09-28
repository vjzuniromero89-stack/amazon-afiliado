-- Product photos: stored privately in Supabase Storage, only the server (service role) reads/writes them.
alter table public.products
  add column if not exists images text[] not null default '{}';
alter table public.products
  add constraint products_images_max check (cardinality(images) <= 5);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg','image/png'])
on conflict (id) do nothing;
