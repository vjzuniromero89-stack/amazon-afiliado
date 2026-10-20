import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
// Public shop domains show only the finds page, never the private app.
const SHOP_HOSTS = (process.env.SHOP_HOSTS || "ivethskin.com,www.ivethskin.com,ivethskin.vercel.app")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase();
  if (SHOP_HOSTS.includes(host))
    return NextResponse.rewrite(new URL("/finds", request.url));
  let response = NextResponse.next({ request });
  // Same rule as db.ts: the original database only as a complete set.
  const original =
    process.env.AFILIADO_SUPABASE_URL &&
    process.env.AFILIADO_SUPABASE_PUBLISHABLE_KEY &&
    process.env.AFILIADO_SUPABASE_SECRET_KEY;
  const url = original
      ? process.env.AFILIADO_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    key = original
      ? process.env.AFILIADO_SUPABASE_PUBLISHABLE_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await sb.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/artwork|api/product-image|finds).*)",
  ],
};
