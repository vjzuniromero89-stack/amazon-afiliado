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
// Fixed categories, one per board topic: the category picks the boards and
// search words, so these always land on a fitting board.
export const CATEGORIES = [
  "Skincare",
  "Beauty & Makeup",
  "Supplements & Wellness",
  "Home Decor & Organization",
  "Kitchen",
  "Fashion & Clothing",
  "Fitness & Workout",
  "Tech & Gadgets",
  "Baby & Mom",
  "Pets & Dogs",
  "Gift Ideas",
] as const;
// First match wins, so the more specific topics come first.
const CATEGORY_RULES: [string, RegExp][] = [
  // Boxing gear first: "Boxing Gloves for Kids" is not a baby product and a
  // "punching bag" is not a handbag.
  ["Fitness & Workout", /boxing|boxeo|kickboxing|muay thai|\bmma\b|punching bag|heavy bag|speed bag|hand wraps?|sparring|jump rope|skipping rope|mouth ?guard|headgear/],
  // Words only skincare uses go before supplements ("Vitamin C Serum");
  // plain "skin" goes after them ("Collagen for Hair, Skin and Nails").
  ["Skincare", /serum|toner|cleanser|face wash|moisturi|(?<!ice )cream|lotion|sunscreen|\bspf\b|face mask|sheet mask|eye cream|eye patch|retinol|niacinamide/],
  // Hair care and makeup words go before supplements too ("Pantene
  // Pro-Vitamin Essence" is a hair treatment, not a vitamin).
  ["Beauty & Makeup", /shampoo|conditioner|hair (?:mask|oil|serum|treatment|essence|spray)|leave-?(?:on|in)|pantene|olaplex|moroccanoil|lip liner|lip pencil|lipstick|lip gloss|eyeliner|mascara|foundation|concealer|blush|eyeshadow|makeup|maquillaje/],
  ["Supplements & Wellness", /supplement|suplement|vitamin|collagen|colageno|protein|probiotic|omega|magnesium|gumm|capsul|wellness|health|salud/],
  ["Skincare", /skin|piel|acne|\bpores?\b/],
  ["Beauty & Makeup", /beauty|belleza|makeup|maquillaje|lipstick|lip gloss|mascara|eyeshadow|nail|hair|cabello|perfume|fragrance/],
  ["Pets & Dogs", /\bpets?\b|mascota|\bdogs?\b|perro|\bcats?\b|gato|puppy|kitten/],
  ["Baby & Mom", /baby|bebe|toddler|\bkids?\b|nino|\btoys?\b|juguete|\bmom\b|maternity|diaper|nursing/],
  ["Fitness & Workout", /fitness|\bgym\b|workout|ejercicio|\bsports?\b|yoga|running|dumbbell|resistance band/],
  ["Tech & Gadgets", /\btech|electronic|gadget|phone|laptop|headphone|earbud|charger|speaker|\bcable|keyboard|\bmouse\b|tablet|camera/],
  ["Kitchen", /kitchen|cocina|\bcook|baking|coffee|cafe|blender|knife|\bpans?\b|\bpots?\b|cutting board|utensil|water bottle|tumbler/],
  ["Fashion & Clothing", /fashion|moda|ropa|cloth|dress|vestido|\bshoes?\b|zapato|handbag|\bbags?\b|bolso|jewel|joya|outfit|jacket|\bbras?\b|bralette|legging|shirt|jeans|socks?\b/],
  ["Home Decor & Organization", /\bhome\b|hogar|casa|decor|furniture|mueble|bedroom|bathroom|storage|organiz|\blamps?\b|mattress|pillow|\bsheets?\b|blanket|curtain|\brugs?\b/],
  ["Gift Ideas", /gift|regalo/],
];
function plain(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// Cleans a product name pasted from Amazon: page prefixes and suffixes,
// symbols and stray spaces.
export function cleanProductName(raw: string) {
  let t = raw.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
  // Target and Walmart page titles end with the store: "… : Target".
  t = t.replace(/\s*[:\-–|]\s*(target|walmart\.com|walmart)\s*$/i, "");
  if (/^amazon\.[a-z.]+\s*:\s*/i.test(t))
    t = t.replace(/^amazon\.[a-z.]+\s*:\s*/i, "").replace(/\s+:\s+[^:]{3,40}$/, "");
  t = t
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .replace(/([,;])\s*\1+/g, "$1")
    .replace(/[\s,;:\-–|]+$/, "")
    .trim();
  return t.slice(0, 160);
}
// Product facts that sellers put in Amazon names; shown as chips on the Pin.
const FEATURES = [
  "waterproof", "water resistant", "wireless", "bluetooth", "rechargeable", "cordless",
  "portable", "adjustable", "foldable", "non-slip", "non slip", "noiseless", "breathable",
  "machine washable", "washable", "dishwasher safe", "stainless steel", "bpa free", "leak proof",
  "deep pocket", "deep v", "push up", "seamless", "high waisted", "lightweight", "quick dry",
  "unscented", "fragrance free", "vegan", "cruelty free", "gluten free", "sugar free", "non gmo",
  "organic", "hypoallergenic", "cooling", "memory foam", "led", "usb c", "magnetic",
  "queen size", "king size", "full size", "twin size", "travel size",
];
// Words that would turn a fact into a claim; never shown.
const CLAIMS = /\b(support|boost\w*|relief|reliev\w*|anti[- ]\w+|weight loss|lose weight|immun\w*|sleep|joints?|heal(?:s|ing)?|cures?|treats? (?:acne|pain)|detox|energy|hydrat\w*|repair\w*|restor\w*|sooth\w*|acne|wrinkles?|aging|glowing skin|slim\w*|fat burn\w*|pain|clinically|doctor\w*|best|#1)\b/i;
const titleCase = (t: string) => t.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\bBpa\b/, "BPA").replace(/\bLed\b/, "LED").replace(/\bUsb C\b/, "USB-C").replace(/\bGmo\b/, "GMO");
// Short facts read from the product name ("Waterproof, Queen Size,
// Noiseless") so the details field fills itself. Only what the name says.
export function suggestDetails(title: string) {
  const name = cleanProductName(title);
  const low = plain(name).replace(/-/g, " ");
  const found: string[] = [];
  const add = (t: string) => {
    const v = titleCase(t.trim());
    if (v.length >= 3 && v.length <= 22 && !CLAIMS.test(v) && !found.some((f) => plain(f) === plain(v)))
      found.push(v);
  };
  for (const f of FEATURES) if (new RegExp(`\\b${f}\\b`).test(low) && !found.some((x) => plain(x).includes(f))) add(f);
  // Counts and sizes: "60 Capsules", "3 Pack", "40 oz".
  for (const m of low.matchAll(/\b(\d+(?:\.\d+)?)\s*(capsules|softgels|gummies|tablets|servings|count|ct|pack|pcs|pieces|oz|fl oz|ml|inch|in)\b/g))
    add(`${m[1]} ${m[2] === "ct" ? "count" : m[2] === "in" ? "inch" : m[2]}`);
  // Short phrases after the first comma ("..., Queen Size Mattress Pad").
  for (const part of name.split(/,|\s[-–|]\s/).slice(1)) if (part.trim().split(" ").length <= 3) add(part);
  return found.slice(0, 4).join(", ");
}
// The app's own check of a Pin before you approve it. Each problem comes
// back as a short sentence; an empty list means nothing was found.
const ODD_START = /^(and|or|for|with|of|in|to|by|the|a|an|up|down|off|out|on|at)\b/i;
const REPEATED = /\b(\w{3,})\s+\1\b/i;
// A search phrase or title that reads wrong ("and Pore Care", "Bras Bras").
export function readsWrong(text: string) {
  const t = text.trim();
  return !t || ODD_START.test(t) || REPEATED.test(t);
}
export function hasClaim(text: string) {
  return CLAIMS.test(text);
}
// Drops the parts of a text that read as a promise or a health claim
// ("Hair, Skin, Nails & Joint Support") and keeps the plain facts.
export function stripClaims(text: string) {
  return text
    .split(/[,;\n]|\.\s/)
    .map((t) => t.trim().replace(/\.$/, ""))
    .filter((t) => t && !CLAIMS.test(t))
    .join(", ");
}
// A safe search phrase for each category, used when the product name gives
// none that reads well.
export const CATEGORY_PHRASE: Record<string, string> = {
  Skincare: "Skincare Must Have",
  "Beauty & Makeup": "Beauty Must Have",
  "Supplements & Wellness": "Daily Supplement",
  "Home Decor & Organization": "Home Find",
  Kitchen: "Kitchen Gadget",
  "Fashion & Clothing": "Amazon Fashion Find",
  "Fitness & Workout": "Workout Gear",
  "Tech & Gadgets": "Tech Gadget",
  "Baby & Mom": "Baby Must Have",
  "Pets & Dogs": "Pet Must Have",
  "Gift Ideas": "Gift Idea",
};
export function reviewPin(
  c: Pick<Creative, "title" | "description" | "board_id">,
  p?: { images?: string[] | null },
) {
  const issues: string[] = [];
  const title = c.title.trim();
  if (ODD_START.test(title))
    issues.push(`El título empieza raro: «${title.split(" ").slice(0, 3).join(" ")}…»`);
  if (title.length < 12) issues.push("El título es muy corto.");
  const twice = title.match(REPEATED);
  if (twice) issues.push(`Palabra repetida en el título: «${twice[1]}».`);
  const claim = `${title} ${c.description}`.match(CLAIMS);
  if (claim) issues.push(`Posible promesa o afirmación de salud: «${claim[0]}». Revísala.`);
  if (!c.board_id) issues.push("No tiene board.");
  if (p && !(p.images || []).length) issues.push("El producto no tiene fotos.");
  return issues;
}
// Picks one of the fixed categories from what was typed, then from the name.
export function detectCategory(title: string, category: string) {
  const typed = plain(category.trim());
  const exact = CATEGORIES.find((c) => plain(c) === typed);
  if (exact) return exact;
  for (const text of [typed, plain(title)]) {
    if (!text) continue;
    const hit = CATEGORY_RULES.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return "Gift Ideas";
}
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
// The first three are the original designs; the rest were added on 2026-10-16.
export const TEMPLATES = ["editorial", "minimal", "bold", "spotlight", "split", "frame"] as const;
export const creativeInput = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(600),
  keywords: z.array(z.string().trim().min(1).max(50)).max(12),
  alt_text: z.string().trim().min(5).max(500),
  cta: z.string().trim().min(2).max(60),
  board_id: z.string().uuid().nullable(),
  template: z.enum(TEMPLATES),
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
// ---------- Stores ----------
// Amazon links are built here from the ASIN and your tag. Target and
// Walmart links come ready from Impact (or the Walmart Creator portal):
// the app checks them and uses them as they are.
export const STORES = { amazon: "Amazon", target: "Target", walmart: "Walmart" } as const;
export type StoreId = keyof typeof STORES;
export function storeOf(p: { store?: string | null }): StoreId {
  return p.store === "target" || p.store === "walmart" ? p.store : "amazon";
}
const STORE_ROOT = { target: "target.com", walmart: "walmart.com" } as const;
const onStore = (host: string, root: string) => host === root || host.endsWith("." + root);
export function parseStoreLink(store: "target" | "walmart", input: string) {
  const name = STORES[store],
    root = STORE_ROOT[store];
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new Error(`Pega el link de afiliado de ${name} que te da Impact (empieza con https://).`);
  }
  if (u.protocol !== "https:" || u.username || u.password || !onStore(u.hostname.toLowerCase(), root))
    throw new Error(`El link tiene que ser https y de ${root} (por ejemplo https://goto.${root}/c/…). Si es un link corto, ábrelo y copia el largo.`);
  // A plain product page earns nothing: the link must come from Impact
  // (goto.…) or carry the affiliate tracking from the Walmart Creator portal.
  const tracked =
    u.hostname.toLowerCase().startsWith("goto.") ||
    ["wmlspartner", "affiliates_ad_id", "irgwc", "clickid", "afsrc", "sourceid"].some((k) => u.searchParams.has(k));
  if (!tracked)
    throw new Error(`Ese link de ${name} no tiene tu código de afiliado. Créalo en Impact (Create link) y pega ese link.`);
  // The product page is either the link itself or the one inside ?u=.
  let page = u;
  const inner = u.searchParams.get("u");
  if (inner) {
    try {
      page = new URL(inner);
    } catch {
      throw new Error(`El link de ${name} no trae una página de producto válida.`);
    }
    if (!onStore(page.hostname.toLowerCase(), root))
      throw new Error(`El link de ${name} lleva a otra tienda.`);
  }
  const id =
    store === "target"
      ? page.pathname.match(/\/A-(\d{5,12})(?:\/|$)/)?.[1]
      : page.pathname.match(/\/ip\/(?:[^/]+\/)?(\d{5,15})(?:\/|$)/)?.[1];
  if (!id)
    throw new Error(`No encuentro el producto en el link. En Impact crea el link con la página del producto de ${name}.`);
  return { asin: `${store === "target" ? "T" : "W"}${id}`, marketplace: `www.${root}`, url: u.toString() };
}
// The link that goes in the Pin.
export function pinLink(p: { store?: string | null; url: string }, tag: string) {
  const store = storeOf(p);
  if (store === "amazon") return affiliateUrl(p.url, tag);
  return parseStoreLink(store, p.url).url;
}
// Disclosure for the store: Amazon keeps your Amazon statement; Walmart asks
// for #WalmartPartner; both say plainly it is an affiliate link.
export function storeDisclosure(store: StoreId, amazonDisclosure: string) {
  if (store === "amazon") return amazonDisclosure;
  return `${store === "walmart" ? "#WalmartPartner " : ""}#ad · Affiliate link: I may earn a commission from purchases.`;
}
// Copy written for Amazon ("See it on Amazon") adapted to the product's store.
export function forStore(text: string, store: StoreId) {
  return store === "amazon" ? text : text.replace(/\bAmazon\b/g, STORES[store]).replace(/\bamazon\b/g, store);
}

export function descriptionWithDisclosure(
  c: Pick<Creative, "description" | "cta">,
  s: Settings,
) {
  // A plain "affiliate link" note first (FTC: hard to miss), then the
  // Amazon statement.
  const lead = /affiliate link/i.test(s.disclosure)
    ? s.disclosure
    : `#ad · Affiliate link. ${s.disclosure.replace(/\s*#ad\.?\s*$/i, "")}`;
  return `${lead}\n\n${c.description}\n${c.cta}`.slice(0, 800);
}
// One row per day from Pinterest's pin analytics. Recent days come as
// ESTIMATE (Pinterest's live numbers, refined later) and are kept; a later
// sync overwrites them. Days before the Pin or still processing stay null.
export function pinDailyMetrics(
  daily: { date: string; data_status?: string; metrics?: Record<string, number> }[],
  start: string,
  end: string,
) {
  return daily
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date >= start && d.date <= end)
    .map((d) => {
      const usable = d.data_status === "READY" || d.data_status === "ESTIMATE";
      const value = (k: string) =>
        usable && typeof d.metrics?.[k] === "number" && d.metrics[k] >= 0 ? Math.round(d.metrics[k]) : null;
      return {
        date: d.date,
        impressions: value("IMPRESSION"),
        saves: value("SAVE"),
        outbound_clicks: value("OUTBOUND_CLICK"),
      };
    });
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

// A video file named after its product ("collagen-ad.mp4") finds that
// product by itself. Only a clear single winner counts; a tie or a name
// like "IMG_1234.mov" finds nothing and the owner picks.
const VIDEO_NOISE = new Set(
  "ad ads video videos final raw kling edit edited reel reels tiktok instagram img dsc mov mp4 copy new the and for with estilo version clip".split(" "),
);
const words = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
export function matchProductByName(fileName: string, products: { id: string; title: string }[]) {
  const name = words(fileName.replace(/\.[a-z0-9]+$/i, "")).filter((w) => !VIDEO_NOISE.has(w));
  if (!name.length) return null;
  const scored = products
    .map((p) => {
      const title = words(p.title);
      const score = name.filter((w) => title.some((t) => t === w || (w.length >= 4 && t.startsWith(w)))).length;
      return { id: p.id, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].id;
}
