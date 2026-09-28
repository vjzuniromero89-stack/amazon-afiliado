import "server-only";
import { admin, AppError, check, owned } from "./db";
import { getSettings } from "./data";
import { conceptProvider } from "./generation";
import {
  affiliateUrl,
  creativeInput,
  descriptionWithDisclosure,
} from "../domain";
import { imageProvider } from "./artwork";
import {
  pinterest,
  pinterestWithToken,
  PinterestError,
  token,
} from "./pinterest";
import type { Board, Creative, Product } from "../types";

export async function generate(
  uid: string,
  productId: string,
  ai: boolean,
  reserved = false,
) {
  const sb = admin();
  if (
    !reserved &&
    !check(await sb.rpc("reserve_generation", { p_user: uid, p_auto: false }))
  )
    throw new AppError("Se alcanzó el límite de 30 generaciones diarias.", 429);
  const p = (await owned("products", productId, uid)) as Product,
    s = await getSettings(uid);
  const boards = check(
    await sb.from("boards").select("*").eq("user_id", uid),
  ) as Board[];
  const concepts = await conceptProvider(ai).generate(p, boards, s);
  return check(
    await sb
      .from("creatives")
      .insert(
        concepts.map((c) => ({
          ...c,
          user_id: uid,
          product_id: productId,
          status: "draft",
        })),
      )
      .select("*"),
  ) as Creative[];
}

export async function approve(uid: string, id: string) {
  const c = await owned("creatives", id, uid);
  creativeInput.parse(c);
  if (!c.board_id) throw new AppError("Selecciona un board antes de aprobar.");
  await owned("boards", c.board_id, uid);
  const s = await getSettings(uid);
  const p = await owned("products", c.product_id, uid);
  affiliateUrl(p.url, s.tracking_id);
  const rows = check(
    await admin()
      .from("creatives")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_revision: c.revision,
      })
      .eq("id", id)
      .eq("user_id", uid)
      .eq("revision", c.revision)
      .in("status", ["draft", "rejected"])
      .select("id"),
  );
  if (!rows.length)
    throw new AppError(
      "El Pin cambió o ya está aprobado; actualiza la página.",
      409,
    );
}
export async function enqueue(uid: string, id: string, when: string) {
  const p = await owned("creatives", id, uid);
  const product = await owned("products", p.product_id, uid);
  affiliateUrl(product.url, (await getSettings(uid)).tracking_id);
  return check(
    await admin().rpc("enqueue_pin", {
      p_user: uid,
      p_creative: id,
      p_when: when,
    }),
  );
}

export async function publishNext(uid: string) {
  const sb = admin();
  const jobs = check(await sb.rpc("claim_pin", { p_user: uid }));
  const job = jobs?.[0];
  if (!job) return { status: "idle" };
  let attempted = false;
  try {
    const c = await owned("creatives", job.creative_id, uid);
    const [p, b, s, access] = await Promise.all([
      owned("products", c.product_id, uid),
      owned("boards", c.board_id, uid),
      getSettings(uid),
      token(uid),
    ]);
    const link = affiliateUrl(p.url, s.tracking_id);
    const png = await imageProvider.render(c, s);
    attempted = true;
    const pin = await pinterestWithToken<{ id: string }>(access, "/pins", {
      method: "POST",
      body: JSON.stringify({
        board_id: b.pinterest_id,
        title: c.title,
        description: descriptionWithDisclosure(c, s),
        alt_text: c.alt_text,
        link,
        media_source: {
          source_type: "image_base64",
          content_type: "image/png",
          data: Buffer.from(png).toString("base64"),
        },
      }),
    });
    if (!/^\d+$/.test(pin.id)) throw new Error("Respuesta sin identificador");
    check(
      await sb.rpc("finish_pin", {
        p_user: uid,
        p_job: job.id,
        p_pin: pin.id,
        p_link: link,
      }),
    );
    return { status: "published" };
  } catch (e) {
    const uncertain =
      attempted &&
      (!(e instanceof PinterestError) || e.code >= 500 || e.code === 408);
    const message = uncertain
      ? "Resultado incierto. Revisa Pinterest y reconcilia el ID del Pin; no se reintentará automáticamente."
      : e instanceof AppError
        ? e.message
        : "No se pudo preparar la publicación. Revisa la configuración.";
    check(
      await sb
        .from("publication_queue")
        .update({ status: uncertain ? "uncertain" : "failed", error: message })
        .eq("id", job.id)
        .eq("status", "processing"),
    );
    return { status: uncertain ? "uncertain" : "failed" };
  }
}

type PinterestAnalytics = Record<
  string,
  {
    daily_metrics?: {
      date: string;
      data_status?: string;
      metrics?: Record<string, number>;
    }[];
  }
>;
export async function syncAnalytics(uid: string, limit = 20) {
  const sb = admin();
  const publications = check(
    await sb
      .from("publications")
      .select("*")
      .eq("user_id", uid)
      .order("last_analytics_sync_at", { ascending: true, nullsFirst: true })
      .limit(limit),
  );
  const end = new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  let count = 0;
  for (const p of publications) {
    if (p.published_at.slice(0, 10) > end) continue;
    const response = await pinterest<PinterestAnalytics>(
      uid,
      `/pins/${encodeURIComponent(p.pinterest_id)}/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK`,
    );
    const daily = response.all?.daily_metrics;
    if (!daily) continue;
    const rows = daily
      .filter(
        (d) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
          d.date >= start &&
          d.date <= end,
      )
      .map((d) => {
        const value = (k: string) =>
          d.data_status === "READY" &&
          typeof d.metrics?.[k] === "number" &&
          d.metrics[k] >= 0
            ? Math.round(d.metrics[k])
            : null;
        return {
          user_id: uid,
          publication_id: p.id,
          date: d.date,
          impressions: value("IMPRESSION"),
          saves: value("SAVE"),
          outbound_clicks: value("OUTBOUND_CLICK"),
          fetched_at: new Date().toISOString(),
        };
      });
    if (rows.length)
      check(
        await sb
          .from("analytics_metrics")
          .upsert(rows, { onConflict: "publication_id,date" }),
      );
    check(
      await sb
        .from("publications")
        .update({ last_analytics_sync_at: new Date().toISOString() })
        .eq("id", p.id),
    );
    count += rows.length;
  }
  return count;
}

export async function autopilot(uid: string) {
  const s = await getSettings(uid);
  if (s.mode !== "autopilot" || !s.autopilot_enabled) return;
  const sb = admin();
  const products = check(
    await sb
      .from("products")
      .select("id")
      .eq("user_id", uid)
      .order("created_at")
      .limit(1000),
  );
  const used = check(
    await sb
      .from("creatives")
      .select("product_id")
      .eq("user_id", uid)
      .limit(10000),
  );
  const candidate = products.find(
    (p) => !used.some((c) => c.product_id === p.id),
  );
  if (!candidate) return;
  if (!check(await sb.rpc("reserve_generation", { p_user: uid, p_auto: true })))
    return;
  const generated = await generate(uid, candidate.id, true, true);
  if (s.require_approval) return;
  const c = generated.find((x) => x.board_id);
  if (!c) return;
  await approve(uid, c.id);
  const latest = check(
    await sb
      .from("publication_queue")
      .select("scheduled_at")
      .eq("user_id", uid)
      .in("status", ["pending", "processing"])
      .order("scheduled_at", { ascending: false })
      .limit(1),
  );
  const when = new Date(
    Math.max(
      Date.now() + 300000,
      Date.parse(latest[0]?.scheduled_at || new Date().toISOString()) +
        s.min_interval_minutes * 60000,
    ),
  );
  await enqueue(uid, c.id, when.toISOString());
}

export async function reconcile(uid: string, jobId: string, pinId: string) {
  const job = await owned("publication_queue", jobId, uid);
  if (job.status !== "uncertain")
    throw new AppError("Solo se reconcilian resultados inciertos.");
  const c = await owned("creatives", job.creative_id, uid),
    b = await owned("boards", c.board_id, uid),
    p = await owned("products", c.product_id, uid);
  const pin = await pinterest<{
    id: string;
    board_id: string;
    title: string;
    link: string;
  }>(uid, `/pins/${pinId}`);
  if (
    pin.board_id !== b.pinterest_id ||
    pin.title !== c.title ||
    !pin.link.includes(`/dp/${p.asin}`)
  )
    throw new AppError(
      "El Pin no coincide con board, título y producto de este trabajo.",
    );
  check(
    await admin().rpc("finish_pin", {
      p_user: uid,
      p_job: job.id,
      p_pin: pin.id,
      p_link: pin.link,
    }),
  );
}
