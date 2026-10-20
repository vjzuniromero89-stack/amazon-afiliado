import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import styles from "./finds.module.css";
import { Tracker } from "./tracker";

// The public shop has its own type: a heavy grotesque for chip names and
// a plain grotesque for the small print. Both are served by this site.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--display", display: "swap" });
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--text", display: "swap" });

export default function FindsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" className={`${display.variable} ${text.variable} ${styles.page}`}>
      {children}
      <Tracker />
    </div>
  );
}
