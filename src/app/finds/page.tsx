import type { Metadata } from "next";
import { shopItems } from "@/lib/server/shop";
import styles from "./finds.module.css";

// Public page for the bio links (TikTok, Instagram, Facebook, Pinterest) and
// for ads: our own page first, then the store. Rebuilt every 10 minutes.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Ivethskin Finds · Home, skincare, style & gift ideas",
  description:
    "Practical home, skincare, style and gift finds, with our own photos and the real product details.",
};

const SOCIAL = [
  ["Pinterest", "https://www.pinterest.com/karenivette_29/"],
  ["Instagram", "https://www.instagram.com/ivethskin_/"],
  ["TikTok", "https://www.tiktok.com/@user64820562"],
];

export default async function Finds() {
  const items = await shopItems();
  const categories = [...new Set(items.map((i) => i.category))];
  const slug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <main className={styles.page} lang="en">
      <header className={styles.header}>
        <p className={styles.brand}>Ivethskin Finds</p>
        <h1>Home, skincare, style &amp; gift finds I love</h1>
        <p className={styles.disclosure}>
          #ad · Affiliate links: I may earn a commission from purchases. As an
          Amazon Associate I earn from qualifying purchases.
        </p>
        {categories.length > 1 && (
          <nav className={styles.chips} aria-label="Categories">
            {categories.map((c) => (
              <a key={c} href={`#${slug(c)}`}>
                {c}
              </a>
            ))}
          </nav>
        )}
      </header>

      {items.length === 0 && <p className={styles.empty}>New finds are coming soon.</p>}

      {categories.map((c) => (
        <section key={c} id={slug(c)} className={styles.section}>
          <h2>{c}</h2>
          <div className={styles.grid}>
            {items
              .filter((i) => i.category === c)
              .map((i) => (
                <article key={i.id} className={styles.card}>
                  <a href={i.link} target="_blank" rel="sponsored nofollow noopener noreferrer">
                    {/* Our own product photo, served by this site. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/finds/img/${i.id}`} alt={i.title} loading="lazy" width={600} height={600} />
                  </a>
                  <div className={styles.body}>
                    <h3>{i.title.length > 80 ? i.title.slice(0, 78).trimEnd() + "…" : i.title}</h3>
                    {i.facts.length > 0 && (
                      <ul className={styles.facts}>
                        {i.facts.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    )}
                    <a className={styles.button} href={i.link} target="_blank" rel="sponsored nofollow noopener noreferrer">
                      See it on {i.store}
                    </a>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        <nav aria-label="Social">
          {SOCIAL.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer">
              {name}
            </a>
          ))}
        </nav>
        <p>
          #ad · Affiliate links: I may earn a commission from purchases at no
          extra cost to you. As an Amazon Associate I earn from qualifying
          purchases. Prices and availability are shown on the store&apos;s site.
        </p>
      </footer>
    </main>
  );
}
