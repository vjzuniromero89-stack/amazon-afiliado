import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  affiliateUrl,
  breakdown,
  creativeInput,
  insights,
  parseAmazon,
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
  assert.ok(d.startsWith(defaults.disclosure));
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
