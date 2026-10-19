import "server-only";
import { admin, AppError, check, owned } from "./db";
import { getSettings } from "./data";
import { conceptProvider, pickBoard, pinExtras, rankBoards } from "./generation";
import {
  affiliateUrl,
  creativeInput,
  descriptionWithDisclosure,
  TEMPLATES,
} from "../domain";
import { imageProvider } from "./artwork";
import { photoFor } from "./images";
import {
  pinterest,
  pinterestWithToken,
  PinterestError,
  token,
} from "./pinterest";
import type { Board, Creative, Product, Settings } from "../types";

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
  const concepts = await conceptProvider(ai).generate(
    p,
    boards.filter((b) => !b.archived),
    s,
  );
  // Alternate design sets on each round so regenerating shows new looks.
  const { count } = await sb
    .from("creatives")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("product_id", productId);
  const set = Math.floor((count || 0) / 3) % 2 ? TEMPLATES.slice(0, 3) : TEMPLATES.slice(3);
  concepts.forEach((c, i) => (c.template = set[i % 3]));
  // Each Pin on its own fitting board when there are several, so the
  // 7-day same-board rule does not hold the other two back.
  const ranked = rankBoards(p, boards, s);
  if (ranked.length > 1)
    concepts.forEach((c, i) => (c.board_id = ranked[i % ranked.length].id));
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
  let c = await owned("creatives", id, uid);
  creativeInput.parse(c);
  if (!c.board_id) {
    // Pins generated before boards were synced: pick the best board now.
    const [prod, boards, st] = await Promise.all([
      owned("products", c.product_id, uid),
      admin().from("boards").select("*").eq("user_id", uid),
      getSettings(uid),
    ]);
    const board = pickBoard(prod as Product, (check(boards) as Board[]) || [], st);
    if (!board)
      throw new AppError(
        "No hay boards. Conecta Pinterest y pulsa Sincronizar boards en Settings.",
      );
    check(
      await admin()
        .from("creatives")
        .update({ board_id: board.id })
        .eq("id", id)
        .eq("user_id", uid)
        .in("status", ["draft", "rejected"])
        .select("id"),
    );
    c = await owned("creatives", id, uid);
  }
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

// Earliest moment this Pin may go out: now, unless Pinterest spacing
// (minimum interval) or the daily limit require waiting.
export async function earliestSlot(uid: string) {
  const s = await getSettings(uid);
  const rows = check(
    await admin()
      .from("publication_queue")
      .select("scheduled_at, started_at")
      .eq("user_id", uid)
      .in("status", ["pending", "processing", "published", "uncertain"])
      .gte("scheduled_at", new Date(Date.now() - 2 * 86400000).toISOString()),
  ) as { scheduled_at: string; started_at: string | null }[];
  const gap = s.min_interval_minutes * 60000;
  const times = rows.map((r) => Date.parse(r.started_at || r.scheduled_at));
  let t = Date.now() + 2000;
  for (let i = 0; i < 2000; i++) {
    const clash = times.find((x) => Math.abs(x - t) < gap);
    if (clash !== undefined) {
      t = clash + gap + 60000;
      continue;
    }
    const day = new Date(t).toISOString().slice(0, 10);
    if (
      rows.filter((r) => r.scheduled_at.slice(0, 10) === day).length >=
      s.daily_limit
    ) {
      const d = new Date(t);
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(0, 5, 0, 0);
      t = d.getTime();
      continue;
    }
    return new Date(t).toISOString();
  }
  throw new AppError("La cola está llena. Revisa Scheduler.");
}

// Approve, then publish right away when allowed; otherwise it waits in the
// queue for the earliest allowed moment and goes out automatically.
export async function approveAndPublish(uid: string, id: string) {
  await approve(uid, id);
  let when: string;
  try {
    when = await earliestSlot(uid);
    await enqueue(uid, id, when);
  } catch (e) {
    return {
      warning:
        e instanceof Error ? e.message : "No se pudo enviar a Pinterest.",
    };
  }
  const wait = Date.parse(when) - Date.now();
  if (wait > 5000) return { scheduled_at: when };
  if (wait > 0) await new Promise((r) => setTimeout(r, wait + 500));
  const r = await publishNext(uid);
  if (r.status === "published") return { published: true };
  if (r.status === "idle") return { scheduled_at: when };
  return {
    warning:
      "Pinterest no confirmó la publicación. Revisa el estado en Scheduler.",
  };
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
    const png = await imageProvider.render(c, s, await photoFor(c), pinExtras(p as Product));
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

// ---------- Autopilot ----------
// Products with photos get 3 Pins (each its own design, photo and, when
// possible, board). Approved Pins are then scheduled by these rules:
// at most one Pin per product per day, the daily limit, the minimum
// interval, 9 am to 9 pm New York time, and never the same product on the
// same board within 7 days (that Pin waits).
const OPEN_HOUR = 9,
  CLOSE_HOUR = 21,
  NY = "America/New_York";
// Built once: creating a formatter per call made planning slow.
const NY_HOUR = new Intl.DateTimeFormat("en-US", { timeZone: NY, hour: "numeric", hourCycle: "h23" });
const NY_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: NY });
function nyHour(t: number) {
  return Number(NY_HOUR.format(t));
}
function nyDay(t: number) {
  return NY_DAY.format(t);
}
// Next moment inside the posting window, in 15-minute steps.
function inWindow(t: number) {
  for (let i = 0; i < 200 && (nyHour(t) < OPEN_HOUR || nyHour(t) >= CLOSE_HOUR); i++)
    t += 15 * 60000;
  return t;
}
// Start of the posting window on the next New York day.
function nextDayOpen(t: number) {
  const day = nyDay(t);
  let x = t;
  for (let i = 0; i < 200 && nyDay(x) === day; i++) x += 15 * 60000;
  return inWindow(x);
}

export async function autopilot(uid: string) {
  const s = await getSettings(uid);
  if (s.mode === "autopilot" && s.autopilot_enabled) {
    await autoGenerate(uid);
    // With review on, only Pins you approved are scheduled; with it off,
    // the new drafts are approved here first.
    if (!s.require_approval) await approveDrafts(uid);
  }
  // Approved Pins that had to wait (same board within 7 days, full days)
  // are placed as soon as the rules allow, in every mode.
  await scheduleApproved(uid, s);
}

// New products with at least one photo and no Pins yet: 3 Pins each,
// spread over the boards that fit (see generate). Five products per run at most.
async function autoGenerate(uid: string) {
  const sb = admin();
  const [products, used] = await Promise.all([
    sb.from("products").select("*").eq("user_id", uid).order("created_at").limit(1000),
    sb.from("creatives").select("product_id").eq("user_id", uid).limit(10000),
  ]);
  const done = new Set((check(used) as { product_id: string }[]).map((c) => c.product_id));
  const fresh = (check(products) as Product[])
    .filter((p) => !done.has(p.id) && (p.images?.length || 0) > 0)
    .slice(0, 5);
  for (const p of fresh) {
    if (!check(await sb.rpc("reserve_generation", { p_user: uid, p_auto: false }))) return;
    await generate(uid, p.id, true, true);
  }
}

async function approveDrafts(uid: string) {
  const drafts = check(
    await admin()
      .from("creatives")
      .select("id")
      .eq("user_id", uid)
      .eq("status", "draft")
      .order("created_at")
      .limit(60),
  ) as { id: string }[];
  let approved = 0;
  for (const d of drafts) {
    try {
      await approve(uid, d.id);
      approved++;
    } catch {
      /* A Pin that cannot be approved (e.g. no board) stays in review. */
    }
  }
  return approved;
}

// "Aprobar todo": approve every Pin in review and plan them right away.
export async function approveAll(uid: string) {
  const approved = await approveDrafts(uid);
  const scheduled = await scheduleApproved(uid, await getSettings(uid));
  return { approved, scheduled };
}

type Slot = { at: number; product: string; board: string | null; live: boolean };
// Plans approved Pins for the next 24 hours only; the rest wait approved and
// are planned on a later run. That way a product added tomorrow still gets
// its first Pin before older products get their second or third.
export async function scheduleApproved(uid: string, s: Settings) {
  const sb = admin();
  const since = new Date(Date.now() - 8 * 86400000).toISOString();
  const [approvedRes, queueRes, pubsRes, allPubsRes] = await Promise.all([
    sb.from("creatives").select("id,product_id,board_id,created_at").eq("user_id", uid).eq("status", "approved").order("created_at").limit(60),
    sb.from("publication_queue").select("scheduled_at,started_at,status,creative_id").eq("user_id", uid).in("status", ["pending", "processing", "published", "uncertain"]).gte("scheduled_at", since),
    sb.from("publications").select("product_id,board_id,published_at").eq("user_id", uid).gte("published_at", since),
    sb.from("publications").select("product_id").eq("user_id", uid).limit(10000),
  ]);
  const approved = check(approvedRes) as Pick<Creative, "id" | "product_id" | "board_id">[];
  if (!approved.length) return 0;
  const queue = check(queueRes) as { scheduled_at: string; started_at: string | null; status: string; creative_id: string }[];
  const pubs = check(pubsRes) as { product_id: string; board_id: string; published_at: string }[];
  const ids = [...new Set(queue.map((q) => q.creative_id))];
  const owners = ids.length
    ? (check(await sb.from("creatives").select("id,product_id,board_id").in("id", ids)) as { id: string; product_id: string; board_id: string | null }[])
    : [];
  const slots: Slot[] = queue.map((q) => {
    const o = owners.find((x) => x.id === q.creative_id);
    return {
      at: Date.parse(q.started_at || q.scheduled_at),
      product: o?.product_id || "",
      board: o?.board_id || null,
      live: q.status !== "published",
    };
  });
  // How many Pins each product already has out: published or waiting.
  const out = new Map<string, number>();
  const bump = (product: string) => out.set(product, (out.get(product) || 0) + 1);
  for (const x of check(allPubsRes) as { product_id: string }[]) bump(x.product_id);
  for (const x of slots) if (x.live && x.product) bump(x.product);

  const gap = s.min_interval_minutes * 60000;
  const week = 7 * 86400000;
  const horizon = Date.now() + 86400000;
  const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
  let scheduled = 0;
  const left = [...approved];
  while (left.length) {
    // New products first: the Pin whose product has the fewest Pins out.
    // The sort is stable, so ties keep the oldest Pin first.
    left.sort((a, b) => (out.get(a.product_id) || 0) - (out.get(b.product_id) || 0));
    const c = left.shift()!;
    if (!c.board_id) continue;
    // Same product on the same board: one at a time, then a 7-day pause.
    const sameBoard = (x: { product: string; board: string | null }) =>
      x.product === c.product_id && x.board === c.board_id;
    if (slots.some((x) => sameBoard(x) && x.live)) continue;
    if (pubs.some((x) => x.product_id === c.product_id && x.board_id === c.board_id && Date.parse(x.published_at) > Date.now() - week))
      continue;
    let t = inWindow(Date.now() + 2 * 60000);
    let found: number | null = null;
    for (let i = 0; i < 500 && t < horizon; i++) {
      t = inWindow(t);
      const clash = slots.find((x) => Math.abs(x.at - t) < gap);
      if (clash) {
        t = clash.at + gap + 60000;
        continue;
      }
      // Daily limit on the New York day.
      if (slots.filter((x) => nyDay(x.at) === nyDay(t)).length >= s.daily_limit) {
        t = nextDayOpen(t);
        continue;
      }
      // The database also counts the UTC day; never ask it for a slot it refuses.
      if (slots.filter((x) => utcDay(x.at) === utcDay(t)).length >= s.daily_limit) {
        const d = new Date(t);
        d.setUTCDate(d.getUTCDate() + 1);
        d.setUTCHours(0, 5, 0, 0);
        t = d.getTime();
        continue;
      }
      if (slots.some((x) => x.product === c.product_id && nyDay(x.at) === nyDay(t))) {
        t = nextDayOpen(t);
        continue;
      }
      found = t;
      break;
    }
    if (found === null || found >= horizon) continue;
    try {
      await enqueue(uid, c.id, new Date(found).toISOString());
      slots.push({ at: found, product: c.product_id, board: c.board_id, live: true });
      bump(c.product_id);
      scheduled++;
    } catch {
      /* Rejected by a database rule; the next run tries again. */
    }
  }
  return scheduled;
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
