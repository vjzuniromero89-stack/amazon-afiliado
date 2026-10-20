import "server-only";
import { admin, check } from "./db";
import { getSettings } from "./data";
import { pinExtras } from "./generation";
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
  title: string;
  category: string;
  facts: string[];
  store: string;
  link: string;
};

export async function shopItems(): Promise<ShopItem[]> {
  const uid = await shopOwner();
  if (!uid) return [];
  const [products, s] = await Promise.all([
    admin().from("products").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
    getSettings(uid),
  ]);
  const items: ShopItem[] = [];
  for (const p of check(products) as Product[]) {
    if (!(p.images || []).length) continue;
    let link: string;
    try {
      link = pinLink(p, s.tracking_id);
    } catch {
      continue; // A product whose link is not valid stays off the page.
    }
    items.push({
      id: p.id,
      title: cleanProductName(p.title),
      // Older products keep free-text categories; show the fixed topic.
      category: detectCategory(p.title, p.category || ""),
      facts: pinExtras(p).perks,
      store: STORES[storeOf(p)],
      link,
    });
  }
  return items;
}

// First photo of a product on the page, for the public image route.
export async function shopPhoto(productId: string) {
  const uid = await shopOwner();
  if (!uid) return null;
  const rows = check(
    await admin().from("products").select("images").eq("user_id", uid).eq("id", productId).limit(1),
  ) as { images: string[] | null }[];
  const path = rows[0]?.images?.[0];
  if (!path || !path.startsWith(`${uid}/`)) return null;
  const { data, error } = await admin().storage.from("product-images").download(path);
  if (error || !data) return null;
  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    type: path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg",
  };
}
