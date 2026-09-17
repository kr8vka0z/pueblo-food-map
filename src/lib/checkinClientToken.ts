"use client";

/**
 * checkinClientToken.ts — a random, non-identifying token the browser keeps
 * in localStorage so the per-visitor rate-limit cap (src/lib/
 * checkinRateLimit.ts) has something to key off other than an IP address.
 *
 * WHY this exists: the Build Plan's per-visitor cap ("a handful of
 * check-ins per box per hour from one visitor") needs SOME way to tell two
 * visitors apart, but the same plan forbids storing an IP address anywhere
 * in the check-in write path (see checkinRateLimit.ts's own header). A
 * self-assigned random string that never leaves the browser except as an
 * opaque rate-limit key is not a real-world identifier — it identifies
 * nothing about the person, only "the same browser asked before." This is
 * the same anonymity class the Build Plan already commits to for F7's
 * planned phone-local fill tally ("nothing stored on the site and no
 * account — same method as today's saved favorites"): a value that lives
 * only on the device, never tied to a name, email, or session.
 *
 * Losing it (clearing site data, a new device, private browsing) simply
 * starts a fresh rate-limit window — never a loss of any real functionality,
 * since check-ins themselves are, and remain, fully anonymous.
 */

const STORAGE_KEY = "pfm-checkin-client-token";

/** crypto.randomUUID() is unavailable on very old/non-HTTPS contexts; this is only ever a rate-limit key, so a lower-entropy fallback is fine — it's not protecting anything sensitive. */
function generateToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Returns the browser's existing check-in client token, minting and storing
 * a new one on first use. Returns null when localStorage is unavailable
 * (SSR, privacy mode blocking storage) — callers must treat that as "no
 * per-visitor cap can apply this request," never as an error.
 */
export function getCheckinClientToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const token = generateToken();
    window.localStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    return null; // localStorage blocked (private mode, storage quota, etc.)
  }
}
