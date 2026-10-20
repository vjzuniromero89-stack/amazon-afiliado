import "server-only";
import { listVideos } from "./videos";
import { admin, check, configured, session } from "./db";
import { defaults, type Snapshot } from "../types";
export async function getSettings(uid: string) {
  const sb = admin();
  const existing = check(
    await sb
      .from("affiliate_configuration")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle(),
  );
  if (existing) return existing;
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
    photos: [],
    videos: [],
    creatives: [],
    boards: [],
    queue: [],
    publications: [],
    metrics: [],
    campaigns: [],
    audit: [],
    settings: defaults,
    connected: false,
    instagram: null,
    igPosts: [],
    clicks: { total: 0, byProduct: {}, bySource: {} },
    reels: [],
    configured: configured(),
    email: null,
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
  };
  if (!configured()) return empty;
  const sb = await session();
  // getClaims verifies the token locally when the project signs with
  // asymmetric keys, saving a round trip to Supabase Auth on every page.
  const { data: auth } = await sb.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return empty;
  const user = { id: claims.sub, email: (claims.email as string | undefined) || null };
  const tables = [
    "products",
    "creatives",
    "boards",
    "publication_queue",
    "publications",
    "analytics_metrics",
    "campaigns",
  ] as const;
  const [rows, auditRes, photos, connectionRes, settings, igRes, reelsRes, videos, clicksRes] = await Promise.all([
    Promise.all(tables.map((table) => allRows(table, user.id))),
    admin()
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    // Tolerate a database that does not have the photos table yet.
    admin()
      .from("photos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    admin()
      .from("pinterest_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    getSettings(user.id),
    // Both tolerate a database without the Instagram migration.
    admin().from("instagram_connections").select("*").eq("user_id", user.id).maybeSingle(),
    admin().from("instagram_posts").select("*").eq("user_id", user.id).order("scheduled_at", { ascending: false }).limit(500),
    listVideos(user.id).catch(() => []),
    admin()
      .from("shop_clicks")
      .select("product_id,source")
      .eq("user_id", user.id)
      .gt("created_at", new Date(Date.now() - 30 * 864e5).toISOString())
      .limit(20000),
  ]);
  // Missing table (before its migration) simply counts nothing.
  const clicks = { total: 0, byProduct: {} as Record<string, number>, bySource: {} as Record<string, number> };
  for (const c of (clicksRes.error ? [] : clicksRes.data) as { product_id: string; source: string }[]) {
    clicks.total++;
    clicks.byProduct[c.product_id] = (clicks.byProduct[c.product_id] || 0) + 1;
    const src = sourceName(c.source);
    clicks.bySource[src] = (clicks.bySource[src] || 0) + 1;
  }
  const audit = check(auditRes);
  const connection = check(connectionRes);
  return {
    ...empty,
    products: rows[0],
    photos: photos.error ? [] : photos.data,
    videos,
    creatives: rows[1],
    boards: rows[2],
    queue: rows[3],
    publications: rows[4],
    metrics: rows[5],
    campaigns: rows[6],
    audit,
    settings,
    email: user.email,
    connected: !!connection,
    instagram:
      igRes.error || !igRes.data
        ? null
        : { username: igRes.data.username, auto_photos: igRes.data.auto_photos !== false },
    // Rows from before the photos migration have no kind: they are Reels.
    reels: (reelsRes.error ? [] : reelsRes.data).filter((r: { kind?: string }) => !r.kind || r.kind === "reel"),
    igPosts: (reelsRes.error ? [] : reelsRes.data)
      .filter((r: { kind?: string; scheduled_at: string }) =>
        (r.kind === "photo" || r.kind === "carousel") && Date.parse(r.scheduled_at) > Date.now() - 3 * 864e5)
      .map((r: { kind: string; product_id: string; product_ids: string[] | null; status: string; scheduled_at: string; permalink: string | null; error: string | null }) => ({
        kind: r.kind,
        product_ids: r.product_ids?.length ? r.product_ids : [r.product_id],
        status: r.status,
        scheduled_at: r.scheduled_at,
        permalink: r.permalink,
        error: r.error,
      }))
      .reverse(),
    clicks,
  } as Snapshot;
}

// "pin.it", "www.pinterest.com" -> "Pinterest"; empty -> "Directo".
function sourceName(host: string) {
  if (!host) return "Directo";
  if (/pinterest|pin\.it/.test(host)) return "Pinterest";
  if (/tiktok/.test(host)) return "TikTok";
  if (/instagram/.test(host)) return "Instagram";
  if (/facebook|fb\./.test(host)) return "Facebook";
  if (/google/.test(host)) return "Google";
  return host;
}
