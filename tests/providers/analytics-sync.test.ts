import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { reply, rest } from "./fake-postgrest";

// The real syncAnalytics against real Postgres (PGlite with the migrations)
// and a fake Pinterest that answers like the diagnosis of 2026-10-23:
// consolidated days have numbers, PROCESSING days come with zeros, and the
// rate limit (429) can hit in the middle of a run.

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const db = new PGlite();
const u = "33333333-3333-4333-8333-333333333333";
const calls = { account: 0, pin: 0 };
const day = (date: string, status: string, impressions: number, clicks: number) => ({
  date,
  data_status: status,
  metrics: { IMPRESSION: impressions, OUTBOUND_CLICK: clicks, SAVE: 0, ENGAGEMENT: 1, PIN_CLICK: 1 },
});

function pinterestApi(url: URL) {
  if (url.pathname.endsWith("/user_account/analytics")) {
    calls.account++;
    return reply(200, {
      all: {
        daily_metrics: [
          day("2026-10-20", "BEFORE_BUSINESS_CREATED", 0, 0),
          day("2026-10-21", "READY", 246, 1),
          day("2026-10-22", "PROCESSING", 0, 0),
        ],
      },
    });
  }
  const pin = url.pathname.match(/\/pins\/(\d+)\/analytics$/)?.[1];
  if (pin) {
    calls.pin++;
    if (pin === "222") return reply(429, { code: 8, message: "You have exceeded your rate limit." });
    return reply(200, {
      all: {
        daily_metrics: [
          day("2026-10-20", "BEFORE_PIN_CREATED", 0, 0),
          day("2026-10-21", "READY", 103, 2),
          day("2026-10-22", "PROCESSING", 0, 0),
        ],
      },
    });
  }
  throw new Error(`unexpected Pinterest call ${url}`);
}

before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  for (const m of ["20260928193708_initial_schema.sql", "20261023120000_analytics_cuenta_historial.sql"])
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${m}`, import.meta.url), "utf8"));
  const { encrypt } = await import("../../src/lib/server/crypto");
  await db.query("insert into auth.users values ($1)", [u]);
  await db.query("insert into pinterest_connections(user_id,access_token,expires_at) values ($1,$2,now()+interval '10 days')", [u, encrypt("token")]);
  const board = (await db.query<{ id: string }>("insert into boards(user_id,pinterest_id,name) values ($1,'9','Board') returning id", [u])).rows[0].id;
  // Pin 111 was never synced (goes first); pin 222 was synced long ago.
  for (const [pin, synced] of [["111", null], ["222", "2026-10-01T00:00:00Z"]])
    await db.query(
      "insert into publications(user_id,queue_id,creative_id,product_id,board_id,template,pinterest_id,link,last_analytics_sync_at) values ($1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),$2,'split',$3,'https://www.amazon.com/dp/B012345678?tag=t-20',$4)",
      [u, board, pin, synced],
    );
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.host === "supabase.test") return rest(db, url, init);
    if (url.host === "api.pinterest.com") return pinterestApi(url);
    throw new Error(`unexpected network call ${url}`);
  }) as typeof fetch;
});

test("sync keeps only days with numbers, stores the account totals and stops at a 429", async () => {
  const { syncAnalytics } = await import("../../src/lib/server/operations");
  const result = await syncAnalytics(u, 20);

  const metrics = (await db.query<{ date: string; impressions: number; outbound_clicks: number }>(
    "select m.date::text as date, m.impressions::int as impressions, m.outbound_clicks::int as outbound_clicks from analytics_metrics m join publications p on p.id=m.publication_id where p.pinterest_id='111'",
  )).rows;
  assert.deepEqual(metrics, [{ date: "2026-10-21", impressions: 103, outbound_clicks: 2 }], "no rows for PROCESSING or days before the Pin");

  const account = (await db.query<{ date: string; impressions: number }>(
    "select date::text as date, impressions::int as impressions from account_analytics where user_id=$1",
    [u],
  )).rows;
  assert.deepEqual(account, [{ date: "2026-10-21", impressions: 246 }], "only the consolidated account day");

  const synced = (await db.query<{ pinterest_id: string; s: string | null }>(
    "select pinterest_id, last_analytics_sync_at::text as s from publications order by pinterest_id",
  )).rows;
  assert.ok(synced[0].s, "pin 111 is marked synced");
  assert.match(synced[1].s || "", /^2026-10-01/, "pin 222 hit the rate limit and keeps its old mark, so it goes first next time");
  assert.ok(Object.keys(result.statuses).some((k) => k.includes("429")), "the run says it stopped at the rate limit");

  // The cron (limit 2) right after does not ask for the account again within the hour.
  await syncAnalytics(u, 2);
  assert.equal(calls.account, 1);
});
