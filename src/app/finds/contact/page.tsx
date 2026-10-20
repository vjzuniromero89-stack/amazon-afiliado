import type { Metadata } from "next";
import { TextPage } from "../ui";

export const metadata: Metadata = {
  metadataBase: new URL("https://ivethskin.com"),
  alternates: { canonical: "/contact" },
  title: "Contact · Ivethskin Finds",
  description: "How to reach Ivethskin Finds.",
};

export default function Contact() {
  return (
    <TextPage>
      <h1>Contact</h1>
      <p>The fastest way to reach me is a direct message:</p>
      <ul>
        <li>
          Instagram: <a href="https://www.instagram.com/ivethskin_/">@ivethskin_</a>
        </li>
        <li>
          TikTok: <a href="https://www.tiktok.com/@ivethskin">@ivethskin</a>
        </li>
        <li>
          Pinterest: <a href="https://www.pinterest.com/karenivette_29/">Ivethskin Finds</a>
        </li>
      </ul>
      <p>
        For questions about an order, a return or a product, please contact the store where you
        bought it (Amazon, Target or Walmart): I do not sell or ship products myself.
      </p>
    </TextPage>
  );
}
