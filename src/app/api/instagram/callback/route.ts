import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { admin, AppError, check, env, userId } from "@/lib/server/db";
import { safeEqual } from "@/lib/server/crypto";
import { connect } from "@/lib/server/instagram";
export async function GET(req: Request) {
  try {
    const uid = await userId();
    const url = new URL(req.url),
      state = url.searchParams.get("state") || "",
      // Instagram appends "#_" to the code.
      code = (url.searchParams.get("code") || "").replace(/#_$/, "");
    const jar = await cookies();
    const stored = jar.get("instagram_state")?.value || "";
    jar.delete("instagram_state");
    if (!safeEqual(state, stored) || !code) throw new AppError("OAuth inválido");
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
    await connect(uid, code);
    return Response.redirect(new URL("/settings?instagram=success", env("APP_URL")));
  } catch (e) {
    console.log("instagram connect failed:", e instanceof Error ? e.message : e);
    return Response.redirect(new URL("/settings?instagram=error", env("APP_URL")));
  }
}
