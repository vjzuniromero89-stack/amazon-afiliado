import type { Metadata } from "next";
import "./globals.css";

// With two root layouts (the panel and the shop) there is no single layout
// for URLs that match no route. Both domains can land here (the proxy skips
// /finds/... paths), so the page names neither: English with the Spanish
// line below, and "/" is the shop on ivethskin.com and the panel elsewhere.
export const metadata: Metadata = { title: "Page not found" };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main className="loading-page">
          <h1>Page not found</h1>
          <p lang="es">Esta página no existe.</p>
          <a href="/">Go to the home page</a>
        </main>
      </body>
    </html>
  );
}
