import styles from "./finds.module.css";
import { AdBar, Footer, SiteHeader } from "./ui";

// The public shop's own "not found", in English and with the shop's header,
// instead of the private app's Spanish page.
export default function FindNotFound() {
  return (
    <>
      <AdBar />
      <SiteHeader categories={[]} />
      <main className={`${styles.wrap} ${styles.prose}`}>
        <h1>This find is not here anymore</h1>
        <p>
          It may have been removed from the shop. <a href="/">See all the finds</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}
