/**
 * Shared email-format helpers (moved out of the now-deleted src/lib/rateLimit.ts
 * — #587 — which bundled these pure functions alongside the in-process rate
 * limiter it also exported; only the email helpers survive that file).
 *
 * Used by the three public submit routes' server-side validation
 * (report/suggest/feedback) and by the Blessing Boxes adopt/alerts/
 * host-alerts routes for their own email fields.
 */

import { FIELD_LIMITS } from "@/lib/fieldLimits";

/** Email-format guard shared by every submission validator. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bounded email-format check (#269). Each caller already rejects an
 * over-length email before reaching this (its own "Email address too long"
 * check against FIELD_LIMITS.EMAIL) — but that earlier length comparison
 * isn't a call-site-local bound CodeQL's polynomial-ReDoS taint tracking
 * recognizes as a sanitizer for EMAIL_RE.test(). .slice() here is a no-op on
 * any input a caller's length guard already passed; it exists purely to
 * make the bound structural at the regex's own call site, clearing the
 * alert once here instead of at every call site.
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.slice(0, FIELD_LIMITS.EMAIL));
}

/**
 * Trims and lowercases an email ONCE at a route boundary (2026-09-18
 * security review, item 3) — every public/admin route touching a Blessing
 * Boxes alert email (adopt, giver alert sign-up, host-alerts admin) now
 * calls this exactly once, before validation, storage, or use as a
 * rate-limit key, so "Foo@X.com" and "foo@x.com" are always the same row
 * rather than two. Email addresses are case-INsensitive at the domain part
 * always, and in practice for the local part too for every mail provider
 * this app's users plausibly use — normalizing once here is simpler and
 * safer than trying to match on either casing everywhere a lookup happens.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
