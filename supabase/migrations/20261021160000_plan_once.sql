-- Found in the review of the duplicate-post protection (2026-10-21).
--
-- 1. One planned post per day. planPhotos and planLinks check "is there one
--    today?" and then insert. The cron lease keeps two cron runs apart, but
--    the panel's on/off switches also plan, outside the lease. Planned posts
--    always use the same time of day (photo 7 pm, carousel 6 pm, link 12 pm
--    New York), so two runs planning the same day insert the same row, and
--    this index refuses the second. Only rows from 2026-10-22 on, so a past
--    duplicate cannot stop the index from being created. The owner's
--    "carousel now" uses the current time and never collides.
create unique index if not exists instagram_posts_one_planned
  on public.instagram_posts (user_id, kind, scheduled_at)
  where kind in ('photo', 'carousel') and scheduled_at >= '2026-10-22 00:00:00+00';
create unique index if not exists facebook_posts_one_planned
  on public.facebook_posts (user_id, scheduled_at)
  where kind = 'link' and scheduled_at >= '2026-10-22 00:00:00+00';

-- 2. Uncertain posts go last and stop being re-checked after 8 tries.
--    A check that keeps failing (for example, a container Instagram no
--    longer finds) left the post uncertain forever, claimed first every 15
--    minutes, taking one of the 3 places from newer posts. After 8 tries it
--    waits for the owner ("Revisar en Instagram/Facebook" in the panel).
--    Everything else is the same as 20261021120000_social_post_claims.sql.
create or replace function public.claim_instagram_posts(p_user uuid, p_limit int default 3)
returns setof public.instagram_posts language plpgsql set search_path=public as $$
declare tok uuid := gen_random_uuid();
begin
  update instagram_posts
     set status = case when claimed_from = 'pending' then 'pending' else 'uncertain' end,
         error = case when claimed_from = 'pending' then 'The run stopped before publishing; it will retry.'
                      else 'The run stopped while publishing. Check Instagram before retrying.' end,
         claim_token = null
   where user_id = p_user and status = 'publishing' and claimed_at < now() - interval '10 minutes';
  return query
  update instagram_posts p
     set claimed_from = p.status, status = 'publishing', claim_token = tok, claimed_at = now()
   where p.id in (
     select id from instagram_posts
      where user_id = p_user
        and scheduled_at <= now()
        and (status in ('pending','processing')
             or (status = 'uncertain' and container_id is not null and attempts < 8
                 and coalesce(claimed_at, scheduled_at) < now() - interval '15 minutes'))
      order by (status = 'uncertain'), created_at
      for update skip locked
      limit p_limit)
  returning p.*;
end $$;

create or replace function public.claim_facebook_posts(p_user uuid, p_limit int default 3)
returns setof public.facebook_posts language plpgsql set search_path=public as $$
declare tok uuid := gen_random_uuid();
begin
  update facebook_posts
     set status = case when claimed_from = 'processing' then 'processing'
                       when claimed_from = 'pending' and kind = 'reel' and video_id is null then 'pending'
                       else 'uncertain' end,
         error = 'The run stopped while working on this post. It will be checked before any new attempt.',
         claim_token = null
   where user_id = p_user and status = 'publishing' and claimed_at < now() - interval '10 minutes';
  return query
  update facebook_posts p
     set claimed_from = p.status, status = 'publishing', claim_token = tok, claimed_at = now()
   where p.id in (
     select id from facebook_posts
      where user_id = p_user
        and scheduled_at <= now()
        and (status in ('pending','processing')
             or (status = 'uncertain' and kind = 'reel' and video_id is not null and attempts < 8
                 and coalesce(claimed_at, scheduled_at) < now() - interval '15 minutes'))
      order by (status = 'uncertain'), scheduled_at
      for update skip locked
      limit p_limit)
  returning p.*;
end $$;

revoke all on function public.claim_instagram_posts(uuid,int), public.claim_facebook_posts(uuid,int) from public, anon, authenticated;
grant execute on function public.claim_instagram_posts(uuid,int), public.claim_facebook_posts(uuid,int) to service_role;
