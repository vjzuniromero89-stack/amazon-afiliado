import type { Metadata } from "next";
import { TextPage } from "../ui";

export const metadata: Metadata = {
  metadataBase: new URL("https://ivethskin.com"),
  alternates: { canonical: "/about" },
  title: "About · Ivethskin Finds",
  description: "What Ivethskin Finds is, how the finds are picked and how the affiliate links work.",
};

export default function About() {
  return (
    <TextPage>
      <h1>About Ivethskin Finds</h1>
      <p>
        Ivethskin Finds is where I share everyday products I like: home, skincare, style, wellness
        and gift ideas, sorted by color so they are easy to browse.
      </p>
      <h2>How it works</h2>
      <p>
        Every find shows the details printed on the label or listed by the seller. When you tap
        &ldquo;See it on Amazon&rdquo; (or Target or Walmart), you go to the store to see the
        price, the reviews and if it is in stock.
      </p>
      <p>
        The photos and videos are made by me, some with AI tools, to show the product. Always check
        the store page for the exact product, size and color.
      </p>
      <h2>What you will not find here</h2>
      <ul>
        <li>Prices: they change often, so the store shows the current one.</li>
        <li>Health claims: for supplements I only share what the label says. Ask your doctor before starting one.</li>
      </ul>
      <h2>Affiliate links</h2>
      <p>
        #ad · The store buttons are affiliate links: I may earn a commission from purchases at no
        extra cost to you. As an Amazon Associate I earn from qualifying purchases.
      </p>
      <h2>Follow along</h2>
      <p>
        New finds go up on <a href="https://www.pinterest.com/karenivette_29/">Pinterest</a>,{" "}
        <a href="https://www.instagram.com/ivethskin_/">Instagram</a> and{" "}
        <a href="https://www.tiktok.com/@ivethskin">TikTok</a>.
      </p>
    </TextPage>
  );
}
