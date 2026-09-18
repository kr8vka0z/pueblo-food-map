/**
 * boxTurnstile.ts — the box-check-in Turnstile key-selection + verification
 * logic, extracted so the photo upload route (slice 5) can reuse it rather
 * than copy it (the task's own instruction: "Turnstile via the same
 * box/fallback key logic already in the check-in route — reuse, don't
 * copy").
 *
 * Both public blessing-box write paths (check-ins, photo uploads) share the
 * SAME two-widget Turnstile setup: a dedicated invisible-mode key
 * (NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY / TURNSTILE_BOX_SECRET_KEY) that
 * covers the common case with no visible challenge, and a fallback to the
 * ordinary managed-mode key (NEXT_PUBLIC_TURNSTILE_SITE_KEY /
 * TURNSTILE_SECRET_KEY) every other public form already uses, for a
 * visitor the invisible check doubts — see BoxCheckinPanel.tsx's own
 * header, "Fallback to a visible checkbox", for the full client-side state
 * machine this exists to support. A client's `turnstileKey` field picks
 * which secret this module verifies against; anything other than the
 * literal string "fallback" (missing, mistyped, tampered) is treated as
 * "box", the strict original default — never silently upgraded.
 */

import { verifyTurnstileToken } from "@/lib/turnstile";

export type BoxTurnstileKey = "box" | "fallback";

/** Strictly validates a client-supplied turnstileKey value — only the literal "fallback" ever resolves to the fallback path. */
export function resolveBoxTurnstileKey(rawKey: unknown): BoxTurnstileKey {
  return rawKey === "fallback" ? "fallback" : "box";
}

/** Picks the right server secret for `key` and verifies `token` against it. Throws (never returns false) if the required secret env var is unset — same fail-loud-on-misconfiguration convention every other secret-gated route in this app uses, so a missing secret surfaces immediately rather than silently rejecting every real submission as a Turnstile failure. */
export async function verifyBoxTurnstile(
  token: string | undefined,
  key: BoxTurnstileKey,
  clientIp: string,
): Promise<boolean> {
  const secret = key === "fallback" ? process.env.TURNSTILE_SECRET_KEY : process.env.TURNSTILE_BOX_SECRET_KEY;
  if (!secret) {
    throw new Error(key === "fallback" ? "TURNSTILE_SECRET_KEY not configured" : "TURNSTILE_BOX_SECRET_KEY not configured");
  }
  return verifyTurnstileToken(token, secret, clientIp);
}
