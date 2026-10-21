import { test } from "node:test";
import assert from "node:assert/strict";
import {
  facebookReelNext,
  instagramNext,
  MaybeSent,
  maybeSent,
  releaseFields,
  sendOnce,
  uncertainFields,
} from "../src/lib/social-outcome";

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

test("a refusal (4xx) is not 'maybe sent'; a timeout, a dropped connection or a 5xx is", () => {
  assert.equal(maybeSent(httpError(400)), false);
  assert.equal(maybeSent(httpError(403)), false);
  assert.equal(maybeSent(httpError(429)), false);
  assert.equal(maybeSent(httpError(500)), true);
  assert.equal(maybeSent(httpError(503)), true);
  assert.equal(maybeSent(httpError(408)), true);
  assert.equal(maybeSent(new TypeError("fetch failed")), true);
  assert.equal(maybeSent(Object.assign(new Error("timeout"), { name: "TimeoutError" })), true);
});

test("sendOnce: one call; a timeout after the network published becomes MaybeSent, never a retry", async () => {
  let calls = 0;
  // The network published, then the answer was lost (timeout).
  await assert.rejects(
    sendOnce(async () => {
      calls++;
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    }, () => true),
    MaybeSent,
  );
  assert.equal(calls, 1, "the call that publishes is never repeated inside a claim");
  // A clear refusal stays a normal error (safe to retry later).
  await assert.rejects(sendOnce(async () => Promise.reject(httpError(400)), () => true), (e) => !(e instanceof MaybeSent));
  // A 200 without the id of what was published is doubtful too.
  await assert.rejects(sendOnce(async () => ({}) as { id?: string }, (r) => Boolean(r.id)), MaybeSent);
  assert.deepEqual(await sendOnce(async () => ({ id: "1" }), (r) => Boolean(r.id)), { id: "1" });
});

test("after a doubtful call the post is 'uncertain'; after a refusal it goes back, failing on the third try", () => {
  assert.equal(uncertainFields("timeout").status, "uncertain");
  assert.equal(uncertainFields("timeout").claim_token, null);
  assert.deepEqual(releaseFields("pending", 0, "bad"), { status: "pending", attempts: 1, error: "bad", claim_token: null });
  assert.equal(releaseFields("processing", 1, "bad").status, "processing");
  assert.equal(releaseFields("pending", 2, "bad").status, "failed");
  assert.equal(releaseFields("uncertain", 5, "bad").status, "uncertain", "an uncertain post is never failed or re-sent on its own");
});

test("Instagram: an uncertain post is checked, published only if its container is not published yet", () => {
  assert.equal(instagramNext("PUBLISHED", "uncertain", 0), "published", "it did go out: no second post");
  assert.equal(instagramNext("FINISHED", "uncertain", 0), "publish", "not published: a container is published at most once");
  assert.equal(instagramNext("IN_PROGRESS", "processing", 1000), "wait");
  assert.equal(instagramNext("IN_PROGRESS", "processing", 7 * 3600e3), "too-slow");
  assert.equal(instagramNext("IN_PROGRESS", "uncertain", 7 * 3600e3), "wait");
  assert.equal(instagramNext("EXPIRED", "processing", 0), "failed");
  assert.equal(instagramNext("ERROR", "processing", 0), "failed");
});

test("Facebook Reel: the same video is finished again only if the publish request never arrived", () => {
  const uploaded = { uploading_phase: { status: "complete" } };
  assert.equal(facebookReelNext({ ...uploaded, publishing_phase: { status: "complete" } }, "uncertain", 0).step, "published");
  assert.equal(facebookReelNext({ ...uploaded, publishing_phase: { status: "not_started" } }, "uncertain", 0).step, "finish");
  assert.equal(facebookReelNext({ ...uploaded, publishing_phase: { status: "not_started" } }, "processing", 0).step, "wait");
  assert.equal(facebookReelNext({ ...uploaded, publishing_phase: { status: "in_progress" } }, "uncertain", 0).step, "wait");
  assert.equal(
    facebookReelNext({ processing_phase: { status: "error", error: { message: "bad video" } } }, "processing", 0).step,
    "failed",
  );
  assert.equal(facebookReelNext({}, "processing", 7 * 3600e3).step, "too-slow");
});
