import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Real Postgres (PGlite): only one cron run works at a time.
const db = new PGlite();
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

before(async () => {
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
  await db.exec(readFileSync(new URL("../supabase/migrations/20261021150000_cron_lease.sql", import.meta.url), "utf8"));
});

const acquire = async (holder: string, seconds = 330) =>
  (await db.query<{ ok: boolean }>("select acquire_cron_lease('cron', $1, $2) as ok", [holder, seconds])).rows[0].ok;

test("two runs that arrive together: only the first works, the second skips", async () => {
  await db.exec("delete from cron_leases");
  const [first, second] = await Promise.all([acquire(a), acquire(b)]);
  assert.deepEqual([first, second], [true, false]);
});

test("the run that holds the lease frees it; another run cannot free it", async () => {
  await db.exec("delete from cron_leases");
  assert.equal(await acquire(a), true);
  await db.query("select release_cron_lease('cron', $1)", [b]);
  assert.equal(await acquire(b), false, "b could not free a's lease");
  await db.query("select release_cron_lease('cron', $1)", [a]);
  assert.equal(await acquire(b), true, "after a finished, the next run works");
});

test("a run that died does not block for long: its lease expires", async () => {
  await db.exec("delete from cron_leases");
  assert.equal(await acquire(a), true);
  await db.exec("update cron_leases set expires_at = now() - interval '1 second'");
  assert.equal(await acquire(b), true);
});
