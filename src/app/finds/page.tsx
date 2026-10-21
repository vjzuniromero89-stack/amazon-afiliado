import type { Metadata } from "next";
import { shopItems } from "@/lib/server/shop";
import styles from "./finds.module.css";
import { siteGraph } from "./seo";
import { AdBar, Arrow, Chip, colors, family, Footer, GridNote, JsonLd, newIds, SiteHeader, slug, SOCIAL } from "./ui";

// Public page for the bio links (TikTok, Instagram, Facebook, Pinterest) and
// for ads: our own page first, then the store. Rebuilt every 10 minutes.
export const revalidate = 600;

const TITLE = "Ivethskin Finds · Home, skincare, style & gift ideas";
const DESCRIPTION =
  "Everyday skincare, beauty, home and gift finds from TikTok and Pinterest, with our photos (some made with AI) and the real label details.";
// The home page shows the newest finds; each category has its own page.
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
  // Four photos for the sticker stack: the newest finds, one per category first.
  const stack = [
    ...newest.filter((i, n) => newest.findIndex((j) => j.category === i.category) === n),
    ...newest,
  ]
    .filter((i, n, all) => all.indexOf(i) === n)
    .slice(0, 4);
  return (
    <>
      <JsonLd data={siteGraph()} />
      <AdBar />
      <SiteHeader categories={categories} current="" />

      <section className={`${styles.wrap} ${styles.hero}`} id="top">
        <div className={styles.heroText}>
          <h1>
            Finds you&apos;ll want to <span className={styles.hl}>save.</span>
          </h1>
          <p className={styles.lede}>
            Skincare, beauty, home and gym picks from our TikTok and Pinterest, all in one place.
          </p>
          {newest.length > 0 && (
            <a className={styles.cta} href="#newest">
              See today&apos;s finds <Arrow />
            </a>
          )}
        </div>
        {stack.length > 0 && (
          <div className={styles.stack} aria-hidden="true">
            {stack.map((i) => (
              // Our own product photos, served by this site.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i.id} src={`/finds/img/${i.id}`} alt="" width={600} height={600} style={colors(i.category)} />
            ))}
          </div>
        )}
      </section>

      {items.length === 0 && <p className={`${styles.wrap} ${styles.empty}`}>New finds are coming soon.</p>}

      {categories.length > 0 && (
        <nav className={`${styles.wrap} ${styles.tiles}`} aria-label="Shop by category">
          {categories.map((c) => {
            const mine = items.filter((i) => i.category === c);
            return (
              <a key={c} className={styles.tile} href={`/c/${slug(c)}`} style={colors(c)}>
                <span className={styles.tileName}>{family(c).tab}</span>
                <span className={styles.tileFoot}>
                  <span>
                    {mine.length} {mine.length === 1 ? "find" : "finds"} <Arrow />
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/finds/img/${mine[0].id}`} alt="" width={160} height={160} loading="lazy" />
                </span>
              </a>
            );
          })}
        </nav>
      )}

      {newest.length > 0 && (
        <main className={styles.dark} aria-labelledby="h-newest" id="newest">
          <div className={styles.wrap}>
            <div className={styles.headRow}>
              <h2 id="h-newest">Fresh on the shelf</h2>
              <p>
                {items.length} {items.length === 1 ? "find" : "finds"} in all
              </p>
            </div>
            <GridNote dark />
            <div className={styles.grid}>
              {newest.map((i) => (
                <Chip key={i.id} item={i} isNew={fresh.has(i.id)} />
              ))}
            </div>
            {items.length > newest.length && categories.length > 1 && (
              <p className={styles.more}>
                Every find, by category:{" "}
                {categories.map((c, n) => (
                  <span key={c}>
                    {n > 0 && " · "}
                    <a href={`/c/${slug(c)}`}>{family(c).tab}</a>
                  </span>
                ))}
              </p>
            )}
          </div>
        </main>
      )}

      <section className={`${styles.wrap} ${styles.social}`} aria-labelledby="h-social">
        <div>
          <h2 id="h-social">Seen it on TikTok?</h2>
          <p>Every video&apos;s product lives here, with its store link. Follow along for new finds.</p>
          <div className={styles.socialLinks}>
            {SOCIAL.map(([name, handle, url, tone]) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={{ "--tone": tone } as React.CSSProperties}>
                {name} {handle}
              </a>
            ))}
          </div>
        </div>
        {newest[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/finds/img/${newest[0].id}`} alt="" width={600} height={600} loading="lazy" aria-hidden="true" />
        )}
      </section>

      <Footer />
    </>
  );
}
