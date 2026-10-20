"use client";
import { useEffect, useState, type CSSProperties } from "react";
import styles from "./finds.module.css";

type Tab = { id: string; label: string; pale: string; tone: string; deep: string };

// Sticky color tabs. The section on screen gets the one reserved accent;
// above the first section, "All" holds it.
export function Tabs({ categories }: { categories: Tab[] }) {
  const [current, setCurrent] = useState("");
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        setCurrent(categories.find((c) => seen.get(c.id))?.id ?? "");
      },
      { rootMargin: "-80px 0px -45% 0px" },
    );
    for (const c of categories) {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [categories]);

  return (
    <nav className={styles.tabs} aria-label="Jump to a category">
      <div className={styles.wrap}>
        <a className={styles.all} href="#top" aria-current={current === "" ? "true" : undefined}>
          All
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            aria-current={current === c.id ? "true" : undefined}
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
