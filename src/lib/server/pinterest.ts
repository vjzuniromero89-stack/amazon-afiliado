import "server-only";
import { z } from "zod";
import { admin, AppError, check, env } from "./db";
import { encrypt, decrypt } from "./crypto";
// Trial access only works against the sandbox host, and a sandbox call needs a
// token issued by the sandbox host too: production tokens get a 401 there.
const API =
  process.env.PINTEREST_SANDBOX === "true"
    ? "https://api-sandbox.pinterest.com/v5"
    : "https://api.pinterest.com/v5";
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  refresh_token_expires_in: z.number().optional(),
  scope: z.string().optional(),
});
export class PinterestError extends AppError {
  constructor(public code: number) {
    super(
      `Pinterest respondió ${code}. ${code === 401 ? "Vuelve a conectar tu cuenta." : code === 429 ? "Límite de solicitudes alcanzado." : "Comprueba los permisos y el registro de publicación."}`,
      502,
    );
  }
}
export async function exchange(params: Record<string, string>) {
  const response = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env("PINTEREST_APP_ID")}:${env("PINTEREST_APP_SECRET")}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) throw new PinterestError(response.status);
  return tokenSchema.parse(await response.json());
}
export async function saveTokens(
  uid: string,
  t: z.infer<typeof tokenSchema>,
  previousRefresh?: string,
) {
  check(
    await admin()
      .from("pinterest_connections")
      .upsert(
        {
          user_id: uid,
          access_token: encrypt(t.access_token),
          refresh_token: t.refresh_token
            ? encrypt(t.refresh_token)
            : previousRefresh,
          expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
          scope: t.scope || "",
          refresh_lock_until: null,
        },
        { onConflict: "user_id" },
      ),
  );
}
export async function token(uid: string): Promise<string> {
  const sb = admin();
  const row = check(
    await sb
      .from("pinterest_connections")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle(),
  );
  if (!row) throw new AppError("Conecta Pinterest desde Settings.");
  if (Date.parse(row.expires_at) > Date.now() + 120000)
    return decrypt(row.access_token);
  if (!row.refresh_token) throw new AppError("Vuelve a conectar Pinterest.");
  const locked = check(
    await sb
      .from("pinterest_connections")
      .update({
        refresh_lock_until: new Date(Date.now() + 60000).toISOString(),
      })
      .eq("user_id", uid)
      .or(
        `refresh_lock_until.is.null,refresh_lock_until.lt.${new Date().toISOString()}`,
      )
      .select("user_id"),
  );
  if (!locked.length)
    throw new AppError(
      "Se está renovando la conexión. Reintenta en un minuto.",
      409,
    );
  try {
    const t = await exchange({
      grant_type: "refresh_token",
      refresh_token: decrypt(row.refresh_token),
    });
    await saveTokens(uid, t, row.refresh_token);
    return t.access_token;
  } catch (e) {
    check(
      await sb
        .from("pinterest_connections")
        .update({ refresh_lock_until: null })
        .eq("user_id", uid),
    );
    throw e;
  }
}
export async function pinterest<T>(
  uid: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const access = await token(uid);
  return pinterestWithToken<T>(access, path, init);
}
export async function pinterestWithToken<T>(
  access: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new PinterestError(res.status);
  return (await res.json()) as T;
}
export async function syncBoards(uid: string) {
  let bookmark: string | undefined;
  let count = 0;
  const seen: string[] = [];
  do {
    const page = await pinterest<{
      items: { id: string; name: string }[];
      bookmark?: string;
    }>(
      uid,
      // Sandbox can return empty pages before its boards; 250 is the maximum.
      `/boards?page_size=250${bookmark ? "&bookmark=" + encodeURIComponent(bookmark) : ""}`,
    );
    seen.push(...page.items.map((b) => b.id));
    if (page.items.length)
      check(
        await admin()
          .from("boards")
          .upsert(
            page.items.map((b) => ({
              user_id: uid,
              pinterest_id: b.id,
              name: b.name,
              archived: false,
            })),
            { onConflict: "user_id,pinterest_id" },
          ),
      );
    count += page.items.length;
    bookmark = page.bookmark || undefined;
    if (count > 10000)
      throw new AppError(
        "Demasiados boards para sincronizar en una solicitud.",
      );
  } while (bookmark);
  await archiveMissingBoards(uid, seen);
  return count;
}
// Boards the connected account no longer has (Sandbox boards after the move
// to production, or boards deleted on Pinterest) are archived and unlinked
// from Pins that have not been published, so nothing tries to post there.
async function archiveMissingBoards(uid: string, seen: string[]) {
  const sb = admin();
  const local = check(
    await sb.from("boards").select("id,pinterest_id,archived").eq("user_id", uid),
  ) as { id: string; pinterest_id: string; archived: boolean | null }[];
  const gone = local
    .filter((b) => !b.archived && !seen.includes(b.pinterest_id))
    .map((b) => b.id);
  if (!gone.length) return;
  check(
    await sb
      .from("affiliate_configuration")
      .update({ default_board_id: null })
      .eq("user_id", uid)
      .in("default_board_id", gone),
  );
  check(
    await sb
      .from("creatives")
      .update({ board_id: null })
      .eq("user_id", uid)
      .in("board_id", gone)
      .in("status", ["draft", "approved", "rejected"]),
  );
  check(
    await sb.from("boards").update({ archived: true }).eq("user_id", uid).in("id", gone),
  );
}
