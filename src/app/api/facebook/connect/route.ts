import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { admin, check, errorResponse, originGuard, userId } from "@/lib/server/db";
import { authorizeUrl } from "@/lib/server/facebook";
export async function POST(req: Request) {
  try {
    originGuard(req);
    const uid = await userId();
    const state = randomBytes(32).toString("hex");
    check(
      await admin()
        .from("oauth_states")
        .insert({
          state_hash: createHash("sha256").update(state).digest("hex"),
          user_id: uid,
          expires_at: new Date(Date.now() + 600000).toISOString(),
        }),
    );
    (await cookies()).set("facebook_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return Response.json({ url: authorizeUrl(state) });
  } catch (e) {
    return errorResponse(e);
  }
}
