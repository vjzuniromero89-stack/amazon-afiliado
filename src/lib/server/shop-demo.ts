import type { ShopItem } from "./shop";

// Test data for the public shop where there is no database: Vercel previews
// (whose environment has no database keys) and local runs with SHOP_DEMO=1.
// Never in production: there shopItems() always reads the database.
// Real products of the shop, so the review looks like the real thing; their
// photos come from the live site (the image route redirects there).
export function demoShop() {
  return process.env.VERCEL_ENV === "preview" || process.env.SHOP_DEMO === "1";
}

const row = (
  id: string,
  asin: string,
  title: string,
  short: string,
  category: string,
  facts: string[],
  days: number,
): ShopItem => ({
  id,
  no: 0,
  title,
  short,
  photos: 1,
  added: new Date(Date.UTC(2026, 9, 21) - days * 864e5).toISOString(),
  category,
  facts,
  store: "Amazon",
  link: `https://www.amazon.com/dp/${asin}?tag=ivethskin-20`,
});

export const DEMO_ITEMS: ShopItem[] = [
  row("d3aadff8-ac00-40f5-8e7c-eaccaa81786f", "B09Q4L157D", "LEGO Botanicals Orchid - Artificial, Fake Indoor Flowers Building Set for Home, Kitchen, Desk Decoration, Adults Ages 18+", "LEGO Botanicals Orchid", "Home Decor & Organization", [], 0.1),
  row("a345b155-4329-4f20-b97d-88c4cc46fd69", "B0DRWDDL5P", "Bare Home Microplush Wearable Blanket", "Bare Home Microplush Wearable Blanket", "Home Decor & Organization", ["Soft and Plush", "Warm and Cozy"], 0.2),
  row("c8afeefb-8458-479d-9522-bdaa9286e7f4", "B0GXBH2PYF", "Freestanding Reflex Punching Bag", "Freestanding Reflex Punching Bag", "Fitness & Workout", ["Height Adjustable"], 0.3),
  row("ddc3c66f-a342-4f59-ab68-e9a0be4c8b33", "B00PCIWX3W", "RDX Gel Boxing Hand Wraps inner gloves", "RDX Gel Boxing Hand Wraps inner gloves", "Fitness & Workout", [], 0.4),
  row("aa755c78-7e90-4889-9ed9-883d22713f1e", "B0GHM14SCX", "medicube Deodorant with Kojic Acid Turmeric, Sweet Vanilla Scent, 2.92 oz", "medicube Deodorant with Kojic Acid", "Beauty & Makeup", ["2.92 oz"], 0.5),
  row("d2a8946b-36ed-48e0-bf5a-91505411540b", "B07VVK39F7", "Levoit Air Purifier for Home Pets Hair Allergens in Bedroom Quiet Purifiers", "Levoit Air Purifier", "Home Decor & Organization", [], 0.6),
  row("b4873f53-2306-4e2f-80f5-4da5ebedff2e", "B0BRMYHMS5", "medicube Wrapping Mask Collagen - Overnight Peel Off Facial Mask", "medicube Wrapping Mask Collagen", "Skincare", ["Overnight", "Peel-off"], 1),
  row("93768cae-a690-4ad8-8f59-4fb823d87ea5", "B0FWKW9NTN", "L'Oreal Paris Elvive Glycolic + Gloss Shine Boosting Shampoo, 28 Fl Oz", "L'Oreal Paris Elvive Glycolic + Gloss Shampoo", "Beauty & Makeup", ["28 Fl Oz"], 2),
  row("d35f0f47-4ba3-4dd1-925b-4bc469138597", "B0CT1K8N7L", "Pantene Pro-Vitamin Essence", "Pantene Pro-Vitamin Essence", "Beauty & Makeup", ["75 mL", "Leave-on"], 3),
  row("d116e922-86b6-4f2a-b507-6d3fb83e1fa9", "B0D48LNQKB", "L'Oreal Paris Colour Riche Lip Liner Pencil", "L'Oreal Paris Colour Riche Lip Liner", "Beauty & Makeup", ["Creamy pencil"], 4),
  row("309c2cbe-49f7-418f-93ae-4c19834c3491", "B08BW46XXK", "Vanicream Daily Facial Moisturizer, Lightweight, Non-Greasy, 3 Fl Oz", "Vanicream Daily Facial Moisturizer", "Skincare", ["3 Fl Oz", "Lightweight"], 5),
  row("14d9f1d9-7595-4938-9c03-4a33a54a0e9b", "B00PBX3L7K", "COSRX Snail Mucin 96% Power Essence", "COSRX Snail Mucin 96%", "Beauty & Makeup", ["100 mL"], 6),
].map((i, n, all) => ({ ...i, no: all.length - n }));
