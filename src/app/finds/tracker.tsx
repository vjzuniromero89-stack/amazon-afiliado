"use client";
import { useEffect } from "react";
import { trafficSource } from "@/lib/traffic-source";

// Counts taps on the store buttons (a[data-go]) without touching the
// affiliate link itself. The first outside site a visitor came from
// (Pinterest, TikTok...) is kept for the session so the tap knows its source.
export function Tracker() {
  useEffect(() => {
    let source = "";
    try {
      const utm = new URLSearchParams(location.search).get("utm_source") || "";
      source = trafficSource(utm, document.referrer, location.hostname);
      try {
        const first = sessionStorage.getItem("src");
        if (first) source = trafficSource(first, "", location.hostname);
        else if (source) sessionStorage.setItem("src", source);
      } catch { /* Keep the current source when storage is unavailable. */ }
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

