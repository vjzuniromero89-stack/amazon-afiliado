import "server-only";
import { admin, AppError, check, env, owned } from "./db";
import { getSettings } from "./data";
import { pinExtras, parseTitle } from "./generation";
import { cleanProductName, detectCategory, storeDisclosure, storeOf } from "../domain";
import type { Product } from "../types";

// Instagram API with Instagram Login: a professional account publishes Reels
// straight from the app, no Facebook Page needed.
const GRAPH = "https://graph.instagram.com/v26.0";
export const VIDEO_BUCKET = "product-videos";
const SCOPES = "instagram_business_basic,instagram_business_content_publish";

export function authorizeUrl(state: string) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: env("INSTAGRAM_APP_ID"),
    redirect_uri: env("INSTAGRAM_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES,
    state,
  }).toString();
  return url.toString();
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string } | string;
    error_message?: string;
  };
  if (!res.ok) {
    const e = body.error;
    const msg = typeof e === "string" ? e : e?.message || body.error_message || res.statusText;
    throw new AppError(`Instagram: ${msg}`);
  }
  return body;
}

// Code -> short-lived token -> 60-day token, then the account's own id.
export async function connect(uid: string, code: string) {
  const short = await json<{ access_token: string }>(
    await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: env("INSTAGRAM_APP_ID"),
        client_secret: env("INSTAGRAM_APP_SECRET"),
        grant_type: "authorization_code",
        redirect_uri: env("INSTAGRAM_REDIRECT_URI"),
        code,
      }),
    }),
  );
  const long = await json<{ access_token: string; expires_in: number }>(
    await fetch(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: env("INSTAGRAM_APP_SECRET"),
        access_token: short.access_token,
      })}`,
    ),
  );
  const me = await json<{ user_id: string; username: string }>(
    await fetch(`${GRAPH}/me?${new URLSearchParams({ fields: "user_id,username", access_token: long.access_token })}`),
  );
  check(
    await admin()
      .from("instagram_connections")
      .upsert({
        user_id: uid,
        ig_user_id: String(me.user_id),
        username: me.username || "",
        access_token: long.access_token,
        expires_at: new Date(Date.now() + long.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("user_id"),
  );
  return me.username;
}

type Connection = { ig_user_id: string; username: string; access_token: string; expires_at: string };

export async function connection(uid: string) {
  const { data, error } = await admin()
    .from("instagram_connections")
    .select("ig_user_id,username,access_token,expires_at")
    .eq("user_id", uid)
    .maybeSingle();
  // A database without the Instagram migration simply has no connection.
  if (error) return null;
  return data as Connection | null;
}

// Long-lived tokens last 60 days; refresh once fewer than 10 are left.
async function liveToken(uid: string) {
  const c = await connection(uid);
  if (!c) throw new AppError("Conecta Instagram en Settings.");
  const left = Date.parse(c.expires_at) - Date.now();
  if (left < 0) throw new AppError("La conexión de Instagram venció. Reconéctala en Settings.");
  if (left > 10 * 864e5) return c;
  const r = await json<{ access_token: string; expires_in: number }>(
    await fetch(
      `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: c.access_token,
      })}`,
    ),
  );
  const next = { ...c, access_token: r.access_token, expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() };
  check(
    await admin()
      .from("instagram_connections")
      .update({ access_token: next.access_token, expires_at: next.expires_at, updated_at: new Date().toISOString() })
      .eq("user_id", uid)
      .select("user_id"),
  );
  return next;
}

const TAGS: Record<string, string> = {
  Skincare: "#skincareroutine #skincare",
  "Beauty & Makeup": "#makeup #beautyfinds",
  "Supplements & Wellness": "#wellnessroutine #selfcare",
  "Home Decor & Organization": "#homefinds #homedecor",
  Kitchen: "#kitchenfinds #kitchengadgets",
  "Fashion & Clothing": "#amazonfashion #outfitideas",
  "Fitness & Workout": "#fitnessgear #workout",
  "Tech & Gadgets": "#techfinds #gadgets",
  "Baby & Mom": "#momfinds #babyessentials",
  "Pets & Dogs": "#dogmom #petfinds",
  "Gift Ideas": "#giftideas #giftsforher",
};

// #ad first (FTC), the label facts, where to shop, the store's own statement.
export function reelCaption(p: Product, amazonDisclosure: string) {
  const name = parseTitle(cleanProductName(p.title)).short || cleanProductName(p.title);
  const facts = pinExtras(p).perks;
  const category = detectCategory(p.title, p.category || "");
  const disclosure = storeDisclosure(storeOf(p), amazonDisclosure).replace(/\s*#ad\b/i, "").trim();
  return [
    `#ad ${name}${facts.length ? ` · ${facts.join(" · ")}` : ""}`,
    "Shop it at ivethskin.com (link in bio)",
    disclosure,
    `#amazonfinds ${TAGS[category] || ""}`.trim(),
  ].join("\n\n");
}

// The chain: the first time one of a product's Pins goes out, its video (if
// it has one) follows as a Reel. One Reel per product.
export async function queueReel(uid: string, productId: string) {
  const sb = admin();
  const p = (await owned("products", productId, uid)) as Product;
  if (!p.video_path || !(await connection(uid))) return false;
  const { error } = await sb
    .from("instagram_posts")
    .upsert({ user_id: uid, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  return !error;
}

type Post = { id: string; product_id: string; status: string; container_id: string | null; attempts: number; created_at: string };

// One step per cron run: start a container, or publish one that is ready.
export async function publishReels(uid: string) {
  const sb = admin();
  const { data, error } = await sb
    .from("instagram_posts")
    .select("id,product_id,status,container_id,attempts,created_at")
    .eq("user_id", uid)
    .in("status", ["pending", "processing"])
    .lte("scheduled_at", new Date().toISOString())
    .order("created_at")
    .limit(3);
  if (error || !data?.length) return { status: "idle" };
  const c = await liveToken(uid);
  const done: string[] = [];
  for (const post of data as Post[]) {
    const fail = async (msg: string) => {
      const attempts = post.attempts + 1;
      check(
        await sb
          .from("instagram_posts")
          .update({ attempts, error: msg.slice(0, 500), ...(attempts >= 3 ? { status: "failed" } : {}) })
          .eq("id", post.id)
          .select("id"),
      );
    };
    try {
      if (post.status === "pending") {
        const p = (await owned("products", post.product_id, uid)) as Product;
        if (!p.video_path) {
          await fail("El producto ya no tiene video.");
          continue;
        }
        const signed = await sb.storage.from(VIDEO_BUCKET).createSignedUrl(p.video_path, 2 * 3600);
        if (signed.error || !signed.data) throw new AppError("No se pudo leer el video.");
        const s = await getSettings(uid);
        const made = await json<{ id: string }>(
          await fetch(`${GRAPH}/${c.ig_user_id}/media`, {
            method: "POST",
            body: new URLSearchParams({
              media_type: "REELS",
              video_url: signed.data.signedUrl,
              caption: reelCaption(p, s.disclosure),
              share_to_feed: "true",
              thumb_offset: "1500",
              access_token: c.access_token,
            }),
          }),
        );
        check(
          await sb.from("instagram_posts").update({ status: "processing", container_id: made.id }).eq("id", post.id).select("id"),
        );
        done.push(`${post.id}:started`);
        continue;
      }
      const st = await json<{ status_code: string; status?: string }>(
        await fetch(`${GRAPH}/${post.container_id}?${new URLSearchParams({ fields: "status_code,status", access_token: c.access_token })}`),
      );
      if (st.status_code === "IN_PROGRESS") {
        // Instagram keeps a container for 24 hours; give up after 6.
        if (Date.now() - Date.parse(post.created_at) > 6 * 3600e3) await fail("Instagram tardó demasiado en procesar el video.");
        continue;
      }
      if (st.status_code !== "FINISHED") {
        check(
          await sb
            .from("instagram_posts")
            .update({ status: "failed", error: `Instagram: ${st.status || st.status_code}`.slice(0, 500) })
            .eq("id", post.id)
            .select("id"),
        );
        continue;
      }
      const pub = await json<{ id: string }>(
        await fetch(`${GRAPH}/${c.ig_user_id}/media_publish`, {
          method: "POST",
          body: new URLSearchParams({ creation_id: post.container_id!, access_token: c.access_token }),
        }),
      );
      const info = await json<{ permalink?: string }>(
        await fetch(`${GRAPH}/${pub.id}?${new URLSearchParams({ fields: "permalink", access_token: c.access_token })}`),
      ).catch(() => ({ permalink: undefined }));
      check(
        await sb
          .from("instagram_posts")
          .update({ status: "published", media_id: pub.id, permalink: info.permalink || null, published_at: new Date().toISOString(), error: null })
          .eq("id", post.id)
          .select("id"),
      );
      done.push(`${post.id}:published`);
    } catch (e) {
      await fail(e instanceof Error ? e.message : "Error de Instagram");
    }
  }
  return { status: done.length ? "worked" : "waiting", done };
}
