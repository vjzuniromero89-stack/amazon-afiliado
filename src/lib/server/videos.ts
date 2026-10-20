import "server-only";
import { randomUUID } from "node:crypto";
import { admin, AppError, check, owned } from "./db";
import { VIDEO_BUCKET } from "./instagram";
import { matchProductByName } from "../domain";
import type { Video } from "../types";

// The video library ("Fotos" > "Videos"). Files live in the private
// "product-videos" bucket; a video assigned to a product is the one its
// Reel uses (products.video_path).
const TYPES = /^video\/(mp4|quicktime)$/;

// Direct upload from the browser: videos are too big for the API body.
export async function videoUploadUrl(uid: string, type: string, productId?: string) {
  if (!TYPES.test(type)) throw new AppError("Sube un video MP4 o MOV.");
  if (productId) await owned("products", productId, uid);
  const folder = productId ? `${uid}/${productId}` : `${uid}/library`;
  const path = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${type === "video/mp4" ? "mp4" : "mov"}`;
  const { data, error } = await admin().storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new AppError("No se pudo preparar la subida. ¿Ya corriste el SQL de Instagram?");
  return { url: data.signedUrl, path };
}

async function uploaded(path: string) {
  const i = path.lastIndexOf("/");
  const { data } = await admin().storage.from(VIDEO_BUCKET).list(path.slice(0, i), { search: path.slice(i + 1) });
  return !!data?.some((f) => f.name === path.slice(i + 1));
}

async function own(uid: string, id: string) {
  const rows = check(
    await admin().from("videos").select("id,path,product_id").eq("id", id).eq("user_id", uid).limit(1),
  ) as { id: string; path: string; product_id: string | null }[];
  if (!rows[0]) throw new AppError("Ese video ya no existe.");
  return rows[0];
}

// A finished upload joins the library, and its product when one is given.
export async function addVideo(uid: string, path: string, name: string, productId?: string) {
  if (!path.startsWith(`${uid}/`) || path.includes("..")) throw new AppError("Video no válido.");
  if (!(await uploaded(path))) throw new AppError("El video no terminó de subir. Inténtalo de nuevo.");
  const rows = check(
    await admin()
      .from("videos")
      .upsert({ user_id: uid, path, name: name.trim().slice(0, 120) || "Video" }, { onConflict: "path" })
      .select("id"),
  ) as { id: string }[];
  // From the library: the file name may say which product it is.
  let assigned: string | null = null;
  if (!productId) {
    const products = check(
      await admin().from("products").select("id,title").eq("user_id", uid).limit(500),
    ) as { id: string; title: string }[];
    productId = matchProductByName(name, products) || undefined;
    assigned = products.find((p) => p.id === productId)?.title || null;
  }
  if (productId) await assignVideo(uid, rows[0].id, productId);
  return { id: rows[0].id, assigned };
}

// One video per product: assigning replaces that product's video; null
// takes the video off its product. Files are never deleted here.
export async function assignVideo(uid: string, id: string, productId: string | null) {
  const sb = admin();
  const v = await own(uid, id);
  if (v.product_id && v.product_id !== productId)
    check(
      await sb.from("products").update({ video_path: null }).eq("id", v.product_id).eq("user_id", uid).eq("video_path", v.path).select("id"),
    );
  if (productId) {
    await owned("products", productId, uid);
    check(await sb.from("videos").update({ product_id: null }).eq("user_id", uid).eq("product_id", productId).neq("id", id).select("id"));
    check(await sb.from("products").update({ video_path: v.path }).eq("id", productId).eq("user_id", uid).select("id"));
  }
  check(await sb.from("videos").update({ product_id: productId }).eq("id", id).eq("user_id", uid).select("id"));
  return true;
}

export async function deleteVideo(uid: string, id: string) {
  const sb = admin();
  const v = await own(uid, id);
  if (v.product_id) await assignVideo(uid, id, null);
  await sb.storage.from(VIDEO_BUCKET).remove([v.path]);
  check(await sb.from("videos").delete().eq("id", id).eq("user_id", uid).select("id"));
  return true;
}

// For the page: each video with a one-hour link to play it.
export async function listVideos(uid: string): Promise<Video[]> {
  const sb = admin();
  const { data, error } = await sb
    .from("videos")
    .select("id,path,name,product_id,created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(200);
  // A database without the video library migration simply has no videos.
  if (error || !data?.length) return [];
  const signed = await sb.storage.from(VIDEO_BUCKET).createSignedUrls(data.map((v) => v.path), 3600);
  const urls = new Map((signed.data || []).map((s) => [s.path, s.signedUrl]));
  return data.map((v) => ({ ...v, url: urls.get(v.path) || null }));
}
