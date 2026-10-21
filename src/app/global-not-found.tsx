import type { Metadata } from "next";
import "./globals.css";

// With two root layouts (the panel and the shop) there is no single layout
// for URLs that match no route. Shop domains never get here: proxy.ts sends
// every unknown shop path to the finds page. So this is the panel's page.
export const metadata: Metadata = { title: "Página no encontrada" };

export default function GlobalNotFound() {
  return (
    <html lang="es">
      <body>
        <main className="loading-page">
          <h1>Esta página no existe</h1>
          <a href="/">Volver al Dashboard</a>
        </main>
      </body>
    </html>
  );
}
