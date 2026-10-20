import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  affiliateUrl,
  breakdown,
  creativeInput,
  detectCategory,
  insights,
  parseAmazon,
  parseStoreLink,
  pinLink,
  settingsInput,
  descriptionWithDisclosure,
} from "../src/lib/domain";
import { defaults, type Metric, type Publication } from "../src/lib/types";
import { decrypt, encrypt, safeEqual } from "../src/lib/server/crypto";
import { randomBytes } from "node:crypto";
test("Amazon canonicalization strips injected tags and allows supported URL paths", () => {
  assert.deepEqual(
    parseAmazon("https://amazon.com/gp/product/B012345678?tag=other-20"),
    {
      asin: "B012345678",
      marketplace: "www.amazon.com",
      url: "https://www.amazon.com/dp/B012345678",
    },
  );
  assert.equal(
    parseAmazon("b012345678", "www.amazon.es").marketplace,
    "www.amazon.es",
  );
  assert.equal(
    affiliateUrl(
      "https://www.amazon.com/dp/B012345678?tag=attacker",
      "mytag-20",
    ),
    "https://www.amazon.com/dp/B012345678?tag=mytag-20",
  );
});
test("Amazon parser rejects SSRF hosts, short URLs, credentials, unsupported schemes and malformed ASINs", () => {
  for (const input of [
    "https://amazon.com.evil.test/dp/B012345678",
    "https://127.0.0.1/dp/B012345678",
    "https://amzn.to/secret",
    "http://www.amazon.com/dp/B012345678",
    "https://x:password@www.amazon.com/dp/B012345678",
    "https://www.amazon.com:8080/dp/B012345678",
    "NOTVALID",
    "https://www.amazon.com/dp/B0123456789",
  ])
    assert.throws(() => parseAmazon(input), input);
});
test("disclosure is first and never truncated by a full description", () => {
  const d = descriptionWithDisclosure(
    { description: "x".repeat(600), cta: "y".repeat(60) },
    defaults,
  );
  // "#ad · Affiliate link." leads, then the Amazon statement, both whole.
  assert.ok(d.startsWith("#ad · Affiliate link. "));
  assert.ok(
    d.slice(0, 200).includes("As an Amazon Associate I earn from qualifying purchases"),
  );
  assert.ok(d.length <= 800);
});
test("settings enforce daily cap, timezone, marketplace and disclosure", () => {
  assert.ok(settingsInput.safeParse(defaults).success);
  for (const override of [
    { daily_limit: 26 },
    { min_interval_minutes: 1 },
    { disclosure: "" },
    { timezone: "bad/zone" },
    { storefront_url: "https://evil.example/shop/a" },
  ])
    assert.equal(
      settingsInput.safeParse({ ...defaults, ...override }).success,
      false,
    );
});
const metric = (impressions: number | null, clicks: number | null): Metric => ({
  publication_id: "p",
  date: "2026-09-27",
  impressions,
  saves: null,
  outbound_clicks: clicks,
  fetched_at: "2026-09-28",
});
test("metrics preserve missing data and CTR is weighted, not average of rates", () => {
  assert.deepEqual(aggregate([]), {
    impressions: null,
    saves: null,
    clicks: null,
    ctr: null,
  });
  assert.equal(aggregate([metric(100, 10), metric(900, 0)]).ctr, 1);
  assert.equal(aggregate([metric(0, 0)]).ctr, null);
  assert.equal(aggregate([metric(100, null)]).clicks, null);
  assert.equal(aggregate([metric(100, 0)]).ctr, 0);
});
test("hour grouping uses configured timezone and does not invent recommendations", () => {
  const p = {
    id: "p",
    published_at: "2026-09-27T15:00:00Z",
    template: "bold",
  } as Publication;
  assert.equal(
    breakdown([p], [metric(100, 3)], "hour", "America/New_York")[0].name,
    "11:00",
  );
  assert.match(insights([], [], "UTC")[0], /Todavía no hay métricas/);
  assert.ok(
    insights([p], [metric(10, 1)], "UTC").some((t) =>
      t.includes("100 impresiones"),
    ),
  );
});
test("creative validation limits outgoing Pinterest fields", () => {
  assert.equal(
    creativeInput.safeParse({
      title: "x".repeat(101),
      description: "A valid description",
      keywords: [],
      alt_text: "An alt text",
      cta: "Visit",
      board_id: null,
      template: "bold",
    }).success,
    false,
  );
});
test("AES-GCM encrypts and authenticates tokens and state compare rejects empty values", () => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const value = encrypt("secret-access-token");
  assert.ok(!value.includes("secret"));
  assert.equal(decrypt(value), "secret-access-token");
  const parts = value.split(".");
  parts[1] = randomBytes(16).toString("base64url");
  assert.throws(() => decrypt(parts.join(".")));
  assert.equal(safeEqual("", ""), false);
  assert.equal(safeEqual("a", "a"), true);
  assert.equal(safeEqual("a", "b"), false);
});
test("incomplete daily series never produces a misleading CTR", () => {
  assert.equal(aggregate([metric(100, 2), metric(300, null)]).ctr, null);
});
test("Target and Walmart links must be tracked, on the store and point at a product", () => {
  const t = parseStoreLink(
    "target",
    "https://goto.target.com/c/1/2/3?u=https%3A%2F%2Fwww.target.com%2Fp%2Fmug%2F-%2FA-87654321",
  );
  assert.equal(t.asin, "T87654321");
  assert.equal(pinLink({ store: "target", url: t.url }, ""), t.url);
  const w = parseStoreLink(
    "walmart",
    "https://goto.walmart.com/c/1/2/3?u=https%3A%2F%2Fwww.walmart.com%2Fip%2FPillow%2F123456789",
  );
  assert.equal(w.asin, "W123456789");
  for (const [store, url] of [
    ["walmart", "https://www.walmart.com/ip/Pillow/123456789"],
    ["target", "https://evil.com/c/1?u=https%3A%2F%2Fwww.target.com%2Fp%2Fx%2F-%2FA-1234567"],
    ["walmart", "https://goto.walmart.com/c/1/2/3?u=https%3A%2F%2Fevil.com%2Fip%2Fx%2F12345678"],
    ["target", "http://goto.target.com/c/1/2/3?u=https%3A%2F%2Fwww.target.com%2Fp%2Fx%2F-%2FA-1234567"],
    ["target", "https://goto.target.com/c/1/2/3"],
  ] as const)
    assert.throws(() => parseStoreLink(store, url), url);
});

test("a video named after its product finds that product, and only a clear one", async () => {
  const { matchProductByName } = await import("../src/lib/domain");
  const products = [
    { id: "c", title: "Vital Vitamins Multi Collagen Complex" },
    { id: "h", title: "Vital Vitamins Hyaluronic Acid" },
    { id: "t", title: "Clean Skin Club Clean Towels XL" },
    { id: "o", title: "OEAK Womens Jelly Bras Wireless Deep V" },
  ];
  assert.equal(matchProductByName("collagen-ad.mp4", products), "c");
  assert.equal(matchProductByName("towels-ad.mp4", products), "t");
  assert.equal(matchProductByName("OEAK bra final.MOV", products), "o");
  assert.equal(matchProductByName("IMG_1234.mov", products), null);
  assert.equal(matchProductByName("vital-vitamins.mp4", products), null);
});

test("hair care and makeup are Beauty & Makeup, not supplements or gifts", () => {
  assert.equal(detectCategory("Pantene Pro-Vitamin Essence.", ""), "Beauty & Makeup");
  assert.equal(detectCategory("L'Oreal Paris Colour Riche Lip Liner Pencil.", ""), "Beauty & Makeup");
  assert.equal(detectCategory("Vital Vitamins Multi Collagen Complex", ""), "Supplements & Wellness");
});
