import type { PGlite } from "@electric-sql/pglite";

// A small PostgREST over PGlite, enough for supabase-js in these tests:
// GET/PATCH/POST/DELETE with eq/neq/gt/gte/lt/lte/is/in filters, order,
// limit, single rows and RPC calls.
export type Hook = (method: string, table: string, body: Record<string, unknown> | undefined) => boolean;
const ident = (s: string) => `"${s.replace(/"/g, "")}"`;
export const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function rest(db: PGlite, url: URL, init: RequestInit, failWrite: Hook = () => false) {
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
      order = ` order by ${v.split(",").map((o) => `${ident(o.split(".")[0])} ${o.includes(".desc") ? "desc" : "asc"}${o.includes(".nullsfirst") ? " nulls first" : o.includes(".nullslast") ? " nulls last" : ""}`).join(",")}`;
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
