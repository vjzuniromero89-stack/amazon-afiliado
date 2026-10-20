"use client";
import { useEffect } from "react";

// Counts taps on the store buttons (a[data-go]) without touching the
// affiliate link itself. The first outside site a visitor came from
// (Pinterest, TikTok...) is kept for the session so the tap knows its source.
export function Tracker() {
  useEffect(() => {
    let source = "";
    try {
      const from = document.referrer ? new URL(document.referrer).hostname : "";
      const utm = new URLSearchParams(location.search).get("utm_source") || "";
      if (utm || (from && from !== location.hostname)) sessionStorage.setItem("src", utm || from);
      source = sessionStorage.getItem("src") || "";
    } catch {
      /* Private mode: the tap still counts, without a source. */
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-go]");
      if (!a) return;
      const body = JSON.stringify({ id: a.dataset.go, page: location.pathname, source });
      navigator.sendBeacon?.("/finds/click", new Blob([body], { type: "application/json" }));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
