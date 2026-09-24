/**
 * emailRetention.ts — 90-day email retention cleanup, run from the existing
 * 5-minute heartbeat cron (custom-worker.ts's scheduled()). Blanks/deletes
 * the three PII columns the 2026-09-23 privacy review flagged (#594,
 * finding #4: nothing ever removed `public_submissions.submitter_email`,
 * a rejected `box_adopters.email`, or an unsubscribed
 * `alert_subscriptions.email`).
 *
 * WHY 90 days: retention period Kyle picked for #594 — long enough to
 * review or follow up on a submission or a turned-down/stopped contact,
 * short enough that an old email address isn't kept indefinitely. See the
 * /privacy copy (src/lib/i18n.ts privacy.retention.*) for the user-facing
 * statement of this same number.
 *
 * WHY this file has no `next/*` or `getCloudflareContext` import: it runs
 * from custom-worker.ts's scheduled() handler, not a request — there is no
 * Next.js request context to read. The D1 binding is passed in directly
 * from `env.ADMIN_DB` (same direct-binding pattern the two public,
 * unauthenticated submit routes already use for public_submissions —
 * AGENTS.md "Admin panel" — never getAdminDb(), which requires a live
 * admin session that a cron trigger will never have).
 *
 * SQL shape, one UPDATE/DELETE per table, all idempotent and gated on the
 * same ISO cutoff string (all three timestamp columns already use
 * `strftime('%Y-%m-%dT%H:%M:%fZ','now')`/`toISOString()`, so a plain `<`
 * text comparison is correct — no SQL date function needed):
 *
 *  - public_submissions: submitter_email is nullable, so blanks to NULL.
 *    Also strips the same address out of the `payload` JSON blob via
 *    `json_remove` (migrations/0002's own header: payload duplicates
 *    submitterEmail/contactEmail) — leaving it there would make the column
 *    blank a decoy while the real address sat one column over.
 *    `json_remove` on a path that doesn't exist for a row's `kind` is a
 *    silent no-op (SQLite json1), so one statement covers both submission
 *    kinds without a CASE.
 *  - box_adopters.email is NOT NULL (migrations/0010) with no UNIQUE
 *    constraint on it — blanks to '' in place, row kept for audit, per the
 *    issue's own instruction for this table.
 *  - alert_subscriptions.email is NOT NULL AND part of
 *    UNIQUE(role, venue_id, email) (migrations/0010). A constant blank
 *    value ('') would collide the moment a second unsubscribed
 *    subscription shares a role+venue. DELETE instead of blank-in-place —
 *    also sidesteps a real resurrection bug: boxAlerts.ts's
 *    resubscribeByToken() clears `unsubscribed_at` by token with no
 *    expiry check, so blanking (rather than deleting) a >90-day-old row
 *    would let a stale unsubscribe-link click reactivate a subscription
 *    with a garbage email — the next alert send would then target a fake
 *    address instead of failing closed. An unsubscribed row also carries
 *    no audit value once gone (unlike box_adopters, which the issue
 *    explicitly wants kept for review history).
 */

export const EMAIL_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * ISO cutoff — rows strictly older than this get cleaned up. Computed in
 * JS from the cron's own scheduled time (not `datetime('now', ...)` in
 * SQL) so the job is deterministic and testable against a fixed `now`.
 */
export function retentionCutoffIso(now: Date): string {
  return new Date(now.getTime() - EMAIL_RETENTION_DAYS * MS_PER_DAY).toISOString();
}

// Cron fires every 5 minutes (wrangler.jsonc `triggers.crons`), but this
// job only needs to run once a day — 288 near-identical UPDATE/DELETE
// statements a day for a handful of newly-90-day-old rows would be pure D1
// load for no benefit. A stateless "only in this one UTC slot" check is
// the cheapest correct gate: no extra D1 read/table needed just to track
// "did we already run today," and it can never drift out of sync with a
// tracking row the way a written "last ran" timestamp could.
// 09:00 UTC = 2/3am Mountain (MDT/MST) — low-traffic hour, and clear of the
// deploy workflows' own smoke-test windows.
const RETENTION_RUN_HOUR_UTC = 9;

/** True for exactly one of the 288 daily 5-minute cron ticks. */
export function shouldRunEmailRetention(scheduledTimeMs: number): boolean {
  const d = new Date(scheduledTimeMs);
  return d.getUTCHours() === RETENTION_RUN_HOUR_UTC && d.getUTCMinutes() === 0;
}

export interface EmailRetentionCounts {
  submissionsBlanked: number;
  adoptersBlanked: number;
  subscriptionsDeleted: number;
}

// json_remove is a no-op for a path absent on a given row, so one
// statement safely covers both public_submissions `kind`s ('new_venue'
// payloads carry submitterEmail, 'closure' payloads carry contactEmail —
// migrations/0002's own header). `json_valid` guards a single malformed
// `payload` row: an UPDATE is one statement, so json_remove throwing on
// ANY matched row aborts the whole statement — rolling back the column
// blank for every other, well-formed row in the same run, not just the
// bad one. Falling back to `payload` unchanged for that one row means the
// column still gets blanked (the primary target) even when the redundant
// payload copy can't be safely touched.
const BLANK_SUBMISSIONS_SQL = `
  UPDATE public_submissions
  SET submitter_email = NULL,
      payload = CASE WHEN json_valid(payload)
                      THEN json_remove(payload, '$.submitterEmail', '$.contactEmail')
                      ELSE payload END
  WHERE submitter_email IS NOT NULL AND created_at < ?
`;

const BLANK_ADOPTERS_SQL = `
  UPDATE box_adopters
  SET email = ''
  WHERE email <> '' AND status = 'rejected' AND reviewed_at IS NOT NULL AND reviewed_at < ?
`;

const DELETE_SUBSCRIPTIONS_SQL = `
  DELETE FROM alert_subscriptions
  WHERE unsubscribed_at IS NOT NULL AND unsubscribed_at < ?
`;

/**
 * Runs one statement and returns its row count, or 0 + a pushed error
 * message on failure — never throws. Each of the three tables' cleanup is
 * isolated this way (see runEmailRetentionCleanup below) so a failure in
 * one (a D1 blip, an unexpected constraint) can't also skip the other two
 * for the day — this job only gets one shot at each table per 24h
 * (shouldRunEmailRetention), so losing all three to one table's problem
 * would be a much larger miss than losing one.
 */
async function runOne(db: D1Database, sql: string, cutoff: string, errors: string[]): Promise<number> {
  try {
    const result = await db.prepare(sql).bind(cutoff).run();
    return result.meta?.changes ?? 0;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return 0;
  }
}

/**
 * Thrown by runEmailRetentionCleanup when at least one statement failed.
 * Carries `counts` for the statements that DID succeed — without this,
 * a partial failure (e.g. box_adopters and alert_subscriptions committed,
 * public_submissions errored) would lose those counts entirely: the
 * caller's failure log would show only an error string, with no record
 * that real cleanup still happened that day. logEmailRetentionResult can
 * still be called with `counts` on this path (custom-worker.ts does),
 * same PII-free numbers-only shape as the success case.
 */
export class EmailRetentionPartialFailure extends Error {
  constructor(
    message: string,
    public readonly counts: EmailRetentionCounts,
  ) {
    super(message);
    this.name = "EmailRetentionPartialFailure";
  }
}

/**
 * Runs all three cleanup statements against `db` and returns a PII-free
 * count of rows each one touched (logger.ts's PII rule — counts only,
 * never an id, email, or other row content). Sequential, not
 * `Promise.all` — this runs once a day, so there is no latency reason to
 * risk concurrent D1 statements against the same database. Throws
 * EmailRetentionPartialFailure (after every statement has had its own
 * independent attempt — see runOne above) if any statement failed, so the
 * caller's own failure log (custom-worker.ts's logEmailRetentionFailure)
 * still fires; counts already committed by the other statements are not
 * rolled back by this throw — each is its own D1 commit, and the thrown
 * error still carries them so they aren't lost from the log entirely.
 */
export async function runEmailRetentionCleanup(
  db: D1Database,
  now: Date = new Date(),
): Promise<EmailRetentionCounts> {
  const cutoff = retentionCutoffIso(now);
  const errors: string[] = [];

  const submissionsBlanked = await runOne(db, BLANK_SUBMISSIONS_SQL, cutoff, errors);
  const adoptersBlanked = await runOne(db, BLANK_ADOPTERS_SQL, cutoff, errors);
  const subscriptionsDeleted = await runOne(db, DELETE_SUBSCRIPTIONS_SQL, cutoff, errors);

  const counts = { submissionsBlanked, adoptersBlanked, subscriptionsDeleted };

  if (errors.length > 0) {
    throw new EmailRetentionPartialFailure(`email retention cleanup: ${errors.join("; ")}`, counts);
  }

  return counts;
}
