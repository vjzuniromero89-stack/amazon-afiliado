import { owned, userId, errorResponse } from "@/lib/server/db";
import { getSettings } from "@/lib/server/data";
import { imageProvider } from "@/lib/server/artwork";
import { photoFor } from "@/lib/server/images";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await userId(),
      { id } = await params;
    const c = await owned("creatives", id, uid);
    const [settings, photo] = await Promise.all([getSettings(uid), photoFor(c)]);
    return new Response(Buffer.from(await imageProvider.render(c, settings, photo)), {
      headers: {
        "Content-Type": "image/png",
        // The page links each Pin with a version key (revision, photos,
        // disclosure), so a cached copy is never stale for that URL.
        "Cache-Control": "private, max-age=604800, immutable",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
