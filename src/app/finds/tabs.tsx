import type { CSSProperties } from "react";
import styles from "./finds.module.css";

type Tab = { id: string; label: string; pale: string; tone: string; deep: string };

// Sticky color tabs: "All" is the home page, each color its own page. The
// page you are on gets the one reserved accent.
export function Tabs({ categories, current }: { categories: Tab[]; current: string }) {
  return (
    <nav className={styles.tabs} aria-label="Categories">
      <div className={styles.wrap}>
        <a className={styles.all} href="/" aria-current={current === "" ? "page" : undefined}>
          All
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={`/c/${c.id}`}
            aria-current={current === c.id ? "page" : undefined}
            style={{ "--pale": c.pale, "--tone": c.tone, "--deep": c.deep } as CSSProperties}
          >
            <i aria-hidden="true" />
            {c.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
