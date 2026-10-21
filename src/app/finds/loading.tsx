import styles from "./finds.module.css";

export default function LoadingFinds() {
  return (
    <main className={`${styles.wrap} ${styles.prose}`} aria-live="polite" aria-busy="true">
      <p>Loading Ivethskin Finds…</p>
    </main>
  );
}
