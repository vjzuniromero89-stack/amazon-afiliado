import { cleanProductName, storeDisclosure, storeOf } from "./domain";

// TikTok stays manual until TikTok approves the Accounts API for this app
// (see docs/TIKTOK.md). This file only describes the post the app would send
// to /business/video/publish/ so the panel can show it; nothing here calls
// TikTok.

// TikTok shows no clickable links in captions: the shop is reached from the
// profile's link. #ad goes first (FTC); the store's own statement follows.
export function tiktokCaption(
  p: { title: string; store?: string | null },
  amazonDisclosure: string,
) {
  const name = cleanProductName(p.title);
  // #ad is already first: drop it and the separator that followed it.
  const disclosure = storeDisclosure(storeOf(p), amazonDisclosure)
    .replace(/\s*#ad\b/i, "")
    .replace(/^[\s·:-]+/, "")
    .trim();
  return [`#ad ${name}`, "Find it on ivethskin.com (link in profile).", `${disclosure} Made with AI.`, "#amazonfinds"]
    .join("\n\n")
    .slice(0, 2200);
}

// The labels every post would carry. An affiliate post promotes a third
// party's product for a commission, which TikTok labels "Paid partnership"
// (Branded content); the videos are made with AI.
export function tiktokPost(p: { title: string; store?: string | null }, amazonDisclosure: string) {
  return {
    caption: tiktokCaption(p, amazonDisclosure),
    is_branded_content: true,
    is_brand_organic: false,
    is_ai_generated: true,
  };
}
