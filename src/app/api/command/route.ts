import { z } from "zod";
import {
  admin,
  AppError,
  check,
  errorResponse,
  originGuard,
  owned,
  userId,
} from "@/lib/server/db";
import { creativeInput, parseAmazon, settingsInput } from "@/lib/domain";
import {
  approveAndPublish,
  enqueue,
  generate,
  publishNext,
  reconcile,
  syncAnalytics,
} from "@/lib/server/operations";
import { pinterest, syncBoards } from "@/lib/server/pinterest";
import {
  addProductImages,
  clearProductImages,
  deleteProduct,
} from "@/lib/server/images";
const photos = z.array(z.string().max(6_000_000)).max(5);
export const maxDuration = 60;
const uuid = z.string().uuid();
export async function POST(req: Request) {
  try {
    originGuard(req);
    const uid = await userId();
    const body = await req.json();
    const action = z.string().parse(body.action),
      sb = admin();
    let result: unknown;
    switch (action) {
      case "addProduct": {
        const data = z
          .object({
            input: z.string().min(1).max(2048),
            title: z.string().trim().min(3).max(160),
            category: z.string().trim().max(80),
            notes: z.string().trim().max(1000),
            marketplace: z.string(),
            images: photos.optional(),
          })
          .parse(body);
        const { images, ...fields } = data;
        let amazon: ReturnType<typeof parseAmazon>;
        try {
          amazon = parseAmazon(fields.input, fields.marketplace);
        } catch (e) {
          throw new AppError(
            e instanceof Error ? e.message : "URL o ASIN no válido.",
          );
        }
        const product = check(
          await sb
            .from("products")
            .insert({
              ...amazon,
              user_id: uid,
              title: fields.title,
              category: fields.category,
              notes: fields.notes,
            })
            .select("*")
            .single(),
        );
        if (images?.length)
          await addProductImages(uid, product.id, images);
        result = product;
        break;
      }
      case "addProductImages": {
        result = await addProductImages(
          uid,
          uuid.parse(body.product_id),
          photos.min(1).parse(body.images),
        );
        break;
      }
      case "deleteProduct": {
        await deleteProduct(uid, uuid.parse(body.product_id));
        break;
      }
      case "clearProductImages": {
        await clearProductImages(uid, uuid.parse(body.product_id));
        break;
      }
      case "createCampaign": {
        result = check(
          await sb
            .from("campaigns")
            .insert({
              user_id: uid,
              name: z.string().trim().min(1).max(100).parse(body.name),
            })
            .select("*")
            .single(),
        );
        break;
      }
      case "generate": {
        result = await generate(
          uid,
          uuid.parse(body.product_id),
          z.boolean().parse(body.ai),
        );
        break;
      }
      case "createCreative": {
        const data = creativeInput.parse(body.creative);
        const product = uuid.parse(body.product_id);
        await owned("products", product, uid);
        if (data.board_id) await owned("boards", data.board_id, uid);
        if (data.campaign_id) await owned("campaigns", data.campaign_id, uid);
        result = check(
          await sb
            .from("creatives")
            .insert({ ...data, product_id: product, user_id: uid })
            .select("*")
            .single(),
        );
        break;
      }
      case "editCreative": {
        const id = uuid.parse(body.id),
          data = creativeInput.parse(body.creative);
        await owned("creatives", id, uid);
        if (data.board_id) await owned("boards", data.board_id, uid);
        if (data.campaign_id) await owned("campaigns", data.campaign_id, uid);
        const rows = check(
          await sb
            .from("creatives")
            .update(data)
            .eq("id", id)
            .eq("user_id", uid)
            .eq("revision", z.number().int().parse(body.revision))
            .in("status", ["draft", "approved", "rejected"])
            .select("id"),
        );
        if (!rows.length)
          throw new AppError(
            "El Pin cambió o está programado. Actualiza y vuelve a intentarlo.",
            409,
          );
        break;
      }
      case "approve":
        result = await approveAndPublish(uid, uuid.parse(body.id));
        break;
      case "reject": {
        const rows = check(
          await sb
            .from("creatives")
            .update({
              status: "rejected",
              approved_at: null,
              approved_revision: null,
            })
            .eq("id", uuid.parse(body.id))
            .eq("user_id", uid)
            .in("status", ["draft", "approved"])
            .select("id"),
        );
        if (!rows.length)
          throw new AppError(
            "No se puede rechazar este Pin en su estado actual.",
          );
        break;
      }
      case "deleteCreative": {
        const id = uuid.parse(body.id);
        const c = (await owned("creatives", id, uid)) as { status: string };
        if (!["draft", "approved", "rejected"].includes(c.status))
          throw new AppError(
            "No se puede eliminar un Pin programado o publicado. Cancélalo primero.",
          );
        check(
          await sb
            .from("publication_queue")
            .delete()
            .eq("creative_id", id)
            .eq("user_id", uid)
            .in("status", ["cancelled", "failed"])
            .select("id"),
        );
        const rows = check(
          await sb
            .from("creatives")
            .delete()
            .eq("id", id)
            .eq("user_id", uid)
            .in("status", ["draft", "approved", "rejected"])
            .select("id"),
        );
        if (!rows.length)
          throw new AppError("El Pin cambió. Actualiza y vuelve a intentarlo.", 409);
        break;
      }
      case "schedule":
        result = await enqueue(
          uid,
          uuid.parse(body.id),
          z.string().datetime().parse(body.when),
        );
        break;
      case "cancel":
        check(
          await sb.rpc("cancel_pin", {
            p_user: uid,
            p_job: uuid.parse(body.id),
          }),
        );
        break;
      case "reconcile":
        await reconcile(
          uid,
          uuid.parse(body.id),
          z.string().regex(/^\d+$/).parse(body.pin_id),
        );
        break;
      case "settings": {
        const data = settingsInput.parse(body.settings);
        if (data.default_board_id)
          await owned("boards", data.default_board_id, uid);
        check(
          await sb
            .from("affiliate_configuration")
            .upsert({ ...data, user_id: uid }),
        );
        break;
      }
      case "syncBoards":
        result = await syncBoards(uid);
        break;
      case "createBoard": {
        const name = z.string().trim().min(1).max(50).parse(body.name);
        const b = await pinterest<{ id: string; name: string }>(
          uid,
          "/boards",
          { method: "POST", body: JSON.stringify({ name, privacy: "PUBLIC" }) },
        );
        check(
          await sb
            .from("boards")
            .upsert(
              { user_id: uid, pinterest_id: b.id, name: b.name },
              { onConflict: "user_id,pinterest_id" },
            ),
        );
        break;
      }
      case "syncAnalytics":
        result = await syncAnalytics(uid);
        break;
      case "publishDue":
        result = await publishNext(uid);
        break;
      default:
        throw new AppError("Operación desconocida.", 400);
    }
    return Response.json({ ok: true, result });
  } catch (e) {
    return errorResponse(e);
  }
}
