import sharp from "sharp";
import { shopPhoto } from "@/lib/server/shop";

// A product photo as a 1080x1080 JPEG: Instagram's API takes JPEG only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const photo = await shopPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });
  const jpeg = await sharp(photo.bytes)
    .rotate()
    .resize(1080, 1080, { fit: "cover" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}
