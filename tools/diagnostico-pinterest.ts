// Read-only Pinterest analytics diagnosis (step A2 of the 2026-10-23 audit).
// Only GET requests to the Pinterest API; it never touches the database or
// the app. It shows what Pinterest really sends for each day (including the
// PROCESSING days the app drops) and compares the Pins' sum with the
// account's own totals for the same dates.
//
// Run:  PINTEREST_TOKEN_FILE=<file with a read token> npx tsx tools/diagnostico-pinterest.ts <app-pin-ids.txt> <out-dir>
// The token (scopes pins:read, user_accounts:read) is read from the file and
// never printed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Day = { date: string; data_status?: string; metrics?: Record<string, number | null> };
type Series = { all?: { daily_metrics?: Day[]; summary_metrics?: Record<string, number> } };
const METRICS = ["IMPRESSION", "OUTBOUND_CLICK", "SAVE"] as const;

// Sums each metric by date three ways: what the app keeps today (READY or
// ESTIMATE only), what Pinterest sent with any status, and how many rows of
// each status carried numbers at all.
export function summarize(pins: Record<string, Series>) {
  const byDay: Record<string, { app: Record<string, number>; any: Record<string, number>; statuses: Record<string, number> }> = {};
  const statuses: Record<string, { rows: number; withNumbers: number; IMPRESSION: number; OUTBOUND_CLICK: number; SAVE: number }> = {};
  for (const series of Object.values(pins))
    for (const d of series.all?.daily_metrics || []) {
      const s = d.data_status || "none";
      const day = (byDay[d.date] ||= { app: {}, any: {}, statuses: {} });
      day.statuses[s] = (day.statuses[s] || 0) + 1;
      const st = (statuses[s] ||= { rows: 0, withNumbers: 0, IMPRESSION: 0, OUTBOUND_CLICK: 0, SAVE: 0 });
      st.rows++;
      let numbers = false;
      for (const m of METRICS) {
        const v = d.metrics?.[m];
        if (typeof v !== "number") continue;
        numbers = true;
        st[m] += v;
        day.any[m] = (day.any[m] || 0) + v;
        if (s === "READY" || s === "ESTIMATE") day.app[m] = (day.app[m] || 0) + v;
      }
      if (numbers) st.withNumbers++;
    }
  return { byDay, statuses };
}

const API = "https://api.pinterest.com/v5";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [idsFile, out] = process.argv.slice(2);
  const tokenFile = process.env.PINTEREST_TOKEN_FILE;
  if (!idsFile || !out || !tokenFile) throw new Error("Uso: PINTEREST_TOKEN_FILE=<archivo> tsx tools/diagnostico-pinterest.ts <ids.txt> <carpeta>");
  const token = readFileSync(tokenFile, "utf8").trim();
  const appPins = readFileSync(idsFile, "utf8").split(/\s+/).filter((x) => /^\d+$/.test(x));
  mkdirSync(out, { recursive: true });
  const get = async (path: string) => {
    await sleep(400); // stay well under the per-user rate limit
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`GET ${path.split("?")[0]} → ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return body;
  };
  const save = (name: string, data: unknown) => writeFileSync(join(out, name), JSON.stringify(data, null, 2));

  // The same dates the app asks for: today − 30 through today, UTC.
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // Every Pin of the account, to find the ones the app does not know.
  const account: { id: string; created_at?: string; link?: string; title?: string }[] = [];
  for (let bookmark = ""; ; ) {
    const page = await get(`/pins?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ""}`);
    account.push(...(page.items || []));
    if (!page.bookmark) break;
    bookmark = page.bookmark;
  }
  save("pins.json", account);

  const ids = [...new Set([...appPins, ...account.map((p) => p.id)])];
  const raw: Record<string, Series> = {};
  for (const id of ids) {
    try {
      raw[id] = await get(`/pins/${id}/analytics?start_date=${start}&end_date=${end}&metric_types=${METRICS.join(",")}`);
    } catch (e) {
      raw[id] = { error: String(e) } as Series;
    }
  }
  save("pin-analytics.json", raw);

  const totals: Record<string, unknown> = {};
  for (const [name, filter] of [
    ["todo", ""],
    ["tus-pins", "&source=YOUR_PINS"],
    ["pins-de-otros", "&source=OTHER_PINS"],
    ["dominio-reclamado", "&from_claimed_content=CLAIMED"],
    ["organico", "&content_type=ORGANIC"],
  ])
    try {
      totals[name] = await get(`/user_account/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,OUTBOUND_CLICK,SAVE,ENGAGEMENT${filter}`);
    } catch (e) {
      totals[name] = { error: String(e) };
    }
  save("account-analytics.json", totals);
  try {
    save("top-pins.json", await get(`/user_account/analytics/top_pins?start_date=${start}&end_date=${end}&sort_by=IMPRESSION&num_of_pins=50`));
  } catch (e) {
    save("top-pins.json", { error: String(e) });
  }

  const appOnly = Object.fromEntries(appPins.map((id) => [id, raw[id]]));
  const s = summarize(appOnly);
  const sAll = summarize(raw);
  const acct = (totals.todo as Series)?.all?.summary_metrics || {};
  const lines = [
    `# Diagnóstico Pinterest (${start} → ${end}, UTC)`,
    "",
    `Pins en la cuenta: ${account.length} · Pins de la app: ${appPins.length} · Pins de la cuenta que la app no conoce: ${account.filter((p) => !appPins.includes(p.id)).length}`,
    "",
    "## Estados por fila (Pins de la app)",
    "| Estado | Filas | Con cifras | Impresiones | Clics | Guardados |",
    "|---|---|---|---|---|---|",
    ...Object.entries(s.statuses).map(([k, v]) => `| ${k} | ${v.rows} | ${v.withNumbers} | ${v.IMPRESSION} | ${v.OUTBOUND_CLICK} | ${v.SAVE} |`),
    "",
    "## Por día: lo que guarda la app vs lo que manda Pinterest (Pins de la app)",
    "| Día | Estados | Impr. app | Impr. todas | Clics app | Clics todos |",
    "|---|---|---|---|---|---|",
    ...Object.entries(s.byDay)
      .filter(([, v]) => Object.keys(v.any).length || !v.statuses.BEFORE_PIN_CREATED)
      .sort()
      .map(([d, v]) => `| ${d} | ${Object.entries(v.statuses).map(([k, n]) => `${k} ${n}`).join(", ")} | ${v.app.IMPRESSION || 0} | ${v.any.IMPRESSION || 0} | ${v.app.OUTBOUND_CLICK || 0} | ${v.any.OUTBOUND_CLICK || 0} |`),
    "",
    "## Totales",
    "| Fuente | Impresiones | Clics salientes | Guardados |",
    "|---|---|---|---|",
    `| App (solo READY/ESTIMATE, Pins de la app) | ${sum(s, "app", "IMPRESSION")} | ${sum(s, "app", "OUTBOUND_CLICK")} | ${sum(s, "app", "SAVE")} |`,
    `| Pins de la app, todos los estados | ${sum(s, "any", "IMPRESSION")} | ${sum(s, "any", "OUTBOUND_CLICK")} | ${sum(s, "any", "SAVE")} |`,
    `| Todos los Pins de la cuenta, todos los estados | ${sum(sAll, "any", "IMPRESSION")} | ${sum(sAll, "any", "OUTBOUND_CLICK")} | ${sum(sAll, "any", "SAVE")} |`,
    `| Cuenta (user_account/analytics, todo) | ${acct.IMPRESSION ?? "?"} | ${acct.OUTBOUND_CLICK ?? "?"} | ${acct.SAVE ?? "?"} |`,
    "",
    "Archivos crudos: pins.json, pin-analytics.json, account-analytics.json, top-pins.json.",
  ];
  writeFileSync(join(out, "resumen.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

function sum(s: ReturnType<typeof summarize>, kind: "app" | "any", m: (typeof METRICS)[number]) {
  return Object.values(s.byDay).reduce((t, d) => t + (d[kind][m] || 0), 0);
}

// Only when run as a script, not when a test imports summarize().
if (/tools[\\/]diagnostico-pinterest\.ts$/.test(process.argv[1] || "")) main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
