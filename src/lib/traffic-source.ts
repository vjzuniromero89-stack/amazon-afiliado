// Store only a channel label/hostname, never a referrer's path or query.
export function trafficSource(utm: string, referrer: string, hostname: string): string {
  let from = "";
  try {
    const url = new URL(referrer);
    if (url.hostname !== hostname) from = url.hostname;
  } catch { /* No usable referrer. */ }
  const value = (utm.trim() || from).toLowerCase().replace(/^www\./, "").slice(0, 80);
  if (/^(pinterest|pinterest\.com|[a-z]+\.pinterest\.com|pin\.it)$/.test(value)) return "pinterest";
  if (/^(instagram|ig|instagram\.com|l\.instagram\.com)$/.test(value)) return "instagram";
  if (/^(facebook|fb|(?:m\.|l\.|lm\.)?facebook\.com|fb\.com)$/.test(value)) return "facebook";
  if (/^(tiktok|tiktok\.com|(?:vm\.|vt\.|m\.)tiktok\.com)$/.test(value)) return "tiktok";
  return value.replace(/[^a-z0-9._-]/g, "");
}
