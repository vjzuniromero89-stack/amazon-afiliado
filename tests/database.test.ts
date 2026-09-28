import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const u = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
let product: string, board: string;
before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20260928193708_initial_schema.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values ($1),($2)", [u, other]);
  await db.query(
    "insert into affiliate_configuration(user_id,tracking_id) values ($1,$2),($3,$4)",
    [u, "mytag-20", other, "other-20"],
  );
  await db.query(
    "insert into pinterest_connections(user_id,access_token,expires_at) values ($1,'encrypted',now()+interval '1 day')",
    [u],
  );
  product = (
    await db.query<{ id: string }>(
      "insert into products(user_id,asin,marketplace,url,title) values ($1,'B012345678','www.amazon.com','https://www.amazon.com/dp/B012345678','Verified product') returning id",
      [u],
    )
  ).rows[0].id;
  board = (
    await db.query<{ id: string }>(
      "insert into boards(user_id,pinterest_id,name) values ($1,'123456','My board') returning id",
      [u],
    )
  ).rows[0].id;
});
after(async () => {
  await db.close();
});
async function creative() {
  return (
    await db.query<{ id: string }>(
      "insert into creatives(user_id,product_id,board_id,title,description,alt_text,cta,template) values ($1,$2,$3,'A useful idea','Verified product information','Text based creative','See details','editorial') returning id",
      [u, product, board],
    )
  ).rows[0].id;
}
async function approve(id: string) {
  await db.query(
    "update creatives set status='approved',approved_revision=revision where id=$1",
    [id],
  );
}
async function enqueue(id: string, offset = "5 minutes") {
  return (
    await db.query<{ enqueue_pin: string }>(
      `select enqueue_pin($1,$2,now()+$3::interval)`,
      [u, id, offset],
    )
  ).rows[0].enqueue_pin;
}
test("RLS isolates user rows and denies direct writes and token reads", async () => {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}';`);
  assert.equal((await db.query("select * from products")).rows.length, 0);
  await assert.rejects(
    db.query("select * from pinterest_connections"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("update affiliate_configuration set require_approval=false"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select claim_pin($1)", [u]),
    /permission denied/,
  );
  await db.exec("reset role;");
});
test("composite foreign keys reject cross-owner relationships", async () => {
  await assert.rejects(
    db.query(
      "insert into creatives(user_id,product_id,board_id,title,description,alt_text,cta,template) values($1,$2,$3,'Bad relationship','Not permitted here','Some text','Visit','bold')",
      [other, product, board],
    ),
    /foreign key/,
  );
});
test("approval gate, concurrent duplicate enqueue and edit invalidation", async () => {
  const c = await creative();
  await assert.rejects(enqueue(c), /Revisa y aprueba/);
  await approve(c);
  await db.query(
    "update creatives set title='Changed after review' where id=$1",
    [c],
  );
  const row = (
    await db.query<{
      status: string;
      approved_revision: null;
      revision: number;
    }>("select status,approved_revision,revision from creatives where id=$1", [
      c,
    ])
  ).rows[0];
  assert.deepEqual(row, {
    status: "draft",
    approved_revision: null,
    revision: 2,
  });
  await assert.rejects(enqueue(c), /Revisa y aprueba/);
  await approve(c);
  const results = await Promise.allSettled([enqueue(c), enqueue(c)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(
    db.query("update creatives set title='Cannot edit queue' where id=$1", [c]),
    /Cancela/,
  );
  const j = (
    await db.query<{ id: string }>(
      "select id from publication_queue where creative_id=$1 and status='pending'",
      [c],
    )
  ).rows[0].id;
  await db.query("select cancel_pin($1,$2)", [u, j]);
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from creatives where id=$1",
        [c],
      )
    ).rows[0].status,
    "draft",
  );
});
test("worker claims a due item once, records atomically and blocks product repeats", async () => {
  const c = await creative();
  await approve(c);
  const j = await enqueue(c, "0 minutes");
  const results = await Promise.all([
    db.query("select * from claim_pin($1)", [u]),
    db.query("select * from claim_pin($1)", [u]),
  ]);
  assert.equal(
    results.reduce((n, r) => n + r.rows.length, 0),
    1,
  );
  await db.query("select finish_pin($1,$2,$3,$4)", [
    u,
    j,
    "987654321",
    "https://www.amazon.com/dp/B012345678?tag=mytag-20",
  ]);
  await db.query("select finish_pin($1,$2,$3,$4)", [
    u,
    j,
    "987654321",
    "https://www.amazon.com/dp/B012345678?tag=mytag-20",
  ]);
  assert.equal((await db.query("select * from publications")).rows.length, 1);
  const c2 = await creative();
  await approve(c2);
  await assert.rejects(enqueue(c2), /7 días/);
  await db.query(
    "update publications set published_at=now()-interval '8 days'",
  );
  await db.query(
    "update publication_queue set started_at=now()-interval '8 days' where id=$1",
    [j],
  );
});
test("daily limits count uncertain outcomes and interrupted processing is quarantined", async () => {
  const c = await creative();
  await approve(c);
  const j = await enqueue(c, "0 minutes");
  await db.query("select * from claim_pin($1)", [u]);
  await db.query(
    "update publication_queue set started_at=now()-interval '11 minutes' where id=$1",
    [j],
  );
  await db.query("select * from claim_pin($1)", [u]);
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from publication_queue where id=$1",
        [j],
      )
    ).rows[0].status,
    "uncertain",
  );
  assert.equal(
    (await db.query("select * from claim_pin($1)", [u])).rows.length,
    0,
  );
  await assert.rejects(
    db.query("select cancel_pin($1,$2)", [u, j]),
    /Solo se pueden cancelar/,
  );
});
test("changing disclosure invalidates approved versions, generation budget caps concurrent requests", async () => {
  const c = await creative();
  await approve(c);
  await db.query(
    "update affiliate_configuration set disclosure='Nueva declaración de afiliación. #ad' where user_id=$1",
    [u],
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from creatives where id=$1",
        [c],
      )
    ).rows[0].status,
    "draft",
  );
  const results = await Promise.all(
    Array.from({ length: 35 }, () =>
      db.query<{ reserve_generation: boolean }>(
        "select reserve_generation($1,false)",
        [u],
      ),
    ),
  );
  assert.equal(results.filter((r) => r.rows[0].reserve_generation).length, 30);
});
test("anonymous role cannot read user data and every table has RLS enabled", async () => {
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from products"), /permission denied/);
  await db.exec("reset role");
  const unprotected = await db.query(
    "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
  );
  assert.equal(unprotected.rows.length, 0);
});
test("daily and interval limits apply to distinct products; disclosure cancels scheduled work", async () => {
  await db.query(
    "insert into pinterest_connections(user_id,access_token,expires_at) values($1,'encrypted',now()+interval '1 day')",
    [other],
  );
  const b = (
    await db.query<{ id: string }>(
      "insert into boards(user_id,pinterest_id,name) values($1,'other-board','Other') returning id",
      [other],
    )
  ).rows[0].id;
  const ids: string[] = [];
  for (const asin of ["B098765432", "B098765433"]) {
    const p = (
      await db.query<{ id: string }>(
        "insert into products(user_id,asin,marketplace,url,title) values($1,$2,'www.amazon.com','https://www.amazon.com/dp/'||$2,'Other product') returning id",
        [other, asin],
      )
    ).rows[0].id;
    ids.push(
      (
        await db.query<{ id: string }>(
          "insert into creatives(user_id,product_id,board_id,title,description,alt_text,cta,template,status,approved_revision) values($1,$2,$3,'Other title','Verified details','A text design','See details','bold','approved',1) returning id",
          [other, p, b],
        )
      ).rows[0].id,
    );
  }
  await db.query(
    "update affiliate_configuration set daily_limit=1 where user_id=$1",
    [other],
  );
  const tomorrow =
    "date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' + interval '1 day 8 hours'";
  await db.query(`select enqueue_pin($1,$2,${tomorrow})`, [other, ids[0]]);
  await assert.rejects(
    db.query(`select enqueue_pin($1,$2,${tomorrow}+interval '2 hours')`, [
      other,
      ids[1],
    ]),
    /Límite diario/,
  );
  await db.query(
    "update affiliate_configuration set daily_limit=5 where user_id=$1",
    [other],
  );
  await assert.rejects(
    db.query(`select enqueue_pin($1,$2,${tomorrow}+interval '20 minutes')`, [
      other,
      ids[1],
    ]),
    /intervalo mínimo/,
  );
  await db.query(
    "update affiliate_configuration set disclosure='Una declaración diferente de afiliación #ad' where user_id=$1",
    [other],
  );
  const q = await db.query<{ status: string }>(
    "select status from publication_queue where user_id=$1",
    [other],
  );
  assert.ok(q.rows.every((r) => r.status === "cancelled"));
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from creatives where id=$1",
        [ids[0]],
      )
    ).rows[0].status,
    "draft",
  );
});
