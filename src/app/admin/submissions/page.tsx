/**
 * /admin/submissions — the review queue (#259): approve or reject every
 * PENDING row in `public_submissions` (#258's write path; nothing read that
 * table until this page).
 *
 * Same Better Auth chain and page shape as every other admin surface
 * (AGENTS.md "Admin authentication"; src/app/admin/places/page.tsx):
 * getAdminDb() verifies identity before this page renders anything, failing
 * closed via Next's forbidden() control-flow function on AccessDeniedError.
 * This page only SELECTs (the actual approve/reject mutations live in
 * POST /api/admin/venues, POST /api/admin/venues/[id]/archive, and the new
 * POST /api/admin/submissions/[id]/reject), so — like /admin/places itself
 * — it has no requireAdminOrigin() CSRF check of its own.
 *
 * Header swapped for the shared AdminNav (admin dashboard build) — see that
 * component's own header for why every admin page now renders it instead
 * of a bespoke `<header>`. loadAdminNavCounts() is the one extra read this
 * page now performs, for AdminNav's pending-count pills.
 *
 * Query: `WHERE status = 'pending' ORDER BY created_at DESC` (AC1:
 * newest-first, and only what still needs a decision — approved/rejected
 * rows simply stop appearing once their status flips, no separate "archive"
 * step needed here).
 *
 * Each row's `payload` is a TEXT column holding one of two different JSON
 * shapes depending on `kind` (migrations/0002_public_submissions.sql's own
 * comment). Parsing is wrapped PER ROW (parseSubmissionRow below) rather
 * than once for the whole query result: one malformed row must degrade to
 * that single card showing "couldn't read details"
 * (SubmissionsReviewView's parseError branch), never blank the entire queue
 * or 500 the page.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import AdminNav from "@/components/AdminNav";
import SubmissionsReviewView, { type ReviewSubmission } from "@/components/SubmissionsReviewView";
import type { ClosurePayload, NewVenuePayload, PublicSubmissionRow } from "@/lib/publicSubmissions";

/** Parses one D1 row into SubmissionsReviewView's typed shape, degrading to `parseError: true` on any bad JSON rather than throwing. */
function parseSubmissionRow(row: PublicSubmissionRow): ReviewSubmission {
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

export default async function SubmissionsPage() {
  let email: string;
  let submissions: ReviewSubmission[];
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    const result = await db
      .prepare("SELECT * FROM public_submissions WHERE status = 'pending' ORDER BY created_at DESC")
      .all<PublicSubmissionRow>();
    submissions = result.results.map(parseSubmissionRow);
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      {/* No page-specific sub-heading here (unlike the other admin pages) —
          AdminNav's own "Review queue" nav label, shown active, would
          otherwise duplicate the exact same text and break a text-based
          test/assistive-tech query that can no longer tell the two apart. */}
      <AdminNav email={email} active="submissions" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        <SubmissionsReviewView submissions={submissions} />
      </div>
    </main>
  );
}
