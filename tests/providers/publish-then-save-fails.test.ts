import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

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

// --- A small PostgREST over PGlite, enough for supabase-js in these runs ---
type Hook = (method: string, table: string, body: Record<string, unknown> | undefined) => boolean;
let failWrite: Hook = () => false;
const ident = (s: string) => `"${s.replace(/"/g, "")}"`;
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function rest(url: URL, init: RequestInit) {
  const method = (init.method || "GET").toUpperCase();
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  const accept = new Headers(init.headers).get("accept") || "";
  if (path.startsWith("rpc/")) {
    const keys = Object.keys(body || {});
    const fn = ident(path.slice(4));
    const rows = (await db.query(`select * from ${fn}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(",")})`, keys.map((k) => body[k]))).rows;
    return reply(200, rows);
  }
  if (failWrite(method, path, body)) return reply(500, { message: "database hiccup", code: "XX000" });
  const where: string[] = [];
  const params: unknown[] = [];
  let order = "";
  let limit = "";
  for (const [k, v] of url.searchParams) {
    if (k === "select" || k === "columns" || k === "on_conflict") continue;
    if (k === "order") {
      order = ` order by ${v.split(",").map((o) => `${ident(o.split(".")[0])} ${o.includes(".desc") ? "desc" : "asc"}`).join(",")}`;
      continue;
    }
    if (k === "limit") {
      limit = ` limit ${Number(v)}`;
      continue;
    }
    const m = v.match(/^(not\.)?(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/);
    if (!m) throw new Error(`fake PostgREST: unknown filter ${k}=${v}`);
    const [, not, op, value] = m;
    const col = ident(k);
    if (op === "is") where.push(`${col} is ${not ? "not " : ""}null`);
    else if (op === "in") {
      const items = value.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      where.push(`${not ? "not " : ""}${col} in (${items.map((x) => (params.push(x), `$${params.length}`)).join(",")})`);
    } else {
      const sym = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op]!;
      params.push(value);
      where.push(`${not ? "not " : ""}${col} ${sym} $${params.length}`);
    }
  }
  const w = where.length ? ` where ${where.join(" and ")}` : "";
  const t = ident(path);
  let rows: unknown[];
  if (method === "GET") rows = (await db.query(`select * from ${t}${w}${order}${limit}`, params)).rows;
  else if (method === "PATCH") {
    const cols = Object.keys(body);
    const set = cols.map((c, i) => `${ident(c)} = $${params.length + i + 1}`).join(",");
    rows = (await db.query(`update ${t} set ${set}${w} returning *`, [...params, ...cols.map((c) => body[c])])).rows;
  } else if (method === "POST") {
    rows = [];
    for (const row of Array.isArray(body) ? body : [body]) {
      const cols = Object.keys(row);
      rows.push(
        ...(await db.query(`insert into ${t}(${cols.map(ident).join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning *`, cols.map((c) => row[c]))).rows,
      );
    }
  } else if (method === "DELETE") rows = (await db.query(`delete from ${t}${w} returning *`, params)).rows;
  else throw new Error(`fake PostgREST: ${method}`);
  if (accept.includes("vnd.pgrst.object")) {
    if (rows.length !== 1) return reply(406, { code: "PGRST116", message: "not exactly one row" });
    return reply(200, rows[0]);
  }
  return reply(200, rows);
}

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
      return rest(url, init);
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
