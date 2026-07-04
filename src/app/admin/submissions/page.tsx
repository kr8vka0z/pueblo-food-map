/**
 * /admin/submissions — the review queue (#259): approve or reject every
 * PENDING row in `public_submissions` (#258's write path; nothing read that
 * table until this page).
 *
 * Same Cloudflare Access auth chain and page shape as every other admin
 * surface (AGENTS.md "Admin authentication"; src/app/admin/page.tsx):
 * getAdminDb() verifies identity before this page renders anything, failing
 * closed via Next's forbidden() control-flow function on AccessDeniedError.
 * This page only SELECTs (the actual approve/reject mutations live in
 * POST /api/admin/venues, POST /api/admin/venues/[id]/archive, and the new
 * POST /api/admin/submissions/[id]/reject), so — like /admin itself — it has
 * no requireAdminOrigin() CSRF check of its own.
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
import { forbidden } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { AccessDeniedError } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";
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

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    const result = await db
      .prepare("SELECT * FROM public_submissions WHERE status = 'pending' ORDER BY created_at DESC")
      .all<PublicSubmissionRow>();
    submissions = result.results.map(parseSubmissionRow);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      logAdminAuthFailure(err.reason);
      forbidden();
    }
    throw err;
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Review queue</h1>
          <Link
            href="/admin"
            className="text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
          >
            Back to venue list
          </Link>
        </div>
        <p className="text-sm text-[var(--color-ink-500)]">
          Signed in as{" "}
          <span className="font-medium text-[var(--color-sage-700)]">{email}</span>
        </p>
      </header>
      <div className="px-4 py-6 sm:px-6">
        <SubmissionsReviewView submissions={submissions} />
      </div>
    </main>
  );
}
