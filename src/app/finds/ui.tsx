import type { CSSProperties } from "react";
import type { ShopItem } from "@/lib/server/shop";
import styles from "./finds.module.css";

// Each category wears one pastel from the logo's dots (pink, lilac, green,
// yellow) or a sibling of them. Text on it is always the page ink, which
// reads on every tone.
const FAMILIES: Record<string, { tone: string; tab: string }> = {
  Skincare: { tone: "#f7b6c2", tab: "Skincare" },
  "Beauty & Makeup": { tone: "#cdbdf5", tab: "Beauty" },
  "Supplements & Wellness": { tone: "#bfe3b0", tab: "Wellness" },
  "Home Decor & Organization": { tone: "#bfe3b0", tab: "Home" },
  Kitchen: { tone: "#fbc9a8", tab: "Kitchen" },
  "Fashion & Clothing": { tone: "#cdbdf5", tab: "Fashion" },
  "Fitness & Workout": { tone: "#f8e08a", tab: "Fitness" },
  "Tech & Gadgets": { tone: "#b9d2f7", tab: "Tech" },
  "Baby & Mom": { tone: "#ffd7b0", tab: "Baby & Mom" },
  "Pets & Dogs": { tone: "#e6cfb6", tab: "Pets" },
  "Gift Ideas": { tone: "#f7b6c2", tab: "Gifts" },
};
const fallback = FAMILIES["Gift Ideas"];

export const family = (category: string) => FAMILIES[category] ?? fallback;

export function colors(category: string) {
  return { "--tone": family(category).tone } as CSSProperties;
}

export const slug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const STORE_LINK = { target: "_blank", rel: "sponsored nofollow noopener noreferrer" } as const;

export function Arrow({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {down ? <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" /> : <path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5" />}
    </svg>
  );
}

export function AdBar() {
  return (
    <p className={styles.ad}>
      <b>#ad</b> · Affiliate links: I may earn a commission. As an Amazon Associate I earn from
      qualifying purchases.
    </p>
  );
}

// Logo and name on the left; one pill per category on the right. The page
// you are on is marked; "All" is the home page.
export function SiteHeader({ categories, current }: { categories: string[]; current?: string }) {
  return (
    <header className={`${styles.wrap} ${styles.head}`}>
      <a className={styles.mark} href="/">
        {/* The same round logo as the Facebook, Instagram and TikTok profiles. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/finds/logo-240.png" alt="" width={56} height={56} />
        Ivethskin Finds
      </a>
      <nav className={styles.pills} aria-label="Categories">
        <a href="/" className={styles.pillAll} aria-current={current === "" ? "page" : undefined}>
          All
        </a>
        {categories.map((c) => (
          <a
            key={c}
            href={`/c/${slug(c)}`}
            style={colors(c)}
            aria-current={current === slug(c) ? "page" : undefined}
          >
            {family(c).tab}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function Chip({ item, isNew }: { item: ShopItem; isNew?: boolean }) {
  return (
    <article className={styles.card} style={colors(item.category)}>
      <a className={styles.photo} href={`/p/${item.id}`} tabIndex={-1} aria-hidden="true">
        {/* Our own product photo, served by this site. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/finds/img/${item.id}`} alt="" loading="lazy" width={600} height={600} />
        <span className={styles.tag}>{family(item.category).tab}</span>
        {isNew && <span className={styles.flag}>New</span>}
      </a>
      <h3>
        <a href={`/p/${item.id}`}>{item.short}</a>
      </h3>
      {item.facts.length > 0 && <p className={styles.facts}>{item.facts.join(" · ")}</p>}
      <p className={styles.affiliateNote}>Ad · I may earn a commission from this link.</p>
      <a className={styles.go} href={item.link} data-go={item.id} {...STORE_LINK}>
        See it on {item.store} <Arrow />
      </a>
    </article>
  );
}

export const SOCIAL = [
  ["TikTok", "@ivethskin", "https://www.tiktok.com/@ivethskin", "#f7b6c2"],
  ["Instagram", "@ivethskin_", "https://www.instagram.com/ivethskin_/", "#cdbdf5"],
  ["Pinterest", "Ivethskin Finds", "https://www.pinterest.com/karenivette_29/", "#f8e08a"],
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footIn}`}>
        <p>
          <b>#ad</b> · Affiliate links: I may earn a commission from purchases at no extra cost to
          you. As an Amazon Associate I earn from qualifying purchases. Photos are my own. Prices and
          availability are shown on the store&apos;s site.
        </p>
        <nav aria-label="About this site" className={styles.footLinks}>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          {SOCIAL.map(([name, , url]) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer">
              {name}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

// The two most recent finds wear the "New" flag for three weeks.
export function newIds(items: ShopItem[]) {
  const cutoff = Date.now() - 21 * 864e5;
  return new Set(
    [...items]
      .sort((a, b) => b.added.localeCompare(a.added))
      .slice(0, 2)
      .filter((i) => Date.parse(i.added) > cutoff)
      .map((i) => i.id),
  );
}

// About, Contact and Privacy share the shop's header and footer.
export function TextPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdBar />
      <SiteHeader categories={[]} />
      <main className={`${styles.wrap} ${styles.prose}`}>{children}</main>
      <Footer />
    </>
  );
}

