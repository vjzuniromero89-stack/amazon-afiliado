import "server-only";
import { admin, check, configured, session } from "./db";
import { defaults, type Snapshot } from "../types";
export async function getSettings(uid: string) {
  const sb = admin();
  check(
    await sb
      .from("affiliate_configuration")
      .upsert(
        { user_id: uid },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
  );
  return check(
    await sb
      .from("affiliate_configuration")
      .select("*")
      .eq("user_id", uid)
      .single(),
  );
}
async function allRows(table: string, uid: string) {
  const result: Record<string, any>[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    let query = admin()
      .from(table)
      .select("*")
      .eq("user_id", uid)
      .order(table === "analytics_metrics" ? "date" : "created_at", {
        ascending: false,
      })
      .order("id");
    if (table === "analytics_metrics")
      query = query.gte(
        "date",
        new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      );
    const rows = check(await query.range(from, from + 999));
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
  throw new Error(
    "El workspace supera el límite de lectura V1; configura paginación de archivo.",
  );
}
export async function snapshot(): Promise<Snapshot> {
  const empty: Snapshot = {
    products: [],
    creatives: [],
    boards: [],
    queue: [],
    publications: [],
    metrics: [],
    campaigns: [],
    audit: [],
    settings: defaults,
    connected: false,
    configured: configured(),
    email: null,
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
  };
  if (!configured()) return empty;
  const sb = await session();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return empty;
  const tables = [
    "products",
    "creatives",
    "boards",
    "publication_queue",
    "publications",
    "analytics_metrics",
    "campaigns",
  ] as const;
  const rows = await Promise.all(
    tables.map((table) => allRows(table, user.id)),
  );
  const audit = check(
    await admin()
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  );
  const connection = check(
    await admin()
      .from("pinterest_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  );
  return {
    ...empty,
    products: rows[0],
    creatives: rows[1],
    boards: rows[2],
    queue: rows[3],
    publications: rows[4],
    metrics: rows[5],
    campaigns: rows[6],
    audit,
    settings: await getSettings(user.id),
    email: user.email || null,
    connected: !!connection,
  } as Snapshot;
}
