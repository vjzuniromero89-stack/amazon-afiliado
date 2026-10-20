// ivethskin.com/robots.txt: everything public may be indexed.
export function GET() {
  return new Response("User-agent: *\nAllow: /\n\nSitemap: https://ivethskin.com/sitemap.xml\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
