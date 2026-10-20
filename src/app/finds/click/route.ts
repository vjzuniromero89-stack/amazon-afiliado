import { admin } from "@/lib/server/db";
import { shopOwner } from "@/lib/server/shop";

// A tap on a store button. Only the product, page, source site and time are
// kept: no IP, no cookies. A bad or unknown product is ignored quietly.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; page?: string; source?: string };
    if (!/^[0-9a-f-]{36}$/i.test(body.id || "")) return new Response(null, { status: 204 });
    const uid = await shopOwner();
    if (!uid) return new Response(null, { status: 204 });
    const source = (body.source || "").toLowerCase().replace(/^www\./, "").slice(0, 80);
    await admin()
      .from("shop_clicks")
      .insert({ user_id: uid, product_id: body.id, page: (body.page || "").slice(0, 120), source });
  } catch {
    /* Counting must never break the visitor's way to the store. */
  }
  return new Response(null, { status: 204 });
}
