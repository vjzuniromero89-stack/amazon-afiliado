import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { admin, AppError, check, env, userId } from "@/lib/server/db";
import { safeEqual } from "@/lib/server/crypto";
import { exchange, saveTokens } from "@/lib/server/pinterest";
export async function GET(req: Request) {
  try {
    const uid = await userId();
    const url = new URL(req.url),
      state = url.searchParams.get("state") || "",
      code = url.searchParams.get("code");
    const jar = await cookies();
    const stored = jar.get("pinterest_state")?.value || "";
    jar.delete("pinterest_state");
    if (!safeEqual(state, stored) || !code)
      throw new AppError("OAuth inválido");
    const rows = check(
      await admin()
        .from("oauth_states")
        .delete()
        .eq("state_hash", createHash("sha256").update(state).digest("hex"))
        .eq("user_id", uid)
        .gt("expires_at", new Date().toISOString())
        .select("user_id"),
    );
    if (rows.length !== 1) throw new AppError("OAuth expirado");
    const tokens = await exchange({
      grant_type: "authorization_code",
      code,
      redirect_uri: env("PINTEREST_REDIRECT_URI"),
      continuous_refresh: "true",
    });
    await saveTokens(uid, tokens);
    return Response.redirect(
      new URL("/settings?connection=success", env("APP_URL")),
    );
  } catch {
    return Response.redirect(
      new URL("/settings?connection=error", env("APP_URL")),
    );
  }
}
