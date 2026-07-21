/**
 * /admin/venues/new — Cloudflare Access-gated "Add a venue" page (#254;
 * `?submission=<id>` review-queue pre-fill added #259).
 *
 * Same auth chain as /admin (src/app/admin/page.tsx, AGENTS.md "Admin
 * authentication"): getAdminDb() verifies the caller's Cloudflare Access
 * identity before this page renders anything, failing closed via Next's
 * forbidden() control-flow function on AccessDeniedError.
 *
 * The actual form is a Client Component (AddVenueForm) so it can hold input
 * state and POST to /api/admin/venues — this Server Component's only job is
 * the auth gate, the (#259) optional submission lookup below, and page
 * chrome.
 *
 * #259: when opened from the review queue's "Review & approve" link
 * (/admin/submissions -> SubmissionsReviewView), the URL carries
 * `?submission=<id>`. A valid, still-pending, kind="new_venue" row is
 * fetched and mapped (src/lib/adminVenueForm.ts's
 * mapSubmissionPayloadToFormValues) to AddVenueForm's `initialValues`, with
 * that row's own id threaded through as `submissionId` so the eventual
 * POST /api/admin/venues can approve it atomically with the venue insert.
 * Every failure mode here — param absent, non-numeric, unknown id, wrong
 * kind, already-reviewed, or malformed stored JSON — degrades to exactly
 * the same plain, unfilled form this page rendered before #259 (never a 404
 * or a 500): a stale or mistyped link should never block adding a venue by
 * hand.
 *
 * `searchParams` is a Promise in this Next.js version (must be awaited, same
 * convention as `params` elsewhere in this app, e.g.
 * src/app/admin/venues/[id]/edit/page.tsx). Declared OPTIONAL in this file's
 * own prop type — real Next.js rendering always supplies it — purely so
 * this page's pre-#259 test calls (`NewVenuePage()`, no args) keep working
 * unchanged; see page.test.tsx.
 */

import { headers } from "next/headers";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import AddVenueForm, { type AddVenueFormValues } from "@/components/AddVenueForm";
import { mapSubmissionPayloadToFormValues } from "@/lib/adminVenueForm";
import type { NewVenuePayload, PublicSubmissionRow } from "@/lib/publicSubmissions";

interface NewVenuePrefill {
  submissionId: number;
  initialValues: Partial<AddVenueFormValues>;
}

/**
 * Resolves `?submission=<id>` to a pre-fill, or null on ANY failure mode
 * (absent/non-integer param, no matching row, wrong kind, already reviewed,
 * malformed stored JSON). Kept as its own function so every one of those
 * branches funnels through a single `return null` rather than the page body
 * itself growing a tangle of early returns.
 */
async function resolveSubmissionPrefill(
  db: D1Database,
  rawSubmissionParam: string | undefined,
): Promise<NewVenuePrefill | null> {
  if (!rawSubmissionParam) return null;

  const submissionId = Number(rawSubmissionParam);
  if (!Number.isInteger(submissionId) || submissionId <= 0) return null;

  const row = await db
    .prepare("SELECT * FROM public_submissions WHERE id = ? AND kind = 'new_venue' AND status = 'pending'")
    .bind(submissionId)
    .first<PublicSubmissionRow>();
  if (!row) return null;

  try {
    const payload = JSON.parse(row.payload) as NewVenuePayload;
    return { submissionId, initialValues: mapSubmissionPayloadToFormValues(payload) };
  } catch {
    return null; // malformed stored JSON — degrade to the plain form, don't crash the page
  }
}

export default async function NewVenuePage({
  searchParams,
}: {
  searchParams?: Promise<{ submission?: string }>;
} = {}) {
  let email: string;
  let prefill: NewVenuePrefill | null = null;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    const { submission } = searchParams ? await searchParams : {};
    prefill = await resolveSubmissionPrefill(db, submission);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Add a venue</h1>
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
        {prefill ? (
          <AddVenueForm initialValues={prefill.initialValues} submissionId={prefill.submissionId} />
        ) : (
          <AddVenueForm />
        )}
      </div>
    </main>
  );
}
