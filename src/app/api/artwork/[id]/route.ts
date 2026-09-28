import { owned, userId, errorResponse } from "@/lib/server/db";
import { getSettings } from "@/lib/server/data";
import { imageProvider } from "@/lib/server/artwork";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await userId(),
      { id } = await params;
    const c = await owned("creatives", id, uid);
    return new Response(
      Buffer.from(await imageProvider.render(c, await getSettings(uid))),
      {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
