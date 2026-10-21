import { randomUUID } from "node:crypto";
import { admin, check, env, errorResponse } from "@/lib/server/db";
import { safeEqual } from "@/lib/server/crypto";
import { autopilot, publishNext, syncAnalytics } from "@/lib/server/operations";
import { publishReels } from "@/lib/server/instagram";
import { publishFacebook } from "@/lib/server/facebook";
export const maxDuration = 300;
// A little longer than the longest run; a run that dies frees it on its own.
const LEASE_SECONDS = 330;
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
    // One run at a time: when the external scheduler and Vercel's cron
    // arrive together, the second one skips. Without the lease function
    // (its migration not run yet) the run goes on as before; the per-post
    // claims still keep each post to one run.
    const holder = randomUUID();
    const lease = await sb.rpc("acquire_cron_lease", { p_name: "cron", p_holder: holder, p_seconds: LEASE_SECONDS });
    if (!lease.error && lease.data === false) {
      console.log("cron run: skipped, another run is working");
      return Response.json({ skipped: true });
    }
    try {
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
          await publishReels(u.user_id);
        } catch {
          failed++;
        }
        try {
          await publishFacebook(u.user_id);
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
      // One line per run so the schedule can be checked in Vercel logs.
      console.log(
        `cron run: ${completed} ok, ${failed} failed, ${users.length} accounts${lease.error ? " (no lease: run the cron_lease migration)" : ""}`,
      );
      return Response.json({ completed, failed, accounts: users.length });
    } finally {
      if (!lease.error) await sb.rpc("release_cron_lease", { p_name: "cron", p_holder: holder }).then(undefined, () => undefined);
    }
  } catch (e) {
    return errorResponse(e);
  }
}
