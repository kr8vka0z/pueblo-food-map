/**
 * boxNeedsToken.ts — mint/verify the stateless capability proving the SAME
 * device that made a 'took' check-in is the one attaching a "what would
 * help you next time?" answer to it (migration 0012, the needs-ask
 * follow-up request).
 *
 * WHY not a client-token-hash column on box_checkins: that would durably
 * correlate every 'took' row to a per-browser identifier, and 0007's own
 * header is explicit that box_checkins stores "no name, no email, no IP
 * address — ever" — adding a persistent correlator for one feature's
 * convenience would be a real, unreviewed privacy widening. Instead the
 * checkins route mints `HMAC(CHECKIN_RATE_LIMIT_SECRET, "needs:<checkinId>:
 * <clientToken>")` (the SAME secret + hmacHex helper checkinRateLimit.ts
 * already has — no new secret) and hands it back ONLY in that POST's own
 * response body. The needs route recomputes the identical HMAC from the
 * client-submitted checkinId + clientToken and compares. Nothing new is
 * ever written to D1: a request that never received this exact response
 * can't forge a match without the server secret, and losing the token (a
 * refreshed page) just means "no more editing this check-in's needs" —
 * the same low-stakes failure mode checkinClientToken.ts's own header
 * already accepts for its rate-limit token.
 *
 * WHY a manual constant-time compare, not crypto.subtle.timingSafeEqual:
 * that API is a Node/Workers-runtime addition, absent under vitest/jsdom
 * (this route's own test environment) — a hand-rolled equal-length XOR
 * loop behaves identically in both and is the standard shim for this exact
 * gap (see e.g. how other Workers apps handle it; no library exists here
 * worth a new dependency for nine bytes of logic).
 */

import { hmacHex } from "@/lib/checkinRateLimit";

/** clientToken is normalized to "" when absent — a missing client token still yields a valid, unforgeable token (the HMAC secret alone protects it), it just means anyone holding the exact response body (only the original browser ever received it) can use it, same trust level checkinRateLimit.ts already accepts for a missing clientToken. */
export async function computeNeedsToken(
  secret: string,
  checkinId: number,
  clientToken: string | null,
): Promise<string> {
  return hmacHex(secret, `needs:${checkinId}:${clientToken ?? ""}`);
}

/** Equal-length XOR compare — see this file's own header for why this replaces crypto.subtle.timingSafeEqual here. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
