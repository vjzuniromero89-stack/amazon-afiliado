import type { CSSProperties } from "react";
import type { ShopItem } from "@/lib/server/shop";
import styles from "./finds.module.css";

// Each category is a paint strip: a pale shade, a tone and a deep ink that
// stays readable on both.
const FAMILIES: Record<string, { pale: string; tone: string; deep: string; tab: string }> = {
  Skincare: { pale: "#fde4e6", tone: "#f4adb6", deep: "#741c30", tab: "Skincare" },
  "Beauty & Makeup": { pale: "#fbe0f1", tone: "#ec9fd0", deep: "#6a1048", tab: "Beauty" },
  "Supplements & Wellness": { pale: "#e2f0de", tone: "#9fcd95", deep: "#1c4526", tab: "Wellness" },
  "Home Decor & Organization": { pale: "#fbf0c9", tone: "#f2cd55", deep: "#4f3a04", tab: "Home" },
  Kitchen: { pale: "#fde3d6", tone: "#f6a582", deep: "#6b2410", tab: "Kitchen" },
  "Fashion & Clothing": { pale: "#ece5fb", tone: "#b9a3ef", deep: "#33206a", tab: "Fashion" },
  "Fitness & Workout": { pale: "#d8f3ec", tone: "#74d3bf", deep: "#0c4339", tab: "Fitness" },
  "Tech & Gadgets": { pale: "#e0e8fd", tone: "#93b1f4", deep: "#152f6b", tab: "Tech" },
  "Baby & Mom": { pale: "#ffead8", tone: "#ffc28f", deep: "#653608", tab: "Baby & Mom" },
  "Pets & Dogs": { pale: "#f3e7dc", tone: "#d5aa83", deep: "#4a2b12", tab: "Pets" },
  "Gift Ideas": { pale: "#ffe1df", tone: "#ff978c", deep: "#741515", tab: "Gifts" },
};
const fallback = FAMILIES["Gift Ideas"];

export const family = (category: string) => FAMILIES[category] ?? fallback;

export function colors(category: string) {
  const f = family(category);
  return { "--pale": f.pale, "--tone": f.tone, "--deep": f.deep } as CSSProperties;
}

export const slug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const chipNo = (n: number) => `IF ${String(n).padStart(3, "0")}`;

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

// The wordmark: four chips from the rack, then the name.
export function Mark({ categories }: { categories: string[] }) {
  const shown = [...categories, ...Object.keys(FAMILIES)].filter((c, i, a) => a.indexOf(c) === i).slice(0, 4);
  return (
    <a className={styles.mark} href="/">
      <span aria-hidden="true">
        {shown.map((c) => (
          <i key={c} style={{ background: family(c).tone }} />
        ))}
      </span>
      Ivethskin Finds
    </a>
  );
}

export function Chip({ item, isNew }: { item: ShopItem; isNew?: boolean }) {
  return (
    <article className={`${styles.chip} ${isNew ? styles.fresh : ""}`} style={colors(item.category)}>
      <a className={styles.photo} href={`/p/${item.id}`} tabIndex={-1} aria-hidden="true">
        {/* Our own product photo, served by this site. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/finds/img/${item.id}`} alt="" loading="lazy" width={600} height={600} />
        {isNew && <span className={styles.flag}>New</span>}
      </a>
      <div className={styles.body}>
        <h3>
          <a href={`/p/${item.id}`}>{item.short}</a>
        </h3>
        <span className={styles.no}>{chipNo(item.no)}</span>
        {item.facts.length > 0 && (
          <ul className={styles.facts}>
            {item.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <a className={styles.go} href={item.link} {...STORE_LINK}>
          See it on {item.store} <Arrow />
        </a>
      </div>
    </article>
  );
}

const SOCIAL = [
  ["Pinterest", "https://www.pinterest.com/karenivette_29/"],
  ["Instagram", "https://www.instagram.com/ivethskin_/"],
  ["TikTok", "https://www.tiktok.com/@ivethskin"],
];

export function Footer({ categories }: { categories: string[] }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footRack} aria-hidden="true">
        {(categories.length ? categories : Object.keys(FAMILIES)).map((c) => (
          <i key={c} style={{ background: family(c).tone }} />
        ))}
      </div>
      <div className={styles.footIn}>
        <nav aria-label="Social">
          {SOCIAL.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer">
              {name}
            </a>
          ))}
        </nav>
        <p>
          <b>#ad</b> · Affiliate links: I may earn a commission from purchases at no extra cost to
          you. As an Amazon Associate I earn from qualifying purchases. Photos are my own. Prices and
          availability are shown on the store&apos;s site.
        </p>
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
