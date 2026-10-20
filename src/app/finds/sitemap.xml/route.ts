import { shopItems } from "@/lib/server/shop";

// ivethskin.com/sitemap.xml: the home page, every find and the text pages.
export const revalidate = 3600;
const BASE = "https://ivethskin.com";

export async function GET() {
  const items = await shopItems().catch(() => []);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${BASE}/`, lastmod: today },
    ...items.map((i) => ({ loc: `${BASE}/p/${i.id}`, lastmod: i.added.slice(0, 10) })),
    ...["about", "contact", "privacy"].map((p) => ({ loc: `${BASE}/${p}`, lastmod: "2026-10-20" })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
