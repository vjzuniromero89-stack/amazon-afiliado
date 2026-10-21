// One Amazon tracking ID per channel, so the Associates reports (by tracking
// ID and ASIN) show which channel brought the orders. The IDs are created in
// Associates Central (Account Settings → Manage Your Tracking IDs) and set in
// the AMAZON_CHANNEL_TAGS env var, e.g.
//   pinterest=ivethskin-pin-20,tiktok=ivethskin-tt-20
// Without it every link keeps the main tracking ID. Links stay plain
// amazon.com links with our own tag: nothing is hidden or redirected.
// No dependencies: the shop's click tracker runs this in the browser.

export const CHANNELS = ["pinterest", "instagram", "facebook", "tiktok"] as const;
export type Channel = (typeof CHANNELS)[number];
export type ChannelTags = Partial<Record<Channel, string>>;

const TAG = /^[\w-]{1,80}$/;

export function channelTags(raw: string | undefined | null): ChannelTags {
  const out: ChannelTags = {};
  for (const part of (raw || "").split(",")) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if ((CHANNELS as readonly string[]).includes(key) && TAG.test(value || "")) out[key as Channel] = value;
  }
  return out;
}

// Where a visitor came from: utm_source ("tiktok") or the referring site
// (pin.it, l.instagram.com, m.facebook.com...).
export function channelOf(source: string | undefined | null): Channel | null {
  const s = (source || "").toLowerCase();
  if (/pinterest|(^|\.)pin\.it$/.test(s)) return "pinterest";
  if (/instagram/.test(s)) return "instagram";
  if (/facebook|(^|\.)fb\.(com|me)$|^fb$/.test(s)) return "facebook";
  if (/tiktok/.test(s)) return "tiktok";
  return null;
}

// The same Amazon link with another of our tracking IDs. Other stores and
// anything that is not an Amazon link stay as they are.
export function withTag(href: string, tag: string) {
  try {
    const url = new URL(href);
    if (!/(^|\.)amazon\.[a-z.]+$/i.test(url.hostname) || !TAG.test(tag)) return href;
    url.searchParams.set("tag", tag);
    return url.toString();
  } catch {
    return href;
  }
}
