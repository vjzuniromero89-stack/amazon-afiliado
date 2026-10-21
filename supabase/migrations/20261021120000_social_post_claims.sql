-- Instagram and Facebook posts are reserved by one cron run at a time, like
-- Pinterest's claim_pin. Two runs that overlap (the external scheduler and
-- Vercel's daily cron, or a second project) can never both publish a post.
--
-- New states:
--   publishing : a run holds the post (claim_token) and is calling the network.
--   uncertain  : a call that publishes failed in a way that may have
--                published anyway (timeout, 5xx, a run that died). It is
--                never sent again blindly: it is checked first, or left for
--                the owner to review.

alter table public.instagram_posts drop constraint if exists instagram_posts_status_check;
alter table public.instagram_posts add constraint instagram_posts_status_check
  check (status in ('pending','processing','publishing','published','failed','uncertain'));
alter table public.instagram_posts add column if not exists claim_token uuid;
alter table public.instagram_posts add column if not exists claimed_at timestamptz;
alter table public.instagram_posts add column if not exists claimed_from text;

alter table public.facebook_posts drop constraint if exists facebook_posts_status_check;
alter table public.facebook_posts add constraint facebook_posts_status_check
  check (status in ('pending','processing','publishing','published','failed','uncertain'));
alter table public.facebook_posts add column if not exists claim_token uuid;
alter table public.facebook_posts add column if not exists claimed_at timestamptz;
alter table public.facebook_posts add column if not exists claimed_from text;

-- Due Instagram posts for one run. A post a dead run left in 'publishing'
-- for 10 minutes becomes 'uncertain' (never re-sent). An 'uncertain' post
-- that has a container is re-checked at most every 15 minutes: Instagram
-- says whether that container was published.
create or replace function public.claim_instagram_posts(p_user uuid, p_limit int default 3)
returns setof public.instagram_posts language plpgsql set search_path=public as $$
declare tok uuid := gen_random_uuid();
begin
  -- Only media_publish is public: a run that died while creating the
  -- container (claimed from 'pending') published nothing and simply retries.
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
             or (status = 'uncertain' and container_id is not null
                 and coalesce(claimed_at, scheduled_at) < now() - interval '15 minutes'))
      order by created_at
      for update skip locked
      limit p_limit)
  returning p.*;
end $$;

-- Same for Facebook. An 'uncertain' Reel has its video_id and is re-checked;
-- an 'uncertain' link post has nothing to check and waits for the owner.
create or replace function public.claim_facebook_posts(p_user uuid, p_limit int default 3)
returns setof public.facebook_posts language plpgsql set search_path=public as $$
declare tok uuid := gen_random_uuid();
begin
  -- A Reel without a video id never reached the call that publishes, and a
  -- Reel that was only being checked ('processing') published nothing new:
  -- both go back. A link post or a Reel that may have sent "finish" becomes
  -- 'uncertain' (a Reel is re-checked by its video id).
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
             or (status = 'uncertain' and kind = 'reel' and video_id is not null
                 and coalesce(claimed_at, scheduled_at) < now() - interval '15 minutes'))
      order by scheduled_at
      for update skip locked
      limit p_limit)
  returning p.*;
end $$;

revoke all on function public.claim_instagram_posts(uuid,int), public.claim_facebook_posts(uuid,int) from public, anon, authenticated;
grant execute on function public.claim_instagram_posts(uuid,int), public.claim_facebook_posts(uuid,int) to service_role;
