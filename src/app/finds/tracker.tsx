"use client";
import { useEffect } from "react";
import { channelOf, withTag, type ChannelTags } from "@/lib/channels";

// Counts taps on the store buttons (a[data-go]). The first outside site a
// visitor came from (Pinterest, TikTok...) is kept for the session so the
// tap knows its source. When that channel has its own Amazon tracking ID
// (AMAZON_CHANNEL_TAGS), the link uses it, so Amazon's reports show which
// channel brought the order. It stays a plain amazon.com link.
export function Tracker({ tags = {} }: { tags?: ChannelTags }) {
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
    const channel = channelOf(source);
    const tag = channel ? tags[channel] : undefined;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-go]");
      if (!a) return;
      if (tag) a.href = withTag(a.href, tag);
      const body = JSON.stringify({ id: a.dataset.go, page: location.pathname, source });
      navigator.sendBeacon?.("/finds/click", new Blob([body], { type: "application/json" }));
    };
    // A middle-click or a long press opens the link without a "click".
    const onAux = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-go]");
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
