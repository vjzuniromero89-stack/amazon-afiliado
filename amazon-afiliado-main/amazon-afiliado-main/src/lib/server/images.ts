import "server-only";
import { admin, AppError, check, owned } from "./db";
import type { Creative, Product } from "../types";

const BUCKET = "product-images";
const MAX_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGES = 5;

function decode(dataUrl: string) {
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );
  if (!m) throw new AppError("Formato de foto no válido. Usa JPG o PNG.");
  const bytes = Buffer.from(m[2], "base64");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(1, 4).toString() === "PNG";
  if (!(jpeg || png)) throw new AppError("El archivo no es una imagen válida.");
  if (bytes.length > MAX_BYTES)
    throw new AppError("Cada foto debe pesar menos de 4 MB.");
  return { bytes, type: jpeg ? "image/jpeg" : "image/png", ext: jpeg ? "jpg" : "png" };
}

export async function addProductImages(
  uid: string,
  productId: string,
  dataUrls: string[],
) {
  const p = (await owned("products", productId, uid)) as Product;
  const current = p.images || [];
  if (current.length + dataUrls.length > MAX_IMAGES)
    throw new AppError(`Máximo ${MAX_IMAGES} fotos por producto.`);
  const sb = admin();
  const paths: string[] = [];
  for (const [i, url] of dataUrls.entries()) {
    const { bytes, type, ext } = decode(url);
    const path = `${uid}/${productId}/${Date.now()}-${i}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: type, upsert: false });
    if (error) throw new AppError("No se pudo guardar la foto. Inténtalo de nuevo.");
    paths.push(path);
  }
  check(
    await sb
      .from("products")
      .update({ images: [...current, ...paths] })
      .eq("id", productId)
      .eq("user_id", uid)
      .select("id"),
  );
  return paths.length;
}

export async function clearProductImages(uid: string, productId: string) {
  const p = (await owned("products", productId, uid)) as Product;
  const sb = admin();
  if (p.images?.length) await sb.storage.from(BUCKET).remove(p.images);
  check(
    await sb
      .from("products")
      .update({ images: [] })
      .eq("id", productId)
      .eq("user_id", uid)
      .select("id"),
  );
}

export async function imageBytes(uid: string, path: string) {
  if (!path.startsWith(`${uid}/`)) throw new AppError("Foto no encontrada.", 404);
  const { data, error } = await admin().storage.from(BUCKET).download(path);
  if (error || !data) throw new AppError("Foto no encontrada.", 404);
  const bytes = Buffer.from(await data.arrayBuffer());
  return { bytes, type: path.endsWith(".png") ? "image/png" : "image/jpeg" };
}

// Each template uses a different photo when the product has several.
const ORDER: Record<string, number> = { editorial: 0, minimal: 1, bold: 2 };
export async function photoFor(c: Pick<Creative, "user_id" | "product_id" | "template">) {
  const p = (await owned("products", c.product_id, c.user_id)) as Product;
  const imgs = p.images || [];
  if (!imgs.length) return undefined;
  const path = imgs[(ORDER[c.template] ?? 0) % imgs.length];
  try {
    const { bytes, type } = await imageBytes(c.user_id, path);
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}
