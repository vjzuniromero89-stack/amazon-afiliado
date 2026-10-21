"use client";
import { useEffect } from "react";
import { channelOf, withTag, type ChannelTags } from "@/lib/channels";
import { trafficSource } from "@/lib/traffic-source";

// Counts taps on the store buttons (a[data-go]). The first outside source of
// the session (utm_source or the referring site, normalized to "pinterest",
// "instagram", "facebook", "tiktok" or a bare hostname) is kept, so later
// visits in the same tab do not overwrite it. Only a label or hostname is
// stored, never a referrer's path or query.
// When that channel has its own Amazon tracking ID (AMAZON_CHANNEL_TAGS), the
// link uses it, so Amazon's reports show which channel brought the order. It
// stays a plain amazon.com link.
export function Tracker({ tags = {} }: { tags?: ChannelTags }) {
  useEffect(() => {
    let source = "";
    try {
      const utm = new URLSearchParams(location.search).get("utm_source") || "";
      source = trafficSource(utm, document.referrer, location.hostname);
      try {
        const first = sessionStorage.getItem("src");
        if (first) source = trafficSource(first, "", location.hostname);
        else if (source) sessionStorage.setItem("src", source);
      } catch {
        /* No storage (private mode): keep this page's own source. */
      }
    } catch {
      /* The tap still counts, without a source. */
    }
    const channel = channelOf(source);
    const tag = channel ? tags[channel] : undefined;
    const go = (e: MouseEvent) => (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-go]");
    const onClick = (e: MouseEvent) => {
      const a = go(e);
      if (!a) return;
      if (tag) a.href = withTag(a.href, tag);
      const body = JSON.stringify({ id: a.dataset.go, page: location.pathname, source });
      navigator.sendBeacon?.("/finds/click", new Blob([body], { type: "application/json" }));
    };
    // A middle-click or a long press opens the link without a "click".
    const onAux = (e: MouseEvent) => {
      const a = go(e);
      if (a && tag) a.href = withTag(a.href, tag);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onAux, true);
    document.addEventListener("contextmenu", onAux, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onAux, true);
      document.removeEventListener("contextmenu", onAux, true);
    };
  }, [tags]);
  return null;
}
