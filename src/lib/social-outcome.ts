// What to do with an Instagram or Facebook post after each step, kept apart
// from the network so it can be tested. The rule: a call that publishes is
// sent at most once per claim, and when it fails in a way that may have
// published anyway, the post becomes "uncertain" and is checked, never re-sent
// blindly.

// Thrown when a call that publishes may have gone through: a timeout, a
// dropped connection, a 5xx, or a success answer without the expected id.
export class MaybeSent extends Error {}

// Did a failed call that publishes maybe publish anyway? A clear 4xx (bad
// request, permission, rate limit) means it was refused; anything without an
// HTTP answer, or a server error, may have gone through.
export function maybeSent(e: unknown) {
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status >= 500 || status === 408;
  return true;
}

// Runs one call that publishes. A failure that may have published becomes
// MaybeSent; a clear refusal is re-thrown as it is.
export async function sendOnce<T>(call: () => Promise<T>, hasResult: (r: T) => boolean): Promise<T> {
  let result: T;
  try {
    result = await call();
  } catch (e) {
    if (e instanceof MaybeSent || maybeSent(e)) throw new MaybeSent(e instanceof Error ? e.message : String(e));
    throw e;
  }
  if (!hasResult(result)) throw new MaybeSent("The network answered without the id of what it published.");
  return result;
}

type From = "pending" | "processing" | "uncertain";

// The claim ends without publishing: the post goes back to where it was
// (an "uncertain" post stays uncertain). Three failed tries end in "failed".
export function releaseFields(from: string, attempts: number, error: string) {
  if (from === "uncertain") return { status: "uncertain", error: error.slice(0, 500), claim_token: null };
  const next = attempts + 1;
  return {
    status: next >= 3 ? "failed" : (from as From),
    attempts: next,
    error: error.slice(0, 500),
    claim_token: null,
  };
}

export function uncertainFields(error: string) {
  return {
    status: "uncertain",
    error: `May have been published (${error}). It will be checked before any new attempt.`.slice(0, 500),
    claim_token: null,
  };
}

// Instagram container status (status_code) for a post that already has one.
// PUBLISHED: an earlier call did publish it. FINISHED: ready and not yet
// published, so publishing now cannot make a second post (a container is
// published at most once).
export type IgStep = "published" | "publish" | "wait" | "failed" | "too-slow";
export function instagramNext(statusCode: string, from: string, ageMs: number): IgStep {
  if (statusCode === "PUBLISHED") return "published";
  if (statusCode === "FINISHED") return "publish";
  if (statusCode === "IN_PROGRESS") return from === "processing" && ageMs > 6 * 3600e3 ? "too-slow" : "wait";
  return "failed"; // ERROR or EXPIRED
}

// Facebook Reel status for a post that already has its video. "finish" means
// the publish request never arrived; sending it again for the same video
// cannot make a second Reel.
export type FbStep = "published" | "finish" | "wait" | "failed" | "too-slow";
export type FbVideoStatus = {
  video_status?: string;
  uploading_phase?: { status?: string };
  processing_phase?: { status?: string; error?: { message?: string } };
  publishing_phase?: { status?: string; errors?: { message?: string }[] };
};
export function facebookReelNext(st: FbVideoStatus, from: string, ageMs: number): { step: FbStep; problem?: string } {
  const problem =
    st.processing_phase?.error?.message ||
    st.publishing_phase?.errors?.[0]?.message ||
    (st.video_status === "error" ? "Facebook could not process the video." : "");
  if (problem) return { step: "failed", problem };
  const publishing = st.publishing_phase?.status;
  if (publishing === "complete") return { step: "published" };
  if (publishing === "not_started" && st.uploading_phase?.status === "complete" && from !== "processing")
    return { step: "finish" };
  if (from === "processing" && ageMs > 6 * 3600e3) return { step: "too-slow" };
  return { step: "wait" };
}
