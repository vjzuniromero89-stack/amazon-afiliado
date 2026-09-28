import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  admin,
  check,
  env,
  errorResponse,
  originGuard,
  userId,
} from "@/lib/server/db";
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
    (await cookies()).set("pinterest_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    const url = new URL("https://www.pinterest.com/oauth/");
    url.search = new URLSearchParams({
      client_id: env("PINTEREST_APP_ID"),
      redirect_uri: env("PINTEREST_REDIRECT_URI"),
      response_type: "code",
      scope: "boards:read,boards:write,pins:read,pins:write,user_accounts:read",
      state,
    }).toString();
    return Response.json({ url: url.toString() });
  } catch (e) {
    return errorResponse(e);
  }
}
