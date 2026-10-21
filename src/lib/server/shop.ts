import "server-only";
import { admin, check, configured } from "./db";
import { getSettings } from "./data";
import { parseTitle, pinExtras } from "./generation";
import { cleanProductName, detectCategory, pinLink, STORES, storeOf } from "../domain";
import type { Product } from "../types";

// The public "finds" page: every product with a photo, its facts and the
// affiliate link. The app has one owner: the account connected to Pinterest.
export async function shopOwner() {
  const rows = check(
    await admin()
      .from("pinterest_connections")
      .select("user_id")
      .order("created_at", { ascending: true })
      .limit(1),
  ) as { user_id: string }[];
  return rows[0]?.user_id ?? null;
}

export type ShopItem = {
  id: string;
  // Catalog number by date added: the first product is 1.
  no: number;
  title: string;
  short: string;
  photos: number;
  added: string;
  category: string;
  facts: string[];
  store: string;
  link: string;
};

export async function shopItems(): Promise<ShopItem[]> {
  // A build without the database (a Vercel preview or a local build) shows
  // an empty shop instead of failing the build. Production always has it.
  if (!configured()) return [];
  const uid = await shopOwner();
  if (!uid) return [];
  const [products, s] = await Promise.all([
    admin().from("products").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
    getSettings(uid),
  ]);
  const rows = check(products) as Product[];
  const items: ShopItem[] = [];
  for (const [i, p] of rows.entries()) {
    if (!(p.images || []).length) continue;
    let link: string;
    try {
      link = pinLink(p, s.tracking_id);
    } catch {
      continue; // A product whose link is not valid stays off the page.
    }
    const title = cleanProductName(p.title);
    items.push({
      id: p.id,
      no: rows.length - i,
      title,
      short: parseTitle(title).short || title,
      photos: p.images!.length,
      added: p.created_at,
      // Older products keep free-text categories; show the fixed topic.
      category: detectCategory(p.title, p.category || ""),
      facts: pinExtras(p).perks,
      store: STORES[storeOf(p)],
      link,
    });
  }
  return items;
}

// One find for its own page, with the rest of the shop for "more like this".
export async function shopItem(id: string) {
  const items = await shopItems();
  const item = items.find((i) => i.id === id);
  return item ? { item, items } : null;
}

// A photo of a product on the page (the first by default), for the public
// image route.
export async function shopPhoto(productId: string, index = 0) {
  const uid = await shopOwner();
  if (!uid) return null;
  const rows = check(
    await admin().from("products").select("images").eq("user_id", uid).eq("id", productId).limit(1),
  ) as { images: string[] | null }[];
  const path = rows[0]?.images?.[index];
  if (!path || !path.startsWith(`${uid}/`)) return null;
  const { data, error } = await admin().storage.from("product-images").download(path);
  if (error || !data) return null;
  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    type: path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg",
  };
}
