import type { Metadata } from "next";
import styles from "../finds.module.css";
import { TextPage } from "../ui";

export const metadata: Metadata = {
  metadataBase: new URL("https://ivethskin.com"),
  alternates: { canonical: "/privacy" },
  title: "Privacy · Ivethskin Finds",
  description: "What ivethskin.com collects and how it is used.",
};

export default function Privacy() {
  return (
    <TextPage>
      <h1>Privacy</h1>
      <p className={styles.updated}>Last updated: October 20, 2026</p>
      <h2>What this site collects</h2>
      <p>
        There are no accounts, forms or newsletters here. When you tap a store button, the site
        counts the tap: which product, which page and where you came from (for example Pinterest
        or TikTok) and the time. It does not store your name, email or IP address.
      </p>
      <h2>Hosting</h2>
      <p>
        The site is hosted by Vercel, which keeps standard server logs to run and protect the
        service.
      </p>
      <h2>Stores and their cookies</h2>
      <p>
        The store buttons take you to Amazon, Target or Walmart. Those sites set their own cookies,
        including the ones that tell them a purchase came from an affiliate link. Their privacy
        policies apply there.
      </p>
      <h2>Advertising</h2>
      <p>
        This site does not use advertising pixels today. If that changes (for example a Pinterest,
        TikTok or Meta pixel to measure ads), this page will say so first, with a way to opt out.
      </p>
      <h2>Children</h2>
      <p>This site is not meant for children under 13.</p>
      <h2>Questions</h2>
      <p>
        Send a message on <a href="https://www.instagram.com/ivethskin_/">Instagram</a> or{" "}
        <a href="https://www.tiktok.com/@ivethskin">TikTok</a>.
      </p>
    </TextPage>
  );
}
