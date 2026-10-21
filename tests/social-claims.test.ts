import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Real Postgres (PGlite) with every migration: Instagram and Facebook posts
// are reserved by one run at a time.
const db = new PGlite();
const u = "11111111-1111-4111-8111-111111111111";
let product: string;
const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
     create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  for (const m of [
    "20260928193708_initial_schema.sql",
    "20261020200000_instagram.sql",
    "20261020230000_instagram_photos.sql",
    "20261021000000_facebook.sql",
    "20261021120000_social_post_claims.sql",
  ])
    await db.exec(migration(m));
  await db.query("insert into auth.users values ($1)", [u]);
  product = (
    await db.query<{ id: string }>(
      "insert into products(user_id,asin,marketplace,url,title) values ($1,'B012345678','www.amazon.com','https://www.amazon.com/dp/B012345678','Verified product') returning id",
      [u],
    )
  ).rows[0].id;
});

const claimIg = async () =>
  (await db.query<{ id: string; claim_token: string; claimed_from: string }>("select * from claim_instagram_posts($1, 3)", [u])).rows;
const claimFb = async () =>
  (await db.query<{ id: string; claim_token: string; claimed_from: string }>("select * from claim_facebook_posts($1, 3)", [u])).rows;

test("two runs at the same time: each due Instagram post is reserved by exactly one", async () => {
  await db.query("delete from instagram_posts");
  for (const kind of ["reel", "photo", "carousel"])
    await db.query("insert into instagram_posts(user_id,product_id,kind,scheduled_at) values ($1,$2,$3,now()-interval '1 minute')", [u, product, kind]);
  const [a, b, c] = await Promise.all([claimIg(), claimIg(), claimIg()]);
  const ids = [...a, ...b, ...c].map((r) => r.id);
  assert.equal(ids.length, 3, "all three posts were claimed");
  assert.equal(new Set(ids).size, 3, "no post was claimed twice");
  assert.ok([...a, ...b, ...c].every((r) => r.claimed_from === "pending"));
  assert.deepEqual(await claimIg(), [], "a later run finds nothing to take");
});

test("a write with a stale claim token changes nothing", async () => {
  await db.query("delete from instagram_posts");
  await db.query("insert into instagram_posts(user_id,product_id,scheduled_at) values ($1,$2,now())", [u, product]);
  const [row] = await claimIg();
  const stale = await db.query(
    "update instagram_posts set status='published' where id=$1 and claim_token=$2 returning id",
    [row.id, "00000000-0000-4000-8000-000000000000"],
  );
  assert.equal(stale.rows.length, 0);
  const ok = await db.query("update instagram_posts set status='processing',claim_token=null where id=$1 and claim_token=$2 returning id", [
    row.id,
    row.claim_token,
  ]);
  assert.equal(ok.rows.length, 1);
});

test("a run that died while publishing: the post becomes uncertain, never re-sent blindly", async () => {
  await db.query("delete from instagram_posts");
  // Died during media_publish (claimed from "processing", it has a container).
  await db.query(
    "insert into instagram_posts(user_id,product_id,status,container_id,claimed_from,claim_token,claimed_at,scheduled_at) values ($1,$2,'publishing','c1','processing',gen_random_uuid(),now()-interval '11 minutes',now()-interval '1 hour')",
    [u, product],
  );
  // Died while only creating a container: nothing public, it just retries.
  await db.query(
    "insert into instagram_posts(user_id,product_id,kind,status,claimed_from,claim_token,claimed_at,scheduled_at) values ($1,$2,'photo','publishing','pending',gen_random_uuid(),now()-interval '11 minutes',now()-interval '1 hour')",
    [u, product],
  );
  const claimed = await claimIg();
  const rows = (await db.query<{ status: string; kind: string; claimed_from: string }>("select status,kind,claimed_from from instagram_posts order by kind")).rows;
  const reel = rows.find((r) => r.kind === "reel")!;
  assert.equal(reel.status, "uncertain", "the post that may have published is not taken again at once");
  assert.equal(claimed.length, 1, "only the container-only post is retried");
  assert.equal(claimed[0].claimed_from, "pending");
  // 15 minutes later the uncertain post is taken again, to be CHECKED (not re-sent).
  await db.query("update instagram_posts set claimed_at=now()-interval '16 minutes' where status='uncertain'");
  const recheck = await claimIg();
  assert.equal(recheck.length, 1);
  assert.equal(recheck[0].claimed_from, "uncertain");
});

test("Facebook: concurrent runs share no post; a link post that may have published waits for the owner", async () => {
  await db.query("delete from facebook_posts");
  await db.query("insert into facebook_posts(user_id,product_id,kind,scheduled_at) values ($1,$2,'link',now()),($1,$2,'reel',now())", [u, product]);
  const [a, b] = await Promise.all([claimFb(), claimFb()]);
  assert.equal(a.length + b.length, 2);
  assert.equal(new Set([...a, ...b].map((r) => r.id)).size, 2);
  // Both runs die mid-call.
  await db.query("update facebook_posts set claimed_at=now()-interval '11 minutes'");
  await db.query("update facebook_posts set video_id='v1' where kind='reel'");
  await claimFb();
  await db.query("update facebook_posts set claimed_at=now()-interval '16 minutes' where status='uncertain'");
  const later = await claimFb();
  const states = (await db.query<{ kind: string; status: string }>("select kind,status from facebook_posts order by kind")).rows;
  assert.deepEqual(
    states.map((s) => [s.kind, s.status]),
    [
      ["link", "uncertain"],
      ["reel", "publishing"],
    ],
    "the link post is never taken again on its own; the Reel is re-checked by its video id",
  );
  assert.equal(later.length, 1);
  assert.equal(later[0].claimed_from, "uncertain");
});

test("posts scheduled later are not taken", async () => {
  await db.query("delete from instagram_posts");
  await db.query("insert into instagram_posts(user_id,product_id,scheduled_at) values ($1,$2,now()+interval '1 hour')", [u, product]);
  assert.deepEqual(await claimIg(), []);
});
