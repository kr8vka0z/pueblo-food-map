/**
 * /admin/venues/[id]/edit — Cloudflare Access-gated "Edit a venue" page,
 * plus the "Remove from map" (archive) action (#255); `?submission=<id>`
 * closure-report review context added #270.
 *
 * Same auth chain as /admin and /admin/venues/new (AGENTS.md "Admin
 * authentication"): getAdminDb() verifies the caller's Cloudflare Access
 * identity before this page renders anything, failing closed via Next's
 * forbidden() control-flow function on AccessDeniedError. Unlike the create
 * page, this one DOES have something to SELECT — the existing venue row —
 * so getAdminDb() here serves both the auth gate AND the read, same shape
 * as /admin's own list query. A missing/unknown id calls Next's notFound()
 * (a real 404), same control-flow convention as /venue/[id]/page.tsx.
 *
 * Renders AddVenueForm in edit mode (venueId + the row mapped to
 * initialValues via src/lib/adminVenueForm.ts's mapVenueRowToFormValues) and
 * ArchiveVenueButton underneath in a "Danger zone" section — two independent
 * Client Components, each owning its own mutation (PATCH vs. archive POST)
 * and its own success/error/redirect handling; this Server Component's only
 * job is the auth gate, the row fetch, and page chrome.
 *
 * #270: closures used to approve in one click straight from the review
 * queue (POST the archive route, no intermediate page) — this page is
 * where that flow now lands instead, so a closure report gets the same
 * edit-before-approve review a new_venue suggestion already gets (a report
 * may only mean "the hours changed," not "this place is really gone").
 * `?submission=<id>` is resolved by resolveClosureReportContext() below,
 * mirroring /admin/venues/new's own resolveSubmissionPrefill() (#259) —
 * same defensive "any failure mode degrades to the plain page, never a 404
 * or 500" shape — but matched against THIS venue specifically
 * (`target_venue_id === id`) rather than just id+kind+pending, since unlike
 * a new_venue create there IS an existing venue here to cross-check a
 * mismatched or stale link against. When accepted, the submission id
 * reaches ArchiveVenueButton as its own new `submissionId` prop (that
 * component's header explains the rest of the loop), and a clay-accented
 * banner shows the report's details so the admin has context before
 * deciding to edit, archive, or leave it and reject the report instead.
 *
 * params and searchParams are both Promises in Next.js 16 App Router — must
 * be awaited (same convention as /venue/[id]/page.tsx and
 * /admin/venues/new/page.tsx).
 */

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import AddVenueForm from "@/components/AddVenueForm";
import ArchiveVenueButton from "@/components/ArchiveVenueButton";
import { mapVenueRowToFormValues } from "@/lib/adminVenueForm";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import type { AdminVenueRow } from "@/types/venue";
import type { ClosurePayload, PublicSubmissionRow } from "@/lib/publicSubmissions";

interface ClosureReportContext {
  submissionId: number;
  /** null when the stored payload failed to parse — target_venue_id (the
   *  match this context was accepted on) is a real column independent of
   *  that payload, so the submissionId itself is still good; only the
   *  banner's descriptive text degrades to generic copy. Same
   *  parseError-tolerant reasoning as SubmissionsReviewView's closure
   *  card. */
  detail: { issueLabel: string; description: string } | null;
}

/**
 * Resolves `?submission=<id>` to a closure-report context, or null on ANY
 * failure mode: param absent/non-integer, no matching pending closure row,
 * or — the one check with no new_venue equivalent — a `target_venue_id`
 * that doesn't match THIS venue (`venueId`), closing off a mismatched or
 * copy-pasted link wiring an unrelated report's approval to this page.
 * Wrapped in its own try/catch so a D1 read failure here degrades to the
 * plain edit page rather than 500ing it — this banner is a nice-to-have,
 * unlike the venue row itself (whose own SELECT failure is allowed to
 * throw, same as before #270).
 */
async function resolveClosureReportContext(
  db: D1Database,
  venueId: string,
  rawSubmissionParam: string | undefined,
): Promise<ClosureReportContext | null> {
  if (!rawSubmissionParam) return null;

  const submissionId = Number(rawSubmissionParam);
  if (!Number.isInteger(submissionId) || submissionId <= 0) return null;

  try {
    const row = await db
      .prepare("SELECT * FROM public_submissions WHERE id = ? AND kind = 'closure' AND status = 'pending'")
      .bind(submissionId)
      .first<PublicSubmissionRow>();
    if (!row || row.target_venue_id !== venueId) return null;

    try {
      const payload = JSON.parse(row.payload) as ClosurePayload;
      const issueLabel = ISSUE_TYPES[payload.issueType as IssueTypeKey] ?? payload.issueType;
      return { submissionId, detail: { issueLabel, description: payload.description } };
    } catch {
      return { submissionId, detail: null }; // malformed stored JSON — banner falls back to generic copy
    }
  } catch {
    return null; // a D1 failure here must never crash the edit page itself
  }
}

export default async function EditVenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submission?: string }>;
}) {
  const { id } = await params;
  let email: string;
  let venue: AdminVenueRow | null;
  let closureContext: ClosureReportContext | null = null;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    venue = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(id).first<AdminVenueRow>();
    if (venue) {
      const { submission } = await searchParams;
      closureContext = await resolveClosureReportContext(db, id, submission);
    }
  } catch (err) {
    handlePageAuthError(err);
  }

  if (!venue) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Edit {venue.name}</h1>
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
      <div className="px-4 py-6 sm:px-6 space-y-6">
        {closureContext && (
          <div className="max-w-2xl rounded-[var(--radius-lg)] bg-[var(--color-clay-100)] px-4 py-3 text-sm text-[var(--color-clay-700)]">
            <p className="font-semibold">Reviewing a closure report</p>
            <p className="mt-1">
              {closureContext.detail
                ? `${closureContext.detail.issueLabel} — ${closureContext.detail.description}`
                : "A closure report was submitted for this venue."}
            </p>
            <Link href="/admin/submissions" className="mt-2 inline-block font-medium underline underline-offset-2">
              Back to review queue
            </Link>
          </div>
        )}
        <AddVenueForm venueId={venue.id} initialValues={mapVenueRowToFormValues(venue)} />

        <div className="max-w-2xl border-t border-[var(--color-bone-200)] pt-5">
          <h2 className="text-sm font-semibold text-[var(--color-ink-700)] mb-2">Danger zone</h2>
          <ArchiveVenueButton
            venueId={venue.id}
            venueName={venue.name}
            alreadyArchived={venue.status === "archived"}
            submissionId={closureContext?.submissionId}
          />
        </div>
      </div>
    </main>
  );
}
