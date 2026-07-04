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

import type { AccessDeniedReason } from "./cfAccess";

export type FormName = "suggest" | "report" | "feedback";
export type FormFailureReason = "turnstile_failed" | "send_failed" | "db_write_failed";

interface FailureDetail {
  status?: number;
  message?: string;
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

  const line = JSON.stringify(entry);

  if (reason === "turnstile_failed") {
    console.warn(line);
  } else {
    console.error(line);
  }
}

/**
 * Emit a single-line JSON structured log entry for an admin-surface auth
 * denial (Cloudflare Access JWT missing/invalid/misconfigured — see
 * src/lib/cfAccess.ts). `reason` is the same coarse, machine-readable
 * classification AccessDeniedError carries — never the token itself, never
 * a claim value. Logged at warn level: most denials are ordinary
 * unauthenticated traffic hitting an admin URL (high volume, low signal,
 * same reasoning as turnstile_failed above), not necessarily an attack.
 */
export function logAdminAuthFailure(reason: AccessDeniedReason): void {
  console.warn(JSON.stringify({ event: "admin_auth_failure", reason }));
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
