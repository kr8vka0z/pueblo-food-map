/**
 * Shared submission-form helpers for the /report, /suggest, and /feedback
 * POST routes (extracted from byte-for-byte duplicated copies in each route).
 *
 * Rate limiter: a simple in-process sliding window, keyed by IP string. The
 * store resets when the Worker cold-starts. Good enough for v1 spam deterrence.
 *
 * Each route gets its OWN store via createRateLimiter() — the three endpoints
 * intentionally keep independent per-IP buckets (5/hr each), exactly as before
 * this extraction, when each route owned a private module-level Map. Do NOT
 * collapse these into one shared store: that would change behavior, turning
 * three independent 5/hr limits into a single global 5/hr-per-IP limit.
 */

import { FIELD_LIMITS } from "@/lib/fieldLimits";

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Build an isolated sliding-window rate limiter with its own private store.
 * Returns a checkRateLimit(ip) → boolean (true = allowed, false = blocked).
 */
export function createRateLimiter(): (ip: string) => boolean {
  const rateLimitStore = new Map<string, RateLimitEntry>();

  return function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      // New window
      rateLimitStore.set(ip, { count: 1, windowStart: now });
      return true; // allowed
    }

    if (entry.count >= RATE_LIMIT_MAX) {
      return false; // blocked
    }

    entry.count += 1;
    return true; // allowed
  };
}

/** Email-format guard shared by all submission validators. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bounded email-format check for the three public submit routes (#269).
 * Each caller already rejects an over-length email before reaching this
 * (its own "Email address too long" check against FIELD_LIMITS.EMAIL) — but
 * that earlier length comparison isn't a call-site-local bound CodeQL's
 * polynomial-ReDoS taint tracking recognizes as a sanitizer for EMAIL_RE.test().
 * .slice() here is a no-op on any input a caller's length guard already
 * passed; it exists purely to make the bound structural at the regex's own
 * call site, clearing the alert once here instead of at all three routes —
 * mirrors the identical fix already shipped for the admin form's separate
 * email field (adminVenueValidation.ts's validateCreateVenuePayload).
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.slice(0, FIELD_LIMITS.EMAIL));
}
