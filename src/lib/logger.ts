/**
 * Structured logger for Cloudflare Workers log search.
 *
 * WHY this exists: the three form routes previously emitted free-text
 * console.error messages on email failures and no log at all on Turnstile
 * rejections. Structured JSON on a single line makes it trivial to filter
 * and alert in the Cloudflare Workers Logs dashboard by `event` or `reason`.
 * The admin surface (#237) reuses the same convention for its own event
 * family — see logAdminAuthFailure below — so every log line this app
 * emits, form or admin, is filterable the same way.
 *
 * WHY console.warn for turnstile_failed vs console.error for send_failed:
 * Turnstile failures are mostly bots — high volume, low signal. Keeping them
 * out of the error stream prevents alert fatigue when scraping bots hit the
 * forms. send_failed means Resend is down or the key is broken — a real
 * outage that warrants an error-level alert. db_write_failed (#258, the
 * public_submissions D1 queue) is error-level for the same reason as
 * send_failed — arguably more so, since the route still returns {ok: true}
 * on this path (the email is unaffected), so this log line is the ONLY
 * signal that a submission's durable queue row never landed.
 *
 * PII RULE: Callers must pass ONLY the fixed structured fields below.
 * Never pass IPs, email addresses, names, venue addresses, message bodies,
 * or any user-supplied content. The logger enforces this by design — it
 * accepts only typed parameters with no free-form string fields.
 */

import type { AccessDeniedReason } from "./adminOrigin";

export type FormName =
  | "suggest"
  | "report"
  | "feedback"
  | "checkin"
  | "checkin_photo"
  // Migration 0012 — the "what would help you next time?" needs-ask
  // follow-up route, same split reasoning as "checkin"/"checkin_photo".
  | "checkin_needs"
  // Blessing Boxes slice 6: "adopt" covers the adopt-a-box application route;
  // "alerts" covers every other alert-subscription route (giver sign-up,
  // confirm, stop, resubscribe, admin host-alerts) — split the same way
  // "checkin"/"checkin_photo" split two related-but-distinct write paths.
  | "adopt"
  | "alerts";
// "db_unavailable" (2026-09-18 security review, item 9): an unhandled D1
// exception on a public route, distinct from "db_write_failed" (a write that
// completed its round-trip but returned an unexpected result).
export type FormFailureReason = "turnstile_failed" | "send_failed" | "db_write_failed" | "db_unavailable";

interface FailureDetail {
  status?: number;
  message?: string;
  /** Blessing Boxes slice 6 (boxAlerts.ts's notifyBoxAlerts): how many claimed recipients lost their alert to this failure — a COUNT only, never the addresses themselves (this file's own PII rule). */
  recipientCount?: number;
}

/**
 * Emit a single-line JSON structured log entry for a form submission failure.
 * Routes to console.warn (turnstile_failed) or console.error (send_failed).
 */
export function logFormFailure(
  form: FormName,
  reason: FormFailureReason,
  detail?: FailureDetail,
): void {
  const entry: Record<string, unknown> = {
    event: "form_submit_failure",
    form,
    reason,
  };

  if (detail?.status !== undefined) {
    entry.status = detail.status;
  }
  if (detail?.message !== undefined) {
    entry.message = detail.message;
  }
  if (detail?.recipientCount !== undefined) {
    entry.recipientCount = detail.recipientCount;
  }

  const line = JSON.stringify(entry);

  if (reason === "turnstile_failed") {
    console.warn(line);
  } else {
    console.error(line);
  }
}

/**
 * Emit a single-line JSON structured log entry for an admin-surface auth
 * denial (bad origin / no session / not allowlisted — see
 * src/lib/adminOrigin.ts). `reason` is the same coarse, machine-readable
 * classification AccessDeniedError carries — never the token itself, never
 * a claim value. Logged at warn level: most denials are ordinary
 * unauthenticated traffic hitting an admin URL (high volume, low signal,
 * same reasoning as turnstile_failed above), not necessarily an attack.
 */
export function logAdminAuthFailure(reason: AccessDeniedReason): void {
  console.warn(JSON.stringify({ event: "admin_auth_failure", reason }));
}

export type AdminAuthEvent = "login";

/**
 * Emit a single-line JSON structured log entry for a successful admin auth
 * EVENT (Phase 3 dual-auth) — the observability counterpart to
 * logAdminAuthFailure() above, for the success path. `event` is a fixed
 * label only (currently just "login", emitted on Better Auth session
 * creation — see auth-options.ts's databaseHooks.session.create.after) —
 * NEVER an email, token, or session id, matching this file's PII rule.
 * Durable per-login history (timestamp, IP, user-agent) already lives in
 * Better Auth's own `session` table (D1); this line exists only so a login
 * is ALSO visible in Cloudflare Workers Logs search/alerting, the same way
 * admin_auth_failure already is.
 */
export function logAdminAuthEvent(event: AdminAuthEvent): void {
  console.log(JSON.stringify({ event: "admin_auth_event", type: event }));
}

/**
 * Emit a single-line JSON structured log entry when the public live
 * blessing-boxes read (GET /api/public/blessing-boxes, /box/<id>,
 * sitemap.ts) fails to reach D1. Error-level: unlike a form's db_write_failed
 * (where the email still went out), this is the ONLY data path for a box —
 * a failure here means the box layer degrades to empty/absent for that
 * request, so it's worth the same alert-level visibility as a Resend outage.
 */
export function logBlessingBoxesReadFailure(message: string): void {
  console.error(JSON.stringify({ event: "blessing_boxes_read_failure", message }));
}

export type PublishOutcome = "success" | "failure";

interface PublishResultDetail {
  /** The bot-branch PR URL — present on success, and on a failure that got
   *  as far as opening/reusing a PR before a later step failed. */
  prUrl?: string;
  /** Error text only — never PII (no admin email, no venue data). */
  message?: string;
}

/**
 * Emit a single-line JSON structured log entry for a POST /api/admin/publish
 * outcome (#237 checkpoint d; spec §8 "Structured logging" names
 * `event: "publish_result"` alongside the existing admin_auth_failure /
 * refresh_ingest_result convention). Logged at error level on failure so a
 * broken publish (e.g. the GitHub commit step failing, per the NB1 ordering
 * note in src/lib/publishVenues.ts) surfaces the same way a Resend outage
 * does today.
 */
export function logPublishResult(
  outcome: PublishOutcome,
  detail?: PublishResultDetail,
): void {
  const entry: Record<string, unknown> = { event: "publish_result", outcome };
  if (detail?.prUrl !== undefined) entry.prUrl = detail.prUrl;
  if (detail?.message !== undefined) entry.message = detail.message;

  const line = JSON.stringify(entry);
  if (outcome === "success") {
    console.log(line);
  } else {
    console.error(line);
  }
}
