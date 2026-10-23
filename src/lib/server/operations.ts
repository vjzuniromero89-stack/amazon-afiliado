import "server-only";
import { admin, AppError, check, owned } from "./db";
import { getSettings } from "./data";
import { conceptProvider, pickBoard, pinExtras, rankBoards } from "./generation";
import {
  forStore,
  pinLink,
  storeDisclosure,
  storeOf,
  creativeInput,
  descriptionWithDisclosure,
  pinDailyMetrics,
  accountDailyMetrics,
  TEMPLATES,
} from "../domain";
import { imageProvider } from "./artwork";
import { queueReel } from "./instagram";
import { queueFacebookReel } from "./facebook";
import { channelTags } from "../channels";
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
  // How many Pins to add (to top a product up to 3); all 3 when omitted.
  only?: number,
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
  // Copy written for Amazon ("See it on Amazon") follows the product's store.
  const store = storeOf(p);
  if (store !== "amazon")
    for (const c of concepts) {
      c.title = forStore(c.title, store);
      c.description = forStore(c.description, store);
      c.alt_text = forStore(c.alt_text, store);
      c.cta = forStore(c.cta, store);
      c.keywords = c.keywords.map((k) => forStore(k, store));
    }
  let chosen = concepts;
  if (only !== undefined) {
    // Topping up: prefer a design, board and title the product does not have yet.
    const have = check(
      await sb.from("creatives").select("template,board_id,title").eq("user_id", uid).eq("product_id", productId),
    ) as Pick<Creative, "template" | "board_id" | "title">[];
    const score = (c: (typeof concepts)[number]) =>
      (have.some((h) => h.template === c.template) ? 0 : 2) +
      (have.some((h) => h.board_id === c.board_id) ? 0 : 1) +
      (have.some((h) => h.title === c.title) ? 0 : 1);
    chosen = [...concepts].sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, only));
  }
  if (!chosen.length) return [];
  return check(
    await sb
      .from("creatives")
      .insert(
        chosen.map((c) => ({
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
  pinLink(p, s.tracking_id);
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
  pinLink(product, (await getSettings(uid)).tracking_id);
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
    // Pinterest's own tracking ID when set (AMAZON_CHANNEL_TAGS), so Amazon's
    // reports separate Pin orders from the shop's.
    const link = pinLink(p, channelTags(process.env.AMAZON_CHANNEL_TAGS).pinterest || s.tracking_id);
    // Target and Walmart Pins carry their own disclosure, not Amazon's.
    const ss = { ...s, disclosure: storeDisclosure(storeOf(p), s.disclosure) };
    const png = await imageProvider.render(c, ss, await photoFor(c), pinExtras(p as Product));
    attempted = true;
    const pin = await pinterestWithToken<{ id: string }>(access, "/pins", {
      method: "POST",
      body: JSON.stringify({
        board_id: b.pinterest_id,
        title: c.title,
        description: descriptionWithDisclosure(c, ss),
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
    // The chain: the product's video follows as a Reel (once per product).
    await queueReel(uid, p.id).catch(() => false);
    await queueFacebookReel(uid, p.id).catch(() => false);
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
  // Through today (UTC, Pinterest's day): today's numbers are estimates
  // that the next syncs refine.
  const end = new Date().toISOString().slice(0, 10),
    start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  let count = 0;
  // How Pinterest labeled each day (READY, ESTIMATE, PROCESSING...), so a
  // sync that brings no numbers says why.
  const statuses: Record<string, number> = {};
  const note = (k: string) => (statuses[k] = (statuses[k] || 0) + 1);
  // The whole account first (the button forces it; the cron at most hourly).
  await syncAccount(uid, limit >= 20, start, end).catch((e) =>
    note(`cuenta: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`),
  );
  for (const p of publications) {
    try {
      const response = await pinterest<PinterestAnalytics>(
        uid,
        `/pins/${encodeURIComponent(p.pinterest_id)}/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK`,
      );
      for (const d of response.all?.daily_metrics || []) note(d.data_status || "none");
      // Only days with numbers: a pending (PROCESSING) day or a day before
      // the Pin has none, and storing it would read as a missing day.
      const rows = pinDailyMetrics(response.all?.daily_metrics || [], start, end)
        .filter((r) => r.impressions !== null || r.saves !== null || r.outbound_clicks !== null)
        .map((r) => ({
          ...r,
          user_id: uid,
          publication_id: p.id,
          fetched_at: new Date().toISOString(),
        }));
      if (rows.length)
        check(await sb.from("analytics_metrics").upsert(rows, { onConflict: "publication_id,date" }));
      count += rows.length;
    } catch (e) {
      // Pinterest's rate limit: stop here and leave this Pin unmarked, so the
      // next run asks for it first instead of a full rotation later.
      if (e instanceof PinterestError && e.code === 429) {
        note("límite de Pinterest (429): se sigue en la próxima pasada");
        break;
      }
      // One Pin's failure must not stop the others.
      note(`error: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
    }
    // Always marked, so a Pin without data never holds the queue.
    check(
      await sb
        .from("publications")
        .update({ last_analytics_sync_at: new Date().toISOString() })
        .eq("id", p.id),
    );
  }
  return { rows: count, statuses };
}

// The account's own daily totals: every Pin, also those uploaded straight on
// Pinterest, which the per-Pin sync never sees. At most hourly unless forced.
// Needs the account_analytics table and the user_accounts:read scope; without
// them it throws and syncAnalytics notes why.
async function syncAccount(uid: string, force: boolean, start: string, end: string) {
  const sb = admin();
  const last = check(
    await sb
      .from("account_analytics")
      .select("fetched_at")
      .eq("user_id", uid)
      .order("fetched_at", { ascending: false })
      .limit(1),
  ) as { fetched_at: string }[];
  if (!force && last[0] && Date.now() - Date.parse(last[0].fetched_at) < 3600e3) return;
  const response = await pinterest<PinterestAnalytics>(
    uid,
    `/user_account/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,OUTBOUND_CLICK,SAVE,ENGAGEMENT,PIN_CLICK`,
  );
  const fetched_at = new Date().toISOString();
  const rows = accountDailyMetrics(response.all?.daily_metrics || []).map((r) => ({ ...r, user_id: uid, fetched_at }));
  if (rows.length) check(await sb.from("account_analytics").upsert(rows, { onConflict: "user_id,date" }));
}

// ---------- Autopilot ----------
// Products with photos get 3 Pins (each its own design, photo and, when
// possible, board). Approved Pins are then scheduled by these rules:
// at most one Pin per product per day, the daily limit, the minimum
// interval, 9 am to 9 pm New York time, and never the same product on the
// same board within 7 days (that Pin waits).
const OPEN_HOUR = 9,
  CLOSE_HOUR = 21,
  NY = "America/New_York",
  QUARTER = 15 * 60000;
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
  }
  await alignQueue(uid);
  // Only Pins the user approved one by one get scheduled: Pinterest requires
  // the user to choose each Pin an app publishes.
  // Approved Pins that had to wait (same board within 7 days, full days)
  // are placed as soon as the rules allow, in every mode.
  await scheduleApproved(uid, s);
}

// Products with at least one photo get 3 Pins each (topped up when some were deleted),
// spread over the boards that fit (see generate). Five products per run at most.
async function autoGenerate(uid: string) {
  const sb = admin();
  const [products, used] = await Promise.all([
    sb.from("products").select("*").eq("user_id", uid).order("created_at").limit(1000),
    sb.from("creatives").select("product_id").eq("user_id", uid).limit(10000),
  ]);
  // Pins each product has (any status; deleted ones no longer count).
  const made = new Map<string, number>();
  for (const c of check(used) as { product_id: string }[])
    made.set(c.product_id, (made.get(c.product_id) || 0) + 1);
  // Products with photos and fewer than 3 Pins: new ones first, then the
  // ones to top up (e.g. after test Pins were deleted).
  const todo = (check(products) as Product[])
    .filter((p) => (made.get(p.id) || 0) < 3 && (p.images?.length || 0) > 0)
    .sort((a, b) => (made.get(a.id) || 0) - (made.get(b.id) || 0))
    .slice(0, 5);
  for (const p of todo) {
    if (!check(await sb.rpc("reserve_generation", { p_user: uid, p_auto: false }))) return;
    const n = made.get(p.id) || 0;
    await generate(uid, p.id, true, true, n ? 3 - n : undefined);
  }
}

// One Pin approved by the user (Pinterest requires the user to choose each
// Pin an app publishes), then planned by the same rules as every other Pin.
export async function approveOne(uid: string, id: string) {
  await approve(uid, id);
  await scheduleApproved(uid, await getSettings(uid));
  const job = check(
    await admin()
      .from("publication_queue")
      .select("scheduled_at")
      .eq("user_id", uid)
      .eq("creative_id", id)
      .eq("status", "pending")
      .maybeSingle(),
  ) as { scheduled_at: string } | null;
  return { scheduled_at: job?.scheduled_at || null };
}

// Waiting Pins set off the quarter hour (from before that rule) move to the
// next clock run, e.g. 9:02 -> 9:15, so they go out at the time shown.
// Only ever later, never earlier, so no spacing rule is broken.
async function alignQueue(uid: string) {
  const sb = admin();
  const jobs = check(
    await sb.from("publication_queue").select("id,scheduled_at").eq("user_id", uid).eq("status", "pending"),
  ) as { id: string; scheduled_at: string }[];
  for (const j of jobs) {
    const t = Date.parse(j.scheduled_at);
    const aligned = Math.ceil(t / QUARTER) * QUARTER;
    if (aligned === t) continue;
    check(
      await sb
        .from("publication_queue")
        .update({ scheduled_at: new Date(aligned).toISOString() })
        .eq("id", j.id)
        .eq("user_id", uid)
        .eq("status", "pending")
        .select("id"),
    );
  }
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
  const published = new Map<string, number>();
  for (const x of check(allPubsRes) as { product_id: string }[]) {
    bump(x.product_id);
    published.set(x.product_id, (published.get(x.product_id) || 0) + 1);
  }
  for (const x of slots) if (x.live && x.product) bump(x.product);

  // New products go first: when approved Pins of products with nothing out
  // yet are waiting, the queued 2nd and 3rd Pins of products that already
  // have a Pin on Pinterest give up their place (they stay approved and are
  // planned again right after). Jobs about to run are left alone.
  const newcomers = new Set(approved.filter((c) => !out.get(c.product_id)).map((c) => c.product_id));
  if (newcomers.size) {
    const soon = Date.now() + 10 * 60000;
    const movable = queue
      .filter((q) => q.status === "pending" && !q.started_at && Date.parse(q.scheduled_at) > soon)
      .map((q) => ({ q, o: owners.find((x) => x.id === q.creative_id) }))
      .filter(({ o }) => o && (published.get(o.product_id) || 0) > 0)
      .sort((a, b) => Date.parse(a.q.scheduled_at) - Date.parse(b.q.scheduled_at))
      .slice(0, newcomers.size);
    for (const { q, o } of movable) {
      const moved = check(
        await sb
          .from("publication_queue")
          .update({ status: "cancelled", error: "Moved back so a new product's first Pin goes first." })
          .eq("user_id", uid)
          .eq("creative_id", q.creative_id)
          .eq("status", "pending")
          .is("started_at", null)
          .select("id"),
      ) as { id: string }[];
      if (!moved.length) continue;
      check(await sb.from("creatives").update({ status: "approved" }).eq("id", q.creative_id).eq("user_id", uid).eq("status", "queued").select("id"));
      const at = Date.parse(q.scheduled_at);
      const i = slots.findIndex((x) => x.live && x.at === at && x.product === o!.product_id);
      if (i >= 0) slots.splice(i, 1);
      out.set(o!.product_id, (out.get(o!.product_id) || 1) - 1);
      approved.push({ id: q.creative_id, product_id: o!.product_id, board_id: o!.board_id });
    }
  }

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
      // On the quarter hour, when the clock runs (:00, :15, :30, :45), so a
      // Pin goes out at the time the app shows instead of up to 15 min later.
      t = inWindow(Math.ceil(t / QUARTER) * QUARTER);
      const clash = slots.find((x) => Math.abs(x.at - t) < gap);
      if (clash) {
        t = clash.at + gap;
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
    !(storeOf(p) === "amazon"
      ? pin.link.includes(`/dp/${p.asin}`)
      : pin.link.includes(p.asin.slice(1)))
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
