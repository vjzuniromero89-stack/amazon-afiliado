import { errorResponse, userId } from "@/lib/server/db";
import { imageBytes } from "@/lib/server/images";
export async function GET(req: Request) {
  try {
    const uid = await userId();
    const path = new URL(req.url).searchParams.get("path") || "";
    const { bytes, type } = await imageBytes(uid, path);
    return new Response(bytes, {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
