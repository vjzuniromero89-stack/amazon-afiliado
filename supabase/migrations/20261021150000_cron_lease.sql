-- One cron run at a time. The external scheduler (every 15 minutes) and
-- Vercel's daily cron can arrive at the same moment; the second run then
-- skips instead of planning the day's photo, carousel or link post again
-- next to the first run. Each run holds a lease that ends on its own, so a
-- run that dies never blocks the next ones for long.

create table if not exists public.cron_leases (
  name text primary key,
  holder uuid not null,
  expires_at timestamptz not null
);
alter table public.cron_leases enable row level security;
revoke all on public.cron_leases from anon, authenticated;
grant all on public.cron_leases to service_role;

-- True when this run got the lease: there was none, or the last one expired.
create or replace function public.acquire_cron_lease(p_name text, p_holder uuid, p_seconds int)
returns boolean language plpgsql set search_path=public as $$
begin
  insert into cron_leases(name, holder, expires_at)
  values (p_name, p_holder, now() + make_interval(secs => p_seconds))
  on conflict (name) do update
     set holder = excluded.holder, expires_at = excluded.expires_at
   where cron_leases.expires_at < now();
  return found;
end $$;

-- Ends the lease early, only for the run that holds it.
create or replace function public.release_cron_lease(p_name text, p_holder uuid)
returns void language sql set search_path=public as $$
  delete from cron_leases where name = p_name and holder = p_holder;
$$;

revoke all on function public.acquire_cron_lease(text,uuid,int), public.release_cron_lease(text,uuid) from public, anon, authenticated;
grant execute on function public.acquire_cron_lease(text,uuid,int), public.release_cron_lease(text,uuid) to service_role;
