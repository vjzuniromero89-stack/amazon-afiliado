import { test } from "node:test";
import assert from "node:assert/strict";
import { tiktokCaption, tiktokPost } from "../src/lib/tiktok";

const amazon = "#ad · As an Amazon Associate I earn from qualifying purchases.";

test("TikTok caption: #ad first, no link to click, the store's statement once, AI said plainly", () => {
  const c = tiktokCaption({ title: "COSRX Snail Mucin 96% Power Repairing Essence 3.38 fl.oz", store: "amazon" }, amazon);
  assert.ok(c.startsWith("#ad "));
  assert.ok(!/https?:\/\//.test(c), "TikTok captions do not make links clickable");
  assert.equal(c.match(/#ad\b/g)?.length, 1, "one #ad, not two");
  assert.ok(c.includes("As an Amazon Associate I earn from qualifying purchases."));
  assert.ok(c.includes("Made with AI."));
  assert.ok(!/\n\s*·/.test(c), "no separator left over from the removed #ad");
  assert.ok(c.length <= 2200);
});

test("TikTok post labels: affiliate = Paid partnership (branded content) and AI-generated", () => {
  const p = tiktokPost({ title: "Clean Skin Club Clean Towels XL", store: "walmart" }, amazon);
  assert.equal(p.is_branded_content, true);
  assert.equal(p.is_brand_organic, false);
  assert.equal(p.is_ai_generated, true);
  assert.ok(p.caption.includes("#WalmartPartner"));
});
