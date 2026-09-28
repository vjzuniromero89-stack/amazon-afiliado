import { z } from "zod";
import type { Creative, Metric, Publication, Settings } from "./types";
export const marketplaces = [
  "www.amazon.com",
  "www.amazon.es",
  "www.amazon.com.mx",
  "www.amazon.co.uk",
  "www.amazon.ca",
  "www.amazon.de",
  "www.amazon.fr",
  "www.amazon.it",
  "www.amazon.com.br",
  "www.amazon.com.au",
  "www.amazon.co.jp",
  "www.amazon.in",
] as const;
export function parseAmazon(input: string, marketplace = "www.amazon.com") {
  let asin = input.trim().toUpperCase();
  let host = marketplace;
  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    let url: URL;
    try {
      url = new URL(input.trim());
    } catch {
      throw new Error(
        "Introduce un ASIN de 10 caracteres o una URL completa de Amazon.",
      );
    }
    host = url.hostname.toLowerCase().replace(/^www\./, "");
    host = `www.${host}`;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !marketplaces.includes(host as (typeof marketplaces)[number])
    )
      throw new Error(
        "Usa una URL HTTPS de un marketplace Amazon compatible; expande los enlaces cortos.",
      );
    asin = (
      url.pathname.match(
        /\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i,
      )?.[1] || ""
    ).toUpperCase();
  }
  if (
    !/^[A-Z0-9]{10}$/.test(asin) ||
    !marketplaces.includes(host as (typeof marketplaces)[number])
  )
    throw new Error("No se encontró un ASIN válido.");
  return { asin, marketplace: host, url: `https://${host}/dp/${asin}` };
}
export function affiliateUrl(url: string, tag: string) {
  if (!/^[\w-]{3,80}$/.test(tag))
    throw new Error("Configura un tracking ID válido de Amazon.");
  const u = new URL(parseAmazon(url).url);
  u.searchParams.set("tag", tag);
  return u.toString();
}
export const creativeInput = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(600),
  keywords: z.array(z.string().trim().min(1).max(50)).max(12),
  alt_text: z.string().trim().min(5).max(500),
  cta: z.string().trim().min(2).max(60),
  board_id: z.string().uuid().nullable(),
  template: z.enum(["editorial", "minimal", "bold"]),
  campaign_id: z.string().uuid().nullable().optional(),
});
export const settingsInput = z.object({
  mode: z.enum(["manual", "assisted", "autopilot"]),
  require_approval: z.boolean(),
  daily_limit: z.number().int().min(1).max(25),
  min_interval_minutes: z.number().int().min(60).max(1440),
  tracking_id: z
    .string()
    .max(80)
    .regex(/^[\w-]*$/),
  marketplace: z.enum(marketplaces),
  storefront_url: z
    .string()
    .max(500)
    .refine(
      (v) =>
        !v ||
        (/^https:\/\/(www\.)?amazon\.[a-z.]+\/shop\/[\w-]+\/?$/.test(v) &&
          marketplaces.includes(
            ("www." +
              new URL(v).hostname.replace(
                /^www\./,
                "",
              )) as (typeof marketplaces)[number],
          )),
      "Usa la URL Amazon /shop/ de tu Storefront.",
    ),
  disclosure: z.string().trim().min(15).max(180),
  default_board_id: z.string().uuid().nullable(),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("es", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  autopilot_enabled: z.boolean(),
});
export function descriptionWithDisclosure(
  c: Pick<Creative, "description" | "cta">,
  s: Settings,
) {
  return `${s.disclosure}\n\n${c.description}\n${c.cta}`.slice(0, 800);
}
export function aggregate(metrics: Metric[]) {
  const sum = (key: "impressions" | "saves" | "outbound_clicks") => {
    const values = metrics
      .map((m) => m[key])
      .filter((v): v is number => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const impressions = sum("impressions"),
    clicks = sum("outbound_clicks");
  const complete = metrics.every(
    (m) => m.impressions !== null && m.outbound_clicks !== null,
  );
  return {
    impressions,
    saves: sum("saves"),
    clicks,
    ctr:
      complete && impressions && clicks !== null
        ? (clicks / impressions) * 100
        : null,
  };
}
export function breakdown(
  publications: Publication[],
  metrics: Metric[],
  by: "product_id" | "template" | "board_id" | "hour",
  timezone: string,
) {
  const groups = new Map<string, Metric[]>();
  for (const p of publications) {
    const key =
      by === "hour"
        ? new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            hour12: false,
            timeZone: timezone,
          }).format(new Date(p.published_at)) + ":00"
        : p[by];
    groups.set(key, [
      ...(groups.get(key) || []),
      ...metrics.filter((m) => m.publication_id === p.id),
    ]);
  }
  return [...groups].map(([name, rows]) => ({ name, ...aggregate(rows) }));
}
export function insights(
  publications: Publication[],
  metrics: Metric[],
  timezone: string,
) {
  if (!metrics.length)
    return [
      "Todavía no hay métricas importadas. Publica un Pin y sincroniza Pinterest para obtener recomendaciones basadas en resultados reales.",
    ];
  const total = aggregate(metrics);
  const advice = [
    `Muestra observada: ${total.impressions ?? "sin dato de"} impresiones y ${total.clicks ?? "sin dato de"} clics salientes. No incluye ventas ni comisiones de Amazon.`,
  ];
  const templates = breakdown(publications, metrics, "template", timezone)
    .filter((r) => (r.impressions ?? 0) >= 100 && r.ctr !== null)
    .sort((a, b) => b.ctr! - a.ctr!);
  if (templates.length >= 2)
    advice.push(
      `La plantilla ${templates[0].name} tiene el CTR observado más alto (${templates[0].ctr!.toFixed(2)}%). Prueba otra creatividad de esa plantilla; la comparación es descriptiva, no causal.`,
    );
  else
    advice.push(
      "Recoge al menos 100 impresiones por plantilla en dos plantillas antes de comparar su CTR.",
    );
  return advice;
}
