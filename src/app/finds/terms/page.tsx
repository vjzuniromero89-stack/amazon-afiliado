import type { Metadata } from "next";
import styles from "../finds.module.css";
import { TextPage } from "../ui";

export const metadata: Metadata = {
  metadataBase: new URL("https://ivethskin.com"),
  alternates: { canonical: "/terms" },
  title: "Terms · Ivethskin Finds",
  description: "The terms for using ivethskin.com.",
};

export default function Terms() {
  return (
    <TextPage>
      <h1>Terms of use</h1>
      <p className={styles.updated}>Last updated: October 21, 2026</p>
      <h2>What this site is</h2>
      <p>
        Ivethskin Finds shares products I like for the home, skincare, beauty, style and
        everyday life. Each product has a button that opens a store (Amazon, Target or Walmart).
        I do not sell anything here and you do not buy anything from me.
      </p>
      <h2>Affiliate links</h2>
      <p>
        #ad · The store buttons are affiliate links: I may earn a commission when you buy, at no
        extra cost to you. As an Amazon Associate I earn from qualifying purchases. The posts I
        share on Pinterest, Instagram, Facebook and TikTok carry the same disclosure.
      </p>
      <h2>Prices, availability and purchases</h2>
      <p>
        Prices and availability are shown on the store&apos;s site and can change at any time.
        Your purchase, shipping, returns and warranty are between you and the store, under its
        own terms.
      </p>
      <h2>What I say about products</h2>
      <p>
        Product notes come from the label and the listing. They are not medical, health or
        professional advice. Read the label and talk to a professional when in doubt.
      </p>
      <h2>Photos and videos</h2>
      <p>
        The photos and videos are ours; some are made or edited with AI and are labeled that way
        where the platform allows. Product names and brands belong to their owners. Please do not
        reuse our photos or videos without asking.
      </p>
      <h2>Privacy</h2>
      <p>
        What the site collects is explained on the <a href="/privacy">Privacy</a> page.
      </p>
      <h2>Changes and questions</h2>
      <p>
        I may update these terms; the date above changes when I do. Questions: see{" "}
        <a href="/contact">Contact</a>.
      </p>
    </TextPage>
  );
}
