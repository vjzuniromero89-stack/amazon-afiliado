import test from "node:test";
import assert from "node:assert/strict";
import { trafficSource } from "../src/lib/traffic-source";

test("groups social referral hosts and campaign aliases", () => {
  assert.equal(trafficSource("", "https://l.instagram.com/?private=value", "ivethskin.com"), "instagram");
  assert.equal(trafficSource(" FB ", "https://pinterest.com/", "ivethskin.com"), "facebook");
  assert.equal(trafficSource("", "https://www.pinterest.com/pin/123", "ivethskin.com"), "pinterest");
  assert.equal(trafficSource("", "https://vm.tiktok.com/example", "ivethskin.com"), "tiktok");
});

test("ignores internal and invalid referrers, never stores paths or queries", () => {
  assert.equal(trafficSource("", "https://ivethskin.com/p/123", "ivethskin.com"), "");
  assert.equal(trafficSource("", "invalid", "ivethskin.com"), "");
  assert.equal(trafficSource("", "https://example.com/private?email=secret", "ivethskin.com"), "example.com");
});
