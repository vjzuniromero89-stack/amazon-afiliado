import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Real Postgres (PGlite): the analytics_cuenta_historial migration keeps a
// Pin's history when its product is deleted, and the account totals are
// readable only by their owner.
const db = new PGlite();
const u = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(migration("20260928193708_initial_schema.sql"));
  await db.query("insert into auth.users values ($1),($2)", [u, other]);
});

const one = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;

test("before the migration a product with published Pins cannot be deleted without losing them; after it, it can", async () => {
  const product = await one(
    "insert into products(user_id,asin,marketplace,url,title) values ($1,'B012345678','www.amazon.com','https://www.amazon.com/dp/B012345678','Old product') returning id",
    [u],
  );
  const board = await one("insert into boards(user_id,pinterest_id,name) values ($1,'123','Board') returning id", [u]);
  const creative = await one(
    "insert into creatives(user_id,product_id,board_id,title,description,alt_text,cta,template) values ($1,$2,$3,'A useful idea','Verified product information','Text based creative','See details','editorial') returning id",
    [u, product, board],
  );
  const queue = await one(
    "insert into publication_queue(user_id,creative_id,scheduled_at,status) values ($1,$2,now(),'published') returning id",
    [u, creative],
  );
  const pub = await one(
    "insert into publications(user_id,queue_id,creative_id,product_id,board_id,template,pinterest_id,link) values ($1,$2,$3,$4,$5,'editorial','830351250095304875','https://www.amazon.com/dp/B012345678?tag=t-20') returning id",
    [u, queue, creative, product, board],
  );
  await db.query("insert into analytics_metrics(user_id,publication_id,date,impressions,saves,outbound_clicks) values ($1,$2,'2026-10-20',60,0,2)", [u, pub]);

  // Old schema: the publication still depends on the product.
  await assert.rejects(db.query("delete from products where id=$1", [product]), /foreign key/);

  await db.exec(migration("20261023120000_analytics_cuenta_historial.sql"));
  const named = await db.query<{ product_title: string }>("select product_title from publications where id=$1", [pub]);
  assert.equal(named.rows[0].product_title, "Old product", "existing publications get their product's name");

  // What deleteProduct does now: designs, queue rows and the product go.
  await db.query("delete from publication_queue where id=$1", [queue]);
  await db.query("delete from creatives where id=$1", [creative]);
  await db.query("delete from products where id=$1", [product]);
  const kept = await db.query<{ n: number }>(
    "select count(*)::int as n from publications p join analytics_metrics m on m.publication_id=p.id where p.id=$1",
    [pub],
  );
  assert.equal(kept.rows[0].n, 1, "the Pin and its metrics survive the product");
});

test("account totals: one row per day, readable only by the owner", async () => {
  await db.query(
    "insert into account_analytics(user_id,date,impressions,outbound_clicks,saves,engagements,pin_clicks) values ($1,'2026-10-21',246,0,0,0,0)",
    [u],
  );
  await assert.rejects(
    db.query("insert into account_analytics(user_id,date,impressions) values ($1,'2026-10-21',1)", [u]),
    /duplicate key/,
  );
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}';`);
  assert.equal((await db.query("select * from account_analytics")).rows.length, 0);
  await db.exec(`set request.jwt.claim.sub='${u}';`);
  assert.equal((await db.query("select * from account_analytics")).rows.length, 1);
  await assert.rejects(db.query("delete from account_analytics"), /permission denied/);
  await db.exec("reset role;set role anon;");
  await assert.rejects(db.query("select * from account_analytics"), /permission denied/);
  await db.exec("reset role;");
});
