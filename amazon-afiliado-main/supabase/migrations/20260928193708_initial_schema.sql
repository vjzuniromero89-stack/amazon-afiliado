-- Application writes go through authenticated server routes. The browser has
-- owner-scoped SELECT only; tokens, OAuth state and worker RPCs are service-only.
create table public.products (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 asin text not null check (asin ~ '^[A-Z0-9]{10}$'), marketplace text not null, url text not null,
 title text not null check(length(title) between 3 and 160), category text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), unique(user_id,asin,marketplace), unique(id,user_id)
);
create table public.campaigns (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100), created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.boards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 pinterest_id text not null, name text not null, created_at timestamptz not null default now(), unique(user_id,pinterest_id),unique(id,user_id)
);
create table public.affiliate_configuration (
 user_id uuid primary key references auth.users(id) on delete cascade,
 mode text not null default 'assisted' check(mode in ('manual','assisted','autopilot')),
 require_approval boolean not null default true, autopilot_enabled boolean not null default false,
 daily_limit integer not null default 5 check(daily_limit between 1 and 25),
 min_interval_minutes integer not null default 60 check(min_interval_minutes between 60 and 1440),
 tracking_id text not null default '', marketplace text not null default 'www.amazon.com', storefront_url text not null default '',
 disclosure text not null default 'As an Amazon Associate I earn from qualifying purchases. #ad' check(length(disclosure) between 15 and 180),
 default_board_id uuid, timezone text not null default 'America/New_York',
 created_at timestamptz not null default now(),
 foreign key(default_board_id,user_id) references public.boards(id,user_id)
);
create table public.creatives (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null, campaign_id uuid, board_id uuid,
 title text not null check(length(title) between 3 and 100),description text not null check(length(description) between 10 and 600),
 keywords text[] not null default '{}', alt_text text not null check(length(alt_text) between 5 and 500),cta text not null check(length(cta) between 2 and 60),
 template text not null check(template in ('editorial','minimal','bold')),
 status text not null default 'draft' check(status in ('draft','approved','rejected','queued','published')),
 revision integer not null default 1,approved_revision integer, approved_at timestamptz,
 created_at timestamptz not null default now(), unique(id,user_id),
 foreign key(product_id,user_id) references public.products(id,user_id),
 foreign key(campaign_id,user_id) references public.campaigns(id,user_id),
 foreign key(board_id,user_id) references public.boards(id,user_id)
);
create table public.publication_queue (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 creative_id uuid not null, scheduled_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','processing','published','failed','uncertain','cancelled')),
 attempts integer not null default 0,error text,started_at timestamptz,
 created_at timestamptz not null default now(),unique(id,user_id),
 foreign key(creative_id,user_id) references public.creatives(id,user_id)
);
create unique index one_live_job_per_creative on public.publication_queue(creative_id) where status not in ('cancelled','failed');
create index queue_due on public.publication_queue(user_id,scheduled_at) where status='pending';
create table public.publications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 queue_id uuid not null unique,creative_id uuid not null unique,product_id uuid not null,board_id uuid not null,
 template text not null,pinterest_id text not null unique,link text not null,
 published_at timestamptz not null default now(),created_at timestamptz not null default now(),last_analytics_sync_at timestamptz,unique(id,user_id),
 foreign key(queue_id,user_id) references public.publication_queue(id,user_id),
 foreign key(creative_id,user_id) references public.creatives(id,user_id),
 foreign key(product_id,user_id) references public.products(id,user_id),
 foreign key(board_id,user_id) references public.boards(id,user_id)
);
create table public.analytics_metrics (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 publication_id uuid not null,date date not null,impressions bigint check(impressions>=0),saves bigint check(saves>=0),outbound_clicks bigint check(outbound_clicks>=0),
 fetched_at timestamptz not null default now(),created_at timestamptz not null default now(),unique(publication_id,date),
 foreign key(publication_id,user_id) references public.publications(id,user_id)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.pinterest_connections (
 user_id uuid primary key references auth.users(id) on delete cascade,access_token text not null,refresh_token text,
 expires_at timestamptz not null,scope text not null default '',refresh_lock_until timestamptz,created_at timestamptz not null default now()
);
create table public.oauth_states (
 state_hash text primary key,user_id uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null
);

do $$ declare t text; begin
 foreach t in array array['products','campaigns','boards','affiliate_configuration','creatives','publication_queue','publications','analytics_metrics','audit_logs','pinterest_connections','oauth_states'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  if t not in ('pinterest_connections','oauth_states') then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
   execute format('create index on public.%I (user_id)',t);
  end if;
 end loop;
end $$;

-- Audit in the same transaction; no raw tokens or text payloads are recorded.
create function public.audit_change() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into audit_logs(user_id,action,detail) values(new.user_id,TG_TABLE_NAME||'.'||lower(TG_OP),jsonb_build_object('id',to_jsonb(new)->>'id','status',to_jsonb(new)->>'status'));
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['products','campaigns','creatives','publication_queue','publications','affiliate_configuration'] loop
 execute format('create trigger audit_record after insert or update on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;

-- Prevent edits from racing an enqueue; every content change invalidates approval.
create function public.guard_creative() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.title,new.description,new.keywords,new.alt_text,new.cta,new.board_id,new.template,new.campaign_id) is distinct from
    (old.title,old.description,old.keywords,old.alt_text,old.cta,old.board_id,old.template,old.campaign_id) then
  if old.status in ('queued','published') then raise exception 'Cancela la programación antes de editar.'; end if;
  new.revision:=old.revision+1;new.status:='draft';new.approved_revision:=null;new.approved_at:=null;
 end if;
 return new;
end $$;
create trigger guard_creative_update before update on public.creatives for each row execute function public.guard_creative();

create function public.enqueue_pin(p_user uuid,p_creative uuid,p_when timestamptz) returns uuid language plpgsql set search_path=public as $$
declare c creatives;s affiliate_configuration;j uuid;
begin
 select * into s from affiliate_configuration where user_id=p_user for update;
 if not found then raise exception 'Configura tu cuenta.';end if;
 select * into c from creatives where id=p_creative and user_id=p_user for update;
 if not found then raise exception 'Pin no encontrado.';end if;
 if c.status<>'approved' or c.approved_revision is distinct from c.revision then raise exception 'Revisa y aprueba esta versión antes de programar.';end if;
 if c.board_id is null then raise exception 'Selecciona un board.';end if;
 if s.tracking_id='' then raise exception 'Configura el tracking ID.';end if;
 if not exists(select 1 from pinterest_connections where user_id=p_user) then raise exception 'Conecta Pinterest.';end if;
 if p_when<now()-interval '1 minute' or p_when>now()+interval '90 days' then raise exception 'La fecha debe estar entre ahora y 90 días.';end if;
 if exists(select 1 from publication_queue q join creatives x on x.id=q.creative_id where q.user_id=p_user and q.status in ('pending','processing','uncertain') and x.product_id=c.product_id and x.board_id=c.board_id) then raise exception 'Ya existe un Pin de este producto en la cola de ese board.';end if;
 if exists(select 1 from publications where user_id=p_user and product_id=c.product_id and board_id=c.board_id and published_at>now()-interval '7 days') then raise exception 'Espera 7 días antes de repetir producto en el mismo board.';end if;
 if exists(select 1 from publication_queue where user_id=p_user and status in ('pending','processing') and abs(extract(epoch from (scheduled_at-p_when)))<s.min_interval_minutes*60) then raise exception 'Deja el intervalo mínimo entre Pins programados.';end if;
 if (select count(*) from publication_queue where user_id=p_user and status in ('pending','processing','published','uncertain') and (scheduled_at at time zone 'UTC')::date=(p_when at time zone 'UTC')::date)>=s.daily_limit then raise exception 'Límite diario alcanzado para esa fecha (UTC).';end if;
 insert into publication_queue(user_id,creative_id,scheduled_at) values(p_user,c.id,p_when) returning id into j;
 update creatives set status='queued' where id=c.id;
 return j;
end $$;

-- Serialize claims per account. Unknown outcomes consume budget and are never retried.
create function public.claim_pin(p_user uuid) returns setof public.publication_queue language plpgsql set search_path=public as $$
declare s affiliate_configuration;j publication_queue;c creatives;
begin
 select * into s from affiliate_configuration where user_id=p_user for update;
 if not found then return;end if;
 update publication_queue set status='uncertain',error='El proceso se interrumpió. Comprueba Pinterest antes de reconciliar.' where user_id=p_user and status='processing' and started_at<now()-interval '10 minutes';
 if exists(select 1 from publication_queue where user_id=p_user and status='processing') then return;end if;
 if (select count(*) from publication_queue where user_id=p_user and status in ('processing','published','uncertain') and (started_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date)>=s.daily_limit then return;end if;
 if exists(select 1 from publication_queue where user_id=p_user and status in ('processing','published','uncertain') and started_at>now()-make_interval(mins=>s.min_interval_minutes)) then return;end if;
 select * into j from publication_queue where user_id=p_user and status='pending' and scheduled_at<=now() order by scheduled_at for update skip locked limit 1;
 if not found then return;end if;
 select * into c from creatives where id=j.creative_id for update;
 if c.status<>'queued' or c.approved_revision is distinct from c.revision then
  update publication_queue set status='failed',error='La versión aprobada cambió.' where id=j.id;return;
 end if;
 if exists(select 1 from publications where user_id=p_user and product_id=c.product_id and board_id=c.board_id and published_at>now()-interval '7 days') then
  update publication_queue set status='failed',error='Producto publicado recientemente en este board.' where id=j.id;return;
 end if;
 return query update publication_queue set status='processing',started_at=now(),attempts=attempts+1,error=null where id=j.id returning *;
end $$;

create function public.finish_pin(p_user uuid,p_job uuid,p_pin text,p_link text) returns void language plpgsql set search_path=public as $$
declare j publication_queue;c creatives;
begin
 select * into j from publication_queue where id=p_job and user_id=p_user for update;
 if not found then raise exception 'Trabajo no encontrado.';end if;
 if j.status='published' then return;end if;
 if j.status not in ('processing','uncertain') then raise exception 'Estado de publicación inválido.';end if;
 select * into c from creatives where id=j.creative_id;
 insert into publications(user_id,queue_id,creative_id,product_id,board_id,template,pinterest_id,link) values(p_user,j.id,c.id,c.product_id,c.board_id,c.template,p_pin,p_link);
 update publication_queue set status='published',error=null where id=j.id;
 update creatives set status='published' where id=c.id;
end $$;

create function public.cancel_pin(p_user uuid,p_job uuid) returns void language plpgsql set search_path=public as $$
declare j publication_queue;
begin
 select * into j from publication_queue where id=p_job and user_id=p_user for update;
 if not found or j.status not in ('pending','failed') then raise exception 'Solo se pueden cancelar publicaciones pendientes o fallidas.';end if;
 update publication_queue set status='cancelled' where id=j.id;
 update creatives set status='draft',approved_revision=null,approved_at=null where id=j.creative_id;
end $$;

-- Approval captures current disclosure/tracking. A settings change invalidates pending work.
create function public.guard_settings() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.disclosure,new.tracking_id) is distinct from (old.disclosure,old.tracking_id) then
  if exists(select 1 from publication_queue where user_id=new.user_id and status='processing') then raise exception 'Espera a que termine la publicación activa.';end if;
  update publication_queue set status='cancelled',error='Cambió disclosure o tracking; requiere nueva aprobación.' where user_id=new.user_id and status='pending';
  update creatives set status='draft',approved_revision=null,approved_at=null where user_id=new.user_id and status in ('approved','queued') and not exists(select 1 from publication_queue q where q.creative_id=creatives.id and q.status='uncertain');
 end if;
 return new;
end $$;
create trigger guard_settings_update before update on public.affiliate_configuration for each row execute function public.guard_settings();

revoke all on function public.audit_change(),public.guard_creative(),public.guard_settings(),public.enqueue_pin(uuid,uuid,timestamptz),public.claim_pin(uuid),public.finish_pin(uuid,uuid,text,text),public.cancel_pin(uuid,uuid) from public,anon,authenticated;
grant execute on function public.audit_change(),public.guard_creative(),public.guard_settings(),public.enqueue_pin(uuid,uuid,timestamptz),public.claim_pin(uuid),public.finish_pin(uuid,uuid,text,text),public.cancel_pin(uuid,uuid) to service_role;

create table public.generation_budget(user_id uuid references auth.users(id) on delete cascade,day date not null,used integer not null default 0,autopilot_ran boolean not null default false,primary key(user_id,day));
alter table public.generation_budget enable row level security;
revoke all on public.generation_budget from anon,authenticated;
grant all on public.generation_budget to service_role;
create function public.reserve_generation(p_user uuid,p_auto boolean default false) returns boolean language plpgsql set search_path=public as $$
declare b generation_budget;d date:=(now() at time zone 'UTC')::date;
begin
 insert into generation_budget(user_id,day) values(p_user,d) on conflict do nothing;
 select * into b from generation_budget where user_id=p_user and day=d for update;
 if b.used>=30 or (p_auto and b.autopilot_ran) then return false;end if;
 update generation_budget set used=used+1,autopilot_ran=autopilot_ran or p_auto where user_id=p_user and day=d;
 return true;
end $$;
revoke all on function public.reserve_generation(uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,boolean) to service_role;
