/**
 * D1-backed rate limiting for the three public submission forms —
 * /report/submit, /suggest/submit, /feedback/submit (#587).
 *
 * WHY this replaces src/lib/rateLimit.ts's in-process Map: that store was
 * per-isolate, and Cloudflare Workers run many isolates concurrently — a
 * flood spread across isolates (trivial with a paid Turnstile-solving
 * service) sailed past a "5/hour" cap that only ever saw a fraction of the
 * real traffic. This file is a thin, form-specific wrapper over
 * src/lib/checkinRateLimit.ts's checkAndIncrement(), which already solves
 * that problem for the Blessing Boxes check-in path with one shared D1
 * counter every isolate reads and writes — see that file's own header for
 * the underlying atomicity/HMAC-key/fail-closed reasoning, unchanged here.
 *
 * WHY no new table or migration: checkAndIncrement's key is an HMAC of
 * `scope:id:hourBucket` in the existing box_checkin_rate_limit table — a
 * new scope label is all a new caller needs (migrations/0007). The three
 * scopes below ("form-report", "form-suggest", "form-feedback", each with a
 * "-site" sibling) can never collide with the box/visitor-box scopes the
 * check-in path already uses.
 *
 * WHY two caps per form (per-IP AND site-wide): a per-IP cap alone can't
 * bound total damage from a flood that rotates IPs (exactly what a paid
 * solving service does) — MAX_SITE_WIDE_PER_HOUR bounds the form's total
 * blast radius regardless of how many distinct IPs an attacker uses.
 * MAX_PER_IP_PER_HOUR keeps the original 5/hr-per-submitter courtesy limit
 * that was already in place (now correctly enforced, since it's counted in
 * one shared store instead of per-isolate).
 *
 * WHY per-IP is checked BEFORE site-wide (mirrors checkinRateLimit.ts's own
 * "visitor cap before box cap" reasoning exactly): checking the shared
 * site-wide counter first would let one already-over-its-own-limit IP keep
 * burning the shared site budget on its own rejected retries, which could
 * starve every OTHER submitter site-wide even though the true offender is a
 * single IP. Checking per-IP first means an IP already over its own cap is
 * rejected before it can touch the site-wide counter at all.
 *
 * WHY 5/hour per IP, 50/hour site-wide: this is a city-scale community map
 * — even a genuinely busy day (a local news mention, a community event)
 * plausibly sees a handful of real submissions per form, not dozens per
 * hour. 50/hour (1,200/day ceiling) is generous headroom over that honest
 * ceiling while still bounding a scripted flood's worst case to something
 * that doesn't drown issues@/suggestions@/feedback@ or burn a day's Resend
 * quota in minutes — a flood that clears 50 requests in seconds is still
 * caught by Turnstile/the per-IP cap almost immediately either way; this
 * cap exists for the case where a flood spreads across many IPs to evade
 * that.
 *
 * WHY a single "rate_limit" error code for both caps, not two distinct
 * codes (contrast with checkins/route.ts's rate_limit_visitor vs.
 * rate_limit_box): ReportForm.tsx/SuggestForm.tsx/FeedbackForm.tsx already
 * branch on the literal string "rate_limit" and show one generic "slow
 * down" message — splitting the code would require touching all three
 * client components (+ i18n copy + their tests) for no user-facing benefit,
 * since a public form submitter has no actionable difference between "you
 * personally are submitting too fast" and "this form is busy right now."
 */

import { checkAndIncrement } from "@/lib/checkinRateLimit";

export const MAX_PER_IP_PER_HOUR = 5;
export const MAX_SITE_WIDE_PER_HOUR = 50;

export type FormName = "report" | "suggest" | "feedback";

/**
 * Returns true if this submission is under BOTH caps for `form`, atomically
 * incrementing both D1 counters as part of the same check (same contract as
 * checkAndIncrement itself). `ip` is passed straight into checkAndIncrement,
 * which only ever uses it to build the HMAC'd key (see checkinRateLimit.ts's
 * RateLimitScope docs) — the raw IP is never written to D1.
 */
export async function checkFormRateLimit(
  db: D1Database,
  secret: string,
  form: FormName,
  ip: string,
): Promise<boolean> {
  const perIpOk = await checkAndIncrement(db, secret, { scope: `form-${form}`, id: ip }, MAX_PER_IP_PER_HOUR);
  if (!perIpOk) return false;

  return checkAndIncrement(db, secret, { scope: `form-${form}-site`, id: "all" }, MAX_SITE_WIDE_PER_HOUR);
}
