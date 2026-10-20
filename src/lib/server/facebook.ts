import "server-only";
import { admin, AppError, check, env, owned } from "./db";
import { getSettings } from "./data";
import { pinExtras, parseTitle } from "./generation";
import { cleanProductName, detectCategory, storeDisclosure, storeOf } from "../domain";
import { nyDate, nyTime, TAGS, VIDEO_BUCKET } from "./instagram";
import type { Product } from "../types";

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
  if (!res.ok) throw new AppError(`Facebook: ${body.error?.message || res.statusText}`);
  return body;
}

const get = <T,>(path: string, params: Record<string, string>) =>
  fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`).then((r) => json<T>(r));
const post = <T,>(path: string, params: Record<string, string>) =>
  fetch(`${GRAPH}${path}`, { method: "POST", body: new URLSearchParams(params) }).then((r) => json<T>(r));

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
    check(
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

type Post = { id: string; product_id: string; kind: string; status: string; video_id: string | null; attempts: number; created_at: string };
type VideoStatus = {
  status?: {
    video_status?: string;
    processing_phase?: { status?: string; error?: { message?: string } };
    publishing_phase?: { status?: string; errors?: { message?: string }[] };
  };
  permalink_url?: string;
};

// One step per cron run: a link post goes out at once; a Reel is uploaded
// by URL, then checked until Facebook finishes publishing it.
export async function publishFacebook(uid: string) {
  const c = await connection(uid);
  if (!c) return { status: "idle" };
  const sb = admin();
  await planLinks(uid).catch(() => undefined);
  const { data, error } = await sb
    .from("facebook_posts")
    .select("*")
    .eq("user_id", uid)
    .in("status", ["pending", "processing"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(3);
  if (error || !data?.length) return { status: "idle" };
  const token = c.access_token;
  const done: string[] = [];
  for (const row of data as Post[]) {
    const update = async (fields: Record<string, unknown>) =>
      check(await sb.from("facebook_posts").update(fields).eq("id", row.id).select("id"));
    const fail = async (msg: string) => {
      const attempts = row.attempts + 1;
      await update({ attempts, error: msg.slice(0, 500), ...(attempts >= 3 ? { status: "failed" } : {}) });
    };
    try {
      if (row.status === "pending" && row.kind === "link") {
        const p = (await owned("products", row.product_id, uid)) as Product;
        const s = await getSettings(uid);
        const made = await post<{ id: string }>(`/${c.page_id}/feed`, {
          message: linkMessage(p, s.disclosure),
          link: shopLink(p.id),
          access_token: token,
        });
        await update({
          status: "published",
          post_id: made.id,
          permalink: `https://www.facebook.com/${made.id}`,
          published_at: new Date().toISOString(),
          error: null,
        });
        done.push(`${row.id}:published`);
        continue;
      }
      if (row.status === "pending") {
        const p = (await owned("products", row.product_id, uid)) as Product;
        if (!p.video_path) {
          await fail("El producto ya no tiene video.");
          continue;
        }
        const signed = await sb.storage.from(VIDEO_BUCKET).createSignedUrl(p.video_path, 2 * 3600);
        if (signed.error || !signed.data) throw new AppError("No se pudo leer el video.");
        const s = await getSettings(uid);
        const start = await post<{ video_id: string }>(`/${c.page_id}/video_reels`, {
          upload_phase: "start",
          access_token: token,
        });
        const up = await fetch(`https://rupload.facebook.com/video-upload/v26.0/${start.video_id}`, {
          method: "POST",
          headers: { Authorization: `OAuth ${token}`, file_url: signed.data.signedUrl },
        }).then((r) => json<{ success?: boolean }>(r));
        if (!up.success) throw new AppError("Facebook no aceptó el video.");
        await post(`/${c.page_id}/video_reels`, {
          upload_phase: "finish",
          video_id: start.video_id,
          video_state: "PUBLISHED",
          description: reelDescription(p, s.disclosure),
          access_token: token,
        });
        await update({ status: "processing", video_id: start.video_id });
        done.push(`${row.id}:started`);
        continue;
      }
      const v = await get<VideoStatus>(`/${row.video_id}`, { fields: "status,permalink_url", access_token: token });
      const st = v.status || {};
      const problem =
        st.processing_phase?.error?.message ||
        st.publishing_phase?.errors?.[0]?.message ||
        (st.video_status === "error" ? "Facebook no pudo procesar el video." : "");
      if (problem) {
        await update({ status: "failed", error: `Facebook: ${problem}`.slice(0, 500) });
        continue;
      }
      if (st.publishing_phase?.status !== "complete") {
        if (Date.now() - Date.parse(row.created_at) > 6 * 3600e3) await fail("Facebook tardó demasiado en publicar el video.");
        continue;
      }
      const link = v.permalink_url || "";
      await update({
        status: "published",
        post_id: row.video_id,
        permalink: link ? (link.startsWith("http") ? link : `https://www.facebook.com${link}`) : null,
        published_at: new Date().toISOString(),
        error: null,
      });
      done.push(`${row.id}:published`);
    } catch (e) {
      await fail(e instanceof Error ? e.message : "Error de Facebook");
    }
  }
  return { status: done.length ? "worked" : "waiting", done };
}
