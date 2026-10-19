-- Boards missing from the connected Pinterest account (e.g. Sandbox boards
-- after moving to production) are kept for history but archived.
alter table public.boards add column if not exists archived boolean not null default false;
