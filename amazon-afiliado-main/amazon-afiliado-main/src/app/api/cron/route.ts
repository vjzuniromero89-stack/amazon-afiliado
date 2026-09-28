import { admin, check, env, errorResponse } from "@/lib/server/db";
import { safeEqual } from "@/lib/server/crypto";
import { autopilot, publishNext, syncAnalytics } from "@/lib/server/operations";
export const maxDuration = 300;
export async function GET(req: Request) {
  try {
    if (
      !safeEqual(
        req.headers.get("authorization") || "",
        `Bearer ${env("CRON_SECRET")}`,
      )
    )
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const sb = admin();
    check(
      await sb
        .from("oauth_states")
        .delete()
        .lt("expires_at", new Date().toISOString()),
    );
    const users = check(
      await sb
        .from("affiliate_configuration")
        .select("user_id")
        .order("created_at")
        .limit(50),
    );
    let completed = 0,
      failed = 0;
    const started = Date.now();
    for (const u of users) {
      if (Date.now() - started > 220000) break;
      try {
        await autopilot(u.user_id);
      } catch {
        failed++;
      }
      try {
        await publishNext(u.user_id);
        await syncAnalytics(u.user_id, 2);
        completed++;
      } catch {
        failed++;
      }
    }
    return Response.json({ completed, failed, accounts: users.length });
  } catch (e) {
    return errorResponse(e);
  }
}
