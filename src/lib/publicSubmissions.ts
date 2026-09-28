/**
 * publicSubmissions.ts — shared write path for the public_submissions D1
 * queue (migrations/0002_public_submissions.sql, #258).
 *
 * Both /suggest/submit and /report/submit write a pending row here after
 * their existing anti-abuse guards and field validation pass. Centralized
 * in one function (rather than the same INSERT string copy-pasted into two
 * route files) so the column list/order can't silently drift between the
 * two call sites — same reasoning as this app's other per-concern shared
 * helpers (email.ts, turnstile.ts, fieldLimits.ts, formRateLimit.ts) that
 * both routes already import.
 *
 * WHY callers pass a D1Database directly instead of this module calling
 * getAdminDb(): getAdminDb() (src/lib/adminDb.ts) gates on a live admin
 * Better Auth session — correct for AUTHENTICATED /admin/** routes,
 * but /suggest/submit and /report/submit are PUBLIC, unauthenticated
 * routes. Callers fetch the binding themselves via
 * getCloudflareContext().env.ADMIN_DB and pass it in.
 *
 * WHY this function never catches its own errors: a D1 outage must not
 * block the caller's email send (ARCHITECTURE.md "Form-route triad"), but
 * that policy belongs to the two route handlers, not to this shared
 * primitive — each route wraps its own call in try/catch and logs via
 * logFormFailure(form, "db_write_failed", ...) so the failure is attributed
 * to the right form.
 */

import type { ParsedProposal } from "@/lib/adminProposals";

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

// ─── Review queue shapes (#259; consumed by Places + the edit page since #675) ─
// Added alongside the write-path types above (same file — this module
// already owns the queue's write shape, so its read/payload shapes belong
// here too rather than in a third module). Originally read only by the now-
// retired /admin/submissions/page.tsx; #675 folded that queue into the
// Places tab and the venue edit page's "Suggestions to review" box, both of
// which import ReviewSubmission/parseSubmissionRow (below) directly.

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
 * exactly the `sanitized` object src/app/(site)/suggest/submit/route.ts writes.
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
 * exactly the `sanitized` object src/app/(site)/report/submit/route.ts writes.
 */
export interface ClosurePayload {
  venueId: string;
  venueName: string;
  venueAddress: string;
  issueType: string;
  description: string;
  contactEmail?: string;
}

// ─── Review-surface shapes (#675, "fold the Review queue into Places") ─────
// Moved here from the now-deleted SubmissionsReviewView.tsx / retired
// /admin/submissions/page.tsx: both the Places tab (src/app/(site)/admin/places/page.tsx)
// and the venue edit page (src/app/(site)/admin/venues/[id]/edit/page.tsx) now parse
// `public_submissions` rows, so the shared read/payload shape belongs in this
// module (which already owns the write-path types above) rather than in
// either page or a component.

interface ReviewSubmissionBase {
  id: number;
  createdAt: string;
  /** submitter_email column — present regardless of payload-parse success. */
  submitterEmail: string | null;
  /** target_venue_id column — populated for "closure", null for "new_venue"; a
   *  real column (not inside the JSON payload), so the closure approve action
   *  works even on a row whose payload failed to parse. */
  targetVenueId: string | null;
}

/**
 * Discriminated on `parseError` first, then `kind` — a row whose stored
 * `payload` JSON failed to parse (parseSubmissionRow below wraps that per
 * row) degrades to the `parseError: true` arm regardless of kind, carrying
 * no payload at all rather than a guessed/partial one.
 */
export type ReviewSubmission =
  | (ReviewSubmissionBase & { kind: "new_venue"; parseError: false; payload: NewVenuePayload })
  | (ReviewSubmissionBase & { kind: "closure"; parseError: false; payload: ClosurePayload })
  | (ReviewSubmissionBase & { kind: PublicSubmissionKind; parseError: true; payload: null });

/**
 * Parses one D1 row into ReviewSubmission, degrading to `parseError: true`
 * on any bad JSON rather than throwing — one malformed row must degrade to
 * that single card's own error state, never blank the whole queue or 500
 * the page (same per-row defensive pattern SubmissionCard.tsx's parseError
 * branch renders).
 */
export function parseSubmissionRow(row: PublicSubmissionRow): ReviewSubmission {
  const base = {
    id: row.id,
    createdAt: row.created_at,
    submitterEmail: row.submitter_email,
    targetVenueId: row.target_venue_id,
  };

  try {
    if (row.kind === "new_venue") {
      return { ...base, kind: "new_venue", parseError: false, payload: JSON.parse(row.payload) as NewVenuePayload };
    }
    return { ...base, kind: "closure", parseError: false, payload: JSON.parse(row.payload) as ClosurePayload };
  } catch {
    return { ...base, kind: row.kind, parseError: true, payload: null };
  }
}

/**
 * ReviewItem — the discriminated union both the Places tab (VenueListView's
 * "To review" cell + summary counts) and the edit page's SuggestionsBox
 * dispatch on (#675). Two independent review sources — the automated
 * refresh's `change_proposals` and the public's `public_submissions` — used
 * to render on two entirely separate screens (Data refresh, /admin/flags;
 * Review queue, /admin/submissions); #674 folded the first into Places and
 * this box, #675 folds the second in the SAME way, so a caller that already
 * has a mixed list of "things to review" for one venue can render it without
 * knowing which table each one came from. `ParsedProposal` is imported from
 * adminProposals.ts (that module owns change_proposals parsing); this file
 * already owns `ReviewSubmission` above.
 */
export type ReviewItem =
  | { kind: "proposal"; proposal: ParsedProposal }
  | { kind: "submission"; submission: ReviewSubmission };

/** A stable React key across both item kinds — a proposal id and a submission id are independent sequences, so a bare numeric id could collide between them. */
export function reviewItemKey(item: ReviewItem): string {
  return item.kind === "proposal" ? `proposal-${item.proposal.row.id}` : `submission-${item.submission.id}`;
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
