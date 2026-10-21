import { configured } from "@/lib/server/db";
import { shopPhoto } from "@/lib/server/shop";
import { demoShop } from "@/lib/server/shop-demo";

// Public photo for the finds page; only products that are on the page.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  // ?n=2 is the product's second photo.
  const n = Number(new URL(req.url).searchParams.get("n") || 1);
  if (!Number.isInteger(n) || n < 1 || n > 20) return new Response("Not found", { status: 404 });
  // Preview test data: the same photo from the live shop.
  if (!configured() && demoShop())
    return Response.redirect(`https://ivethskin.com/finds/img/${id}${n > 1 ? `?n=${n}` : ""}`, 302);
  const photo = await shopPhoto(id, n - 1);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
