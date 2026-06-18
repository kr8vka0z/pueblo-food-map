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
