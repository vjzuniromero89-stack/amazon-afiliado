import "server-only";
import { admin, AppError, check, checkNew, env, owned } from "./db";
import { getSettings } from "./data";
import { pinExtras, parseTitle } from "./generation";
import { cleanProductName, detectCategory, storeDisclosure, storeOf } from "../domain";
import { nyDate, nyTime, TAGS, VIDEO_BUCKET } from "./instagram";
import type { Product } from "../types";
import { ageSinceDue, facebookReelNext, type FbVideoStatus, MaybeSent, releaseFields, sendOnce, uncertainFields } from "../social-outcome";

// Facebook Page through the same Meta app: each product's video as a Reel
// and a daily post whose link card opens the product page on ivethskin.com.
const GRAPH = "https://graph.facebook.com/v26.0";
const SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts";
const appId = () => process.env.FACEBOOK_APP_ID || "1913397089654033";
const redirectUri = () => new URL("/api/facebook/callback", env("APP_URL")).toString();
const shopLink = (id: string) => `https://ivethskin.com/p/${id}`;

export function authorizeUrl(state: string) {
  const url = new URL("https://www.facebook.com/v26.0/dialog/oauth");
  // Facebook Login for Business takes a configuration id instead of scopes:
  // "Publicar en la pagina" in the Meta app asks for the Page permissions.
  const config = process.env.FACEBOOK_LOGIN_CONFIG_ID || "1129158039561235";
  url.search = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    state,
    ...(config ? { config_id: config } : { scope: SCOPES }),
  }).toString();
  return url.toString();
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  // The HTTP status tells a refusal (4xx) from a server error (5xx).
  if (!res.ok) throw new AppError(`Facebook: ${body.error?.message || res.statusText}`, res.status);
  return body;
}

const get = <T,>(path: string, params: Record<string, string>) =>
  fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`).then((r) => json<T>(r));
const post = <T,>(path: string, params: Record<string, string>, signal?: AbortSignal) =>
  fetch(`${GRAPH}${path}`, { method: "POST", body: new URLSearchParams(params), signal }).then((r) => json<T>(r));

// Code -> user token -> long-lived user token -> the Page's own token, which
// does not expire while the owner keeps the app authorized.
export async function connect(uid: string, code: string) {
  const secret = env("FACEBOOK_APP_SECRET");
  const short = await get<{ access_token: string }>("/oauth/access_token", {
    client_id: appId(),
    client_secret: secret,
    redirect_uri: redirectUri(),
    code,
  });
  const long = await get<{ access_token: string }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId(),
    client_secret: secret,
    fb_exchange_token: short.access_token,
  });
  const pages = await get<{ data: { id: string; name: string; access_token: string; tasks?: string[] }[] }>(
    "/me/accounts",
    { fields: "id,name,access_token,tasks", limit: "100", access_token: long.access_token },
  );
  const canPost = pages.data.filter((p) => !p.tasks || p.tasks.includes("CREATE_CONTENT"));
  const page = canPost.find((p) => /glow/i.test(p.name)) || canPost[0];
  if (!page) throw new AppError("Ninguna página de Facebook permite publicar con esta cuenta.");
  check(
    await admin()
      .from("facebook_connections")
      .upsert({
        user_id: uid,
        page_id: page.id,
        page_name: page.name,
        access_token: page.access_token,
        updated_at: new Date().toISOString(),
      })
      .select("user_id"),
  );
  await backfillReels(uid).catch(() => undefined);
  return page.name;
}

type Connection = { page_id: string; page_name: string; access_token: string; auto_posts: boolean };

export async function connection(uid: string) {
  const { data, error } = await admin().from("facebook_connections").select("*").eq("user_id", uid).maybeSingle();
  // A database without the Facebook migration simply has no connection.
  if (error) return null;
  return data as Connection | null;
}

const productName = (p: Product) => parseTitle(cleanProductName(p.title)).short || cleanProductName(p.title);

// #ad first (FTC), the label facts, a link Facebook makes clickable, the
// store's own statement. The Pages API has no AI label, so the text says it.
export function reelDescription(p: Product, amazonDisclosure: string) {
  const facts = pinExtras(p).perks;
  const category = detectCategory(p.title, p.category || "");
  const disclosure = storeDisclosure(storeOf(p), amazonDisclosure).replace(/\s*#ad\b/i, "").trim();
  return [
    `#ad ${productName(p)}${facts.length ? ` · ${facts.join(" · ")}` : ""}`,
    `Shop it here: ${shopLink(p.id)}`,
    `${disclosure} Made with AI.`,
    `#amazonfinds ${TAGS[category] || ""}`.trim(),
  ].join("\n\n");
}

function linkMessage(p: Product, amazonDisclosure: string) {
  const facts = pinExtras(p).perks;
  const disclosure = storeDisclosure(storeOf(p), amazonDisclosure).replace(/\s*#ad\b/i, "").trim();
  return [
    `#ad ${productName(p)} ✨`,
    facts.length ? facts.join(" · ") : "",
    "Photos and details here 👇",
    `${disclosure} Images made with AI.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// One Reel per product, the same video Instagram gets.
export async function queueFacebookReel(uid: string, productId: string, at?: string) {
  const sb = admin();
  const p = (await owned("products", productId, uid)) as Product;
  if (!p.video_path || !(await connection(uid))) return false;
  const { data: had } = await sb
    .from("facebook_posts")
    .select("id")
    .eq("user_id", uid)
    .eq("product_id", productId)
    .eq("kind", "reel")
    .limit(1);
  if (had?.length) return true;
  const { error } = await sb
    .from("facebook_posts")
    .insert({ user_id: uid, product_id: productId, kind: "reel", ...(at ? { scheduled_at: new Date(at).toISOString() } : {}) });
  return !error;
}

// On connecting: the products that already have a video get their Reel,
// one a day at 1 pm New York time.
async function backfillReels(uid: string) {
  const products = (
    check(
      await admin().from("products").select("*").eq("user_id", uid).not("video_path", "is", null).order("created_at"),
    ) as Product[]
  ).filter((p) => p.video_path);
  let day = 0;
  for (const p of products) {
    let at = nyTime(nyDate(new Date(Date.now() + day * 864e5)), 13);
    if (at.getTime() < Date.now()) at = nyTime(nyDate(new Date(Date.now() + ++day * 864e5)), 13);
    if (await queueFacebookReel(uid, p.id, at.toISOString())) day++;
  }
}

// A link post today and tomorrow at noon while automatic posts are on: the
// product that went longest without one, never twice within 5 days.
export async function planLinks(uid: string) {
  const c = await connection(uid);
  if (!c || c.auto_posts === false) return;
  const sb = admin();
  const { data: posts, error } = await sb
    .from("facebook_posts")
    .select("kind,product_id,scheduled_at")
    .eq("user_id", uid)
    .eq("kind", "link")
    .gte("scheduled_at", new Date(Date.now() - 30 * 864e5).toISOString());
  if (error) return;
  const rows = (posts || []) as { kind: string; product_id: string; scheduled_at: string }[];
  const products = (
    check(
      await sb.from("products").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
    ) as Product[]
  ).filter((p) => (p.images || []).length);
  if (!products.length) return;
  const last = (id: string) =>
    Math.max(0, ...rows.filter((r) => r.product_id === id).map((r) => Date.parse(r.scheduled_at)));
  for (const offset of [0, 1]) {
    const day = nyDate(new Date(Date.now() + offset * 864e5));
    const at = nyTime(day, 12);
    if (at.getTime() < Date.now()) continue;
    if (rows.some((r) => nyDate(new Date(r.scheduled_at)) === day)) continue;
    const pick = [...products].filter((p) => at.getTime() - last(p.id) > 5 * 864e5).sort((a, b) => last(a.id) - last(b.id))[0];
    if (!pick) continue;
    // One link post per user and time (unique index): a run planning at the
    // same moment may have made it already.
    checkNew(
      await sb
        .from("facebook_posts")
        .insert({ user_id: uid, product_id: pick.id, kind: "link", scheduled_at: at.toISOString() })
        .select("id"),
    );
    rows.push({ kind: "link", product_id: pick.id, scheduled_at: at.toISOString() });
  }
}

// The owner's switch; turning it off drops the link posts not yet out.
export async function setAutoFacebook(uid: string, on: boolean) {
  check(await admin().from("facebook_connections").update({ auto_posts: on }).eq("user_id", uid).select("user_id"));
  if (!on)
    check(
      await admin()
        .from("facebook_posts")
        .delete()
        .eq("user_id", uid)
        .eq("kind", "link")
        .eq("status", "pending")
        .select("id"),
    );
  else await planLinks(uid);
  return on;
}

type Post = {
  id: string;
  product_id: string;
  kind: string;
  status: string;
  video_id: string | null;
  attempts: number;
  created_at: string;
  scheduled_at: string;
  claim_token: string;
  claimed_from: string;
};

// A call that publishes gets a time limit: a hung request becomes "maybe
// sent" instead of using up the whole run.
const SEND_TIMEOUT = 60_000;

// One step per post and run. Each due post is first reserved for this run
// only (claim_facebook_posts: FOR UPDATE SKIP LOCKED), so two runs that
// overlap never handle the same post.
// - A link post is one call that publishes. If it fails in a way that may
//   have published, the post becomes "uncertain" and waits for the owner:
//   there is no id to check, so it is never re-sent on its own.
// - A Reel gets its video id first (nothing public yet) and keeps it: every
//   later try reuses that same video, so it can never become two Reels. The
//   "finish" call publishes; if it may have gone through, the next check
//   asks Facebook for that video's status.
export async function publishFacebook(uid: string) {
  const c = await connection(uid);
  if (!c) return { status: "idle" };
  const sb = admin();
  await planLinks(uid).catch(() => undefined);
  const { data, error } = await sb.rpc("claim_facebook_posts", { p_user: uid, p_limit: 3 });
  if (error || !data?.length) return { status: "idle" };
  const token = c.access_token;
  const done: string[] = [];
  for (const row of data as Post[]) {
    const from = row.claimed_from;
    // Every write is guarded by this run's claim token.
    // A write that finds no row means the claim was taken away: stop here,
    // before uploading or sending anything more for this post.
    const write = async (fields: Record<string, unknown>) => {
      const rows = check(
        await sb
          .from("facebook_posts")
          .update(fields)
          .eq("id", row.id)
          .eq("claim_token", row.claim_token)
          .select("id"),
      );
      if (!rows.length) throw new AppError("This run no longer holds the post.");
    };
    const save = (fields: Record<string, unknown>) => write({ ...fields, claim_token: null });
    const release = (msg: string) => save(releaseFields(from, row.attempts, msg));
    try {
      if (from === "pending" && row.kind === "link") {
        const p = (await owned("products", row.product_id, uid)) as Product;
        const s = await getSettings(uid);
        const made = await sendOnce(
          () =>
            post<{ id: string }>(
              `/${c.page_id}/feed`,
              { message: linkMessage(p, s.disclosure), link: shopLink(p.id), access_token: token },
              AbortSignal.timeout(SEND_TIMEOUT),
            ),
          (r) => Boolean(r?.id),
        );
        await save({
          status: "published",
          post_id: made.id,
          permalink: `https://www.facebook.com/${made.id}`,
          published_at: new Date().toISOString(),
          error: null,
        });
        done.push(`${row.id}:published`);
        continue;
      }

      if (row.kind === "reel" && (from === "pending" || from === "uncertain")) {
        const p = (await owned("products", row.product_id, uid)) as Product;
        if (!p.video_path) {
          await save({ status: "failed", error: "El producto ya no tiene video." });
          continue;
        }
        let videoId = row.video_id;
        let st: FbVideoStatus = {};
        if (videoId) {
          // Already started on an earlier try: look before doing anything.
          st = (await get<{ status?: FbVideoStatus }>(`/${videoId}`, { fields: "status", access_token: token })).status || {};
          const next = facebookReelNext(st, from, ageSinceDue(row));
          if (next.step === "failed") {
            await save({ status: "failed", error: `Facebook: ${next.problem}`.slice(0, 500) });
            continue;
          }
          if (next.step === "published" || st.publishing_phase?.status === "in_progress") {
            // The earlier finish did arrive.
            await save({ status: "processing", error: null });
            done.push(`${row.id}:recovered`);
            continue;
          }
        } else {
          // Starting an upload session does not publish anything.
          const start = await post<{ video_id: string }>(`/${c.page_id}/video_reels`, {
            upload_phase: "start",
            access_token: token,
          });
          if (!start?.video_id) throw new AppError("Facebook no devolvió el video.");
          videoId = start.video_id;
          // Kept at once, so no later try ever starts a second video.
          await write({ video_id: videoId });
        }
        if (st.uploading_phase?.status !== "complete") {
          const signed = await sb.storage.from(VIDEO_BUCKET).createSignedUrl(p.video_path, 2 * 3600);
          if (signed.error || !signed.data) throw new AppError("No se pudo leer el video.");
          const up = await fetch(`https://rupload.facebook.com/video-upload/v26.0/${videoId}`, {
            method: "POST",
            headers: { Authorization: `OAuth ${token}`, file_url: signed.data.signedUrl },
          }).then((r) => json<{ success?: boolean }>(r));
          if (!up.success) throw new AppError("Facebook no aceptó el video.");
        }
        const s = await getSettings(uid);
        // The call that publishes, at most once per claim, always for the same video.
        await sendOnce(
          () =>
            post<{ success?: boolean }>(
              `/${c.page_id}/video_reels`,
              {
                upload_phase: "finish",
                video_id: videoId!,
                video_state: "PUBLISHED",
                description: reelDescription(p, s.disclosure),
                access_token: token,
              },
              AbortSignal.timeout(SEND_TIMEOUT),
            ),
          (r) => r?.success !== false,
        );
        await save({ status: "processing", video_id: videoId, error: null });
        done.push(`${row.id}:started`);
        continue;
      }

      if (from === "uncertain") {
        // A link post: nothing to check, the owner decides.
        await save({ status: "uncertain" });
        continue;
      }

      // "processing": the Reel was sent; wait until Facebook publishes it.
      const v = await get<{ status?: FbVideoStatus; permalink_url?: string }>(`/${row.video_id}`, {
        fields: "status,permalink_url",
        access_token: token,
      });
      const next = facebookReelNext(v.status || {}, from, ageSinceDue(row));
      if (next.step === "failed") {
        await save({ status: "failed", error: `Facebook: ${next.problem}`.slice(0, 500) });
        continue;
      }
      if (next.step === "too-slow") {
        await save({ status: "failed", error: "Facebook tardó demasiado en publicar el video." });
        continue;
      }
      if (next.step !== "published") {
        await save({ status: "processing" });
        continue;
      }
      const link = v.permalink_url || "";
      await save({
        status: "published",
        post_id: row.video_id,
        permalink: link ? (link.startsWith("http") ? link : `https://www.facebook.com${link}`) : null,
        published_at: new Date().toISOString(),
        error: null,
      });
      done.push(`${row.id}:published`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de Facebook";
      await (e instanceof MaybeSent ? save(uncertainFields(msg)) : release(msg)).catch(() => undefined);
    }
  }
  return { status: done.length ? "worked" : "waiting", done };
}
