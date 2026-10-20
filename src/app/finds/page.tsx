import type { Metadata } from "next";
import { shopItems } from "@/lib/server/shop";
import styles from "./finds.module.css";
import { Tabs } from "./tabs";
import { AdBar, Arrow, Chip, colors, family, Footer, Mark, newIds, slug } from "./ui";

// Public page for the bio links (TikTok, Instagram, Facebook, Pinterest) and
// for ads: our own page first, then the store. Rebuilt every 10 minutes.
export const revalidate = 600;

const TITLE = "Ivethskin Finds · Home, skincare, style & gift ideas";
const DESCRIPTION =
  "Everyday home, skincare, style and gift finds, sorted by color, with my own photos and the real label details.";
// The home page shows the newest finds; each color has its own page.
const NEWEST = 8;

export async function generateMetadata(): Promise<Metadata> {
  const first = (await shopItems())[0];
  return {
    metadataBase: new URL("https://ivethskin.com"),
    alternates: { canonical: "/" },
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: "/",
      siteName: "Ivethskin Finds",
      type: "website",
      images: first ? [`/finds/img/${first.id}`] : [],
    },
  };
}

export default async function Finds() {
  const items = await shopItems();
  const categories = [...new Set(items.map((i) => i.category))];
  const fresh = newIds(items);
  const newest = [...items].sort((a, b) => b.added.localeCompare(a.added)).slice(0, NEWEST);
  return (
    <>
      <AdBar />
      <header className={`${styles.wrap} ${styles.top}`} id="top">
        <Mark categories={categories} />
        <h1>Everyday finds, sorted by color.</h1>
        <p className={styles.lede}>
          My own photos, the real label details and a link to the store. Pick a color to start.
        </p>
      </header>

      {items.length === 0 && <p className={`${styles.wrap} ${styles.empty}`}>New finds are coming soon.</p>}

      {categories.length > 0 && (
        <nav className={`${styles.wrap} ${styles.rack}`} aria-label="Categories">
          {categories.map((c) => {
            const mine = items.filter((i) => i.category === c);
            return (
              <a key={c} className={styles.strip} href={`/c/${slug(c)}`} style={colors(c)}>
                <span className={styles.s1}>{c}</span>
                <span className={styles.s2}>
                  <em>{mine.map((i) => i.short).join(" · ")}</em>
                </span>
                <span className={styles.s3}>
                  {mine.length} {mine.length === 1 ? "find" : "finds"} <Arrow />
                </span>
              </a>
            );
          })}
        </nav>
      )}

      {categories.length > 1 && (
        <Tabs
          current=""
          categories={categories.map((c) => ({ id: slug(c), label: family(c).tab, ...family(c) }))}
        />
      )}

      {newest.length > 0 && (
        <main className={`${styles.wrap} ${styles.room}`} aria-labelledby="h-newest">
          <div className={styles.band} style={{ "--tone": "#16161b", "--deep": "#ffffff" } as React.CSSProperties}>
            <div>
              <h2 id="h-newest">Newest finds</h2>
              <p>
                {items.length} {items.length === 1 ? "find" : "finds"} in all
              </p>
            </div>
          </div>
          <div className={styles.rows}>
            {newest.map((i) => (
              <Chip key={i.id} item={i} isNew={fresh.has(i.id)} />
            ))}
          </div>
          {items.length > newest.length && (
            <p className={styles.more}>Pick a color above to see every find in it.</p>
          )}
        </main>
      )}

      <Footer categories={categories} />
    </>
  );
}
