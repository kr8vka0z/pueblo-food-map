/**
 * Structured form-failure logger for Cloudflare Workers log search.
 *
 * WHY this exists: the three form routes previously emitted free-text
 * console.error messages on email failures and no log at all on Turnstile
 * rejections. Structured JSON on a single line makes it trivial to filter
 * and alert in the Cloudflare Workers Logs dashboard by `event` or `reason`.
 *
 * WHY console.warn for turnstile_failed vs console.error for send_failed:
 * Turnstile failures are mostly bots — high volume, low signal. Keeping them
 * out of the error stream prevents alert fatigue when scraping bots hit the
 * forms. send_failed means Resend is down or the key is broken — a real
 * outage that warrants an error-level alert.
 *
 * PII RULE: Callers must pass ONLY the fixed structured fields below.
 * Never pass IPs, email addresses, names, venue addresses, message bodies,
 * or any user-supplied content. The logger enforces this by design — it
 * accepts only typed parameters with no free-form string fields.
 */

export type FormName = "suggest" | "report" | "feedback";
export type FormFailureReason = "turnstile_failed" | "send_failed";

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
