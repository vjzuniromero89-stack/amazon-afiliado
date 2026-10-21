"use client";
import styles from "./finds.module.css";

// The shop's own error page, in English, instead of the private panel's.
export default function FindsError({ reset }: { reset: () => void }) {
  return (
    <main className={`${styles.wrap} ${styles.prose}`}>
      <h1>Something went wrong</h1>
      <p>
        This page could not load. <button onClick={reset}>Try again</button> or{" "}
        <a href="/">see all the finds</a>.
      </p>
    </main>
  );
}
