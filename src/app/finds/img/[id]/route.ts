import { shopPhoto } from "@/lib/server/shop";

// Public photo for the finds page; only products that are on the page.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const photo = await shopPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
