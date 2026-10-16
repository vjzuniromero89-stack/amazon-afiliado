-- Categories for the "Fotos" library.
alter table public.photos add column if not exists category text not null default '';
create index if not exists photos_user_category on public.photos (user_id, category);
