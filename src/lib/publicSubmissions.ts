/**
 * publicSubmissions.ts — shared write path for the public_submissions D1
 * queue (migrations/0002_public_submissions.sql, #258).
 *
 * Both /suggest/submit and /report/submit write a pending row here after
 * their existing anti-abuse guards and field validation pass. Centralized
 * in one function (rather than the same INSERT string copy-pasted into two
 * route files) so the column list/order can't silently drift between the
 * two call sites — same reasoning as this app's other per-concern shared
 * helpers (rateLimit.ts, turnstile.ts, fieldLimits.ts) that both routes
 * already import.
 *
 * WHY callers pass a D1Database directly instead of this module calling
 * getAdminDb(): getAdminDb() (src/lib/adminDb.ts) gates on a verified
 * Cloudflare Access identity — correct for AUTHENTICATED /admin/** routes,
 * but /suggest/submit and /report/submit are PUBLIC, unauthenticated
 * routes. Callers fetch the binding themselves via
 * getCloudflareContext().env.ADMIN_DB and pass it in.
 *
 * WHY this function never catches its own errors: a D1 outage must not
 * block the caller's email send (AGENTS.md "Public submissions queue"), but
 * that policy belongs to the two route handlers, not to this shared
 * primitive — each route wraps its own call in try/catch and logs via
 * logFormFailure(form, "db_write_failed", ...) so the failure is attributed
 * to the right form.
 */

export type PublicSubmissionKind = "new_venue" | "closure";

export interface PublicSubmissionInsert {
  kind: PublicSubmissionKind;
  /** Plain object — JSON-serialized by this function. */
  payload: unknown;
  /** NULL for a new_venue suggestion; the reported venue's id for a closure. */
  targetVenueId: string | null;
  /** NULL when the submitter didn't provide one (report's contact email is optional). */
  submitterEmail: string | null;
}

// `status` is intentionally absent from both the column list and the bound
// values below — the schema's own DEFAULT 'pending' applies (matches this
// app's established convention of letting D1 DEFAULTs fill columns the
// route never sets, e.g. venues.created_at in scripts/seed-admin-db.ts).
const INSERT_SQL =
  "INSERT INTO public_submissions (kind, payload, target_venue_id, submitter_email) VALUES (?, ?, ?, ?)";

/** Inserts one pending public_submissions row. Fully parameterized — never string-interpolated. */
export async function insertPublicSubmission(
  db: D1Database,
  submission: PublicSubmissionInsert,
): Promise<void> {
  await db
    .prepare(INSERT_SQL)
    .bind(
      submission.kind,
      JSON.stringify(submission.payload),
      submission.targetVenueId,
      submission.submitterEmail,
    )
    .run();
}
