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

// ─── Review queue shapes (#259) ─────────────────────────────────────────────
// Added alongside the write-path types above (same file — this module
// already owns the queue's write shape, so its read/payload shapes belong
// here too rather than in a third module) for the admin review screen
// (src/app/admin/submissions/page.tsx) to consume.

/** One full row of the D1 `public_submissions` table (migrations/0002_public_submissions.sql). */
export interface PublicSubmissionRow {
  id: number;
  kind: PublicSubmissionKind;
  /** Raw JSON text — NewVenuePayload for kind="new_venue", ClosurePayload for kind="closure". */
  payload: string;
  target_venue_id: string | null;
  submitter_email: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
}

/**
 * The parsed `payload` shape a kind="new_venue" row's JSON deserializes to —
 * exactly the `sanitized` object src/app/suggest/submit/route.ts writes.
 * Duplicated here (not imported) because that route module is a
 * "use server"-adjacent route handler with its own local types, not a
 * shared lib — same reasoning AddVenueForm.tsx already gives for declaring
 * its own local copy of GeocodeMatch instead of importing a route's types.
 */
export interface NewVenuePayload {
  venueName: string;
  address: string;
  category: string;
  hours?: string;
  contact?: string;
  acceptsSnap: boolean;
  acceptsWic: boolean;
  notes?: string;
  submitterEmail: string;
}

/**
 * The parsed `payload` shape a kind="closure" row's JSON deserializes to —
 * exactly the `sanitized` object src/app/report/submit/route.ts writes.
 */
export interface ClosurePayload {
  venueId: string;
  venueName: string;
  venueAddress: string;
  issueType: string;
  description: string;
  contactEmail?: string;
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
