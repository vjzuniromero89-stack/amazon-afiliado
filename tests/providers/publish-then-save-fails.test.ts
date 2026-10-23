import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { reply, rest as fakeRest } from "./fake-postgrest";

// The whole publishing run, end to end: the real publishReels and
// publishFacebook against real Postgres (PGlite with every migration), with
// Instagram and Facebook faked. The network ACCEPTS the post and then saving
// "published" fails. The next cron runs must not send it again.

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";

const db = new PGlite();
const u = "22222222-2222-4222-8222-222222222222";
let product: string;

// --- A small PostgREST over PGlite (shared helper) ---
type Hook = (method: string, table: string, body: Record<string, unknown> | undefined) => boolean;
let failWrite: Hook = () => false;

// --- Instagram and Facebook: they accept every publish and remember it ---
const calls = { igPublish: 0, fbFeed: 0, fbFinish: 0 };
let igContainer = "FINISHED";
let fbPublishing = "not_started";

async function network(url: URL, init: RequestInit) {
  const form = init.body instanceof URLSearchParams ? init.body : new URLSearchParams();
  const method = (init.method || "GET").toUpperCase();
  if (url.host === "graph.instagram.com") {
    if (url.pathname.endsWith("/media_publish")) {
      calls.igPublish++;
      igContainer = "PUBLISHED";
      return reply(200, { id: "ig-media-1" });
    }
    if (url.pathname.endsWith("/container-1")) return reply(200, { status_code: igContainer });
    if (url.pathname.endsWith("/ig-media-1")) return reply(200, { permalink: "https://instagram.com/p/x" });
  }
  if (url.host === "graph.facebook.com") {
    if (url.pathname.endsWith("/feed") && method === "POST") {
      calls.fbFeed++;
      return reply(200, { id: "page_1_post_1" });
    }
    if (url.pathname.endsWith("/video_reels") && form.get("upload_phase") === "start") return reply(200, { video_id: "video-1" });
    if (url.pathname.endsWith("/video_reels") && form.get("upload_phase") === "finish") {
      calls.fbFinish++;
      fbPublishing = "in_progress";
      return reply(200, { success: true });
    }
    if (url.pathname.endsWith("/video-1"))
      return reply(200, { status: { uploading_phase: { status: "complete" }, publishing_phase: { status: fbPublishing } } });
  }
  if (url.host === "rupload.facebook.com") return reply(200, { success: true });
  throw new Error(`unexpected network call ${method} ${url}`);
}

before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
     create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const m of [
    "20260928193708_initial_schema.sql",
    "20261020200000_instagram.sql",
    "20261020230000_instagram_photos.sql",
    "20261021000000_facebook.sql",
    "20261021120000_social_post_claims.sql",
    "20261021160000_plan_once.sql",
  ]) {
    assert.ok(readdirSync(dir).includes(m));
    await db.exec(readFileSync(new URL(m, dir), "utf8"));
  }
  await db.query("insert into auth.users values ($1)", [u]);
  await db.query("insert into affiliate_configuration(user_id) values ($1)", [u]);
  product = (
    await db.query<{ id: string }>(
      "insert into products(user_id,asin,marketplace,url,title,video_path) values ($1,'B012345678','www.amazon.com','https://www.amazon.com/dp/B012345678','Verified product','v.mp4') returning id",
      [u],
    )
  ).rows[0].id;
  // Automatic photos and link posts off: only the posts each test adds.
  await db.query("insert into instagram_connections(user_id,ig_user_id,access_token,expires_at,auto_photos) values ($1,'ig-1','t',now()+interval '50 days',false)", [u]);
  await db.query("insert into facebook_connections(user_id,page_id,access_token,auto_posts) values ($1,'page-1','t',false)", [u]);

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.host === "supabase.test") {
      if (url.pathname.startsWith("/storage/v1/object/sign/")) return reply(200, { signedURL: "/object/sign/x?token=t" });
      return fakeRest(db, url, init, failWrite);
    }
    return network(url, init);
  }) as typeof fetch;
  void realFetch;
});

beforeEach(async () => {
  await db.query("delete from instagram_posts");
  await db.query("delete from facebook_posts");
  calls.igPublish = calls.fbFeed = calls.fbFinish = 0;
  igContainer = "FINISHED";
  fbPublishing = "not_started";
  failWrite = () => false;
});

// The first write that marks the post published (or started) fails once.
const failFirstSave = (table: string, status: string) => {
  let failed = false;
  failWrite = (method, t, body) => {
    if (failed || method !== "PATCH" || t !== table || body?.status !== status) return false;
    failed = true;
    return true;
  };
};
// Later cron runs: 20 minutes later, so uncertain posts are due for a check.
const later = (table: string) => db.query(`update ${table} set claimed_at = now() - interval '20 minutes'`);
const status = async (table: string) => (await db.query<{ status: string }>(`select status from ${table}`)).rows.map((r) => r.status);

test("Facebook link post: Facebook accepts it, saving fails; the next runs do not post it again", async () => {
  const { publishFacebook } = await import("../../src/lib/server/facebook");
  await db.query("insert into facebook_posts(user_id,product_id,kind,scheduled_at) values ($1,$2,'link',now()-interval '1 minute')", [u, product]);
  failFirstSave("facebook_posts", "published");
  await publishFacebook(u);
  assert.equal(calls.fbFeed, 1, "Facebook received the post once");
  for (let run = 0; run < 3; run++) {
    await later("facebook_posts");
    await publishFacebook(u);
  }
  assert.equal(calls.fbFeed, 1, "three more cron runs: still one post on Facebook");
  assert.deepEqual(await status("facebook_posts"), ["uncertain"], "it waits for the owner (\"Revisar en Facebook\")");
});

test("Instagram: media_publish accepted, saving fails; the next run sees it published and does not repeat", async () => {
  const { publishReels } = await import("../../src/lib/server/instagram");
  await db.query(
    "insert into instagram_posts(user_id,product_id,kind,status,container_id,scheduled_at) values ($1,$2,'photo','processing','container-1',now()-interval '1 minute')",
    [u, product],
  );
  failFirstSave("instagram_posts", "published");
  await publishReels(u);
  assert.equal(calls.igPublish, 1, "Instagram received media_publish once");
  for (let run = 0; run < 3; run++) {
    await later("instagram_posts");
    await publishReels(u);
  }
  assert.equal(calls.igPublish, 1, "three more cron runs: still one post on Instagram");
  assert.deepEqual(await status("instagram_posts"), ["published"], "the check found it PUBLISHED and saved it");
});

test("Facebook Reel: finish accepted, saving fails; the next run finds the same video publishing and does not repeat", async () => {
  const { publishFacebook } = await import("../../src/lib/server/facebook");
  await db.query("insert into facebook_posts(user_id,product_id,kind,scheduled_at) values ($1,$2,'reel',now()-interval '1 minute')", [u, product]);
  failFirstSave("facebook_posts", "processing");
  await publishFacebook(u);
  assert.equal(calls.fbFinish, 1, "Facebook received finish once");
  for (let run = 0; run < 3; run++) {
    await later("facebook_posts");
    await publishFacebook(u);
  }
  assert.equal(calls.fbFinish, 1, "three more cron runs: still one Reel");
  assert.deepEqual(await status("facebook_posts"), ["processing"], "it waits for Facebook to finish publishing the same video");
});
