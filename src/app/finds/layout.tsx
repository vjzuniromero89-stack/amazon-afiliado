import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "../globals.css";
import styles from "./finds.module.css";
import { channelTags } from "@/lib/channels";
import { Tracker } from "./tracker";

// The public shop has its own type: a heavy grotesque for headings and
// product names, a friendly sans for the rest. Both are served by this site.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--display", display: "swap" });
const text = DM_Sans({ subsets: ["latin"], variable: "--text", display: "swap" });

// Pinterest's website claim for ivethskin.com (Karen's account).
export const metadata: Metadata = {
  other: { "p:domain_verify": "0e10354430fba08094c5f00bbf85db54" },
  // The round Ivethskin logo, the same one the social profiles use.
  icons: { icon: "/finds/icon-512.png", apple: "/finds/apple-icon.png" },
  // Large photo cards when a page is shared on X and other apps.
  twitter: { card: "summary_large_image" },
};

// The shop is its own root layout, so its pages say they are in English;
// the private panel's root layout, in (panel), says Spanish.
export default function FindsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className={`${display.variable} ${text.variable} ${styles.page}`}>
          {children}
          <Tracker tags={channelTags(process.env.AMAZON_CHANNEL_TAGS)} />
        </div>
      </body>
    </html>
  );
}
