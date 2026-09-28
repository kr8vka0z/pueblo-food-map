/**
 * /admin/venues/new — Better-Auth-gated "Add a venue" page (#254;
 * `?submission=<id>` review-queue pre-fill added #259; `?proposal=<id>`
 * fold-in added #674).
 *
 * Same auth chain as /admin/places (src/app/(site)/admin/places/page.tsx, AGENTS.md
 * "Admin authentication"): getAdminDb() verifies the caller's Better Auth
 * session before this page renders anything, failing closed via Next's
 * forbidden() control-flow function on AccessDeniedError. Header swapped
 * for the shared AdminNav (admin dashboard build) — see that component's
 * own header for why.
 *
 * The actual form is a Client Component (AddVenueForm) so it can hold input
 * state and POST to /api/admin/venues — this Server Component's only job is
 * the auth gate, the (#259) optional submission lookup below, and page
 * chrome.
 *
 * #259: when opened from a "new_venue" submission card's "Review & approve"
 * link (#675: that card now lives in the Places tab's "Suggested new place"
 * row / SuggestionsBox, not a standalone /admin/submissions queue —
 * SubmissionCard.tsx), the URL carries `?submission=<id>`. A valid,
 * still-pending, kind="new_venue" row is
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
 * src/app/(site)/admin/venues/[id]/edit/page.tsx). Declared OPTIONAL in this file's
 * own prop type — real Next.js rendering always supplies it — purely so
 * this page's pre-#259 test calls (`NewVenuePage()`, no args) keep working
 * unchanged; see page.test.tsx.
 *
 * #674: `?proposal=<id>` is the Places tab's "Suggested new place" row hand-
 * off — a genuinely-new, pending `change_proposals` "add" row (never a
 * restore: an `add` targeting an already-archived venue attaches to THAT
 * venue's own edit-page card instead, see ProposalCard.tsx's own header).
 * resolveProposalPrefill() below mirrors resolveSubmissionPrefill()'s own
 * "any failure degrades to the plain form, never a 404/500" shape, mapped
 * via src/lib/adminVenueForm.ts's mapAddProposalToFormValues(). The parsed
 * proposal itself (not just its mapped form values) also renders as a
 * read-only ProposalCard above the form — same source/lane/triage context
 * and Reject action the edit page's SuggestionsBox offers, so an admin can
 * reject a bad suggestion without touching the form at all. That card's own
 * "add, not a restore" branch never shows an Approve button (see its own
 * header) — POST /api/admin/venues's `proposalId` field (this page threads
 * the id through as AddVenueForm's `proposalId` prop) IS the approval path
 * here: saving the form approves the proposal and creates the venue in one
 * atomic batch.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import AdminNav from "@/components/AdminNav";
import AddVenueForm, { type AddVenueFormValues } from "@/components/AddVenueForm";
import ProposalCard from "@/components/ProposalCard";
import { mapSubmissionPayloadToFormValues, mapAddProposalToFormValues } from "@/lib/adminVenueForm";
import { parseProposalRow, type ChangeProposalRow, type ParsedProposal } from "@/lib/adminProposals";
import type { NewVenuePayload, PublicSubmissionRow } from "@/lib/publicSubmissions";

interface NewVenuePrefill {
  submissionId: number;
  initialValues: Partial<AddVenueFormValues>;
}

interface NewVenueProposalPrefill {
  proposalId: number;
  initialValues: Partial<AddVenueFormValues>;
  proposal: ParsedProposal;
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

/**
 * Resolves `?proposal=<id>` to a pre-fill, or null on ANY failure mode —
 * same shape as resolveSubmissionPrefill above: absent/non-integer param, no
 * matching pending `add` row, a parseError on the stored diff, or an empty
 * `diff.after` (nothing to prefill from). Deliberately does NOT check
 * whether `target_venue_id` already exists in `venues` — that's POST
 * /api/admin/venues's own resolveAddProposalTarget check at SAVE time (the
 * authoritative one); this page's job is only to render a sensible prefill,
 * and a race between page load and save is exactly what that route's 409
 * already handles.
 */
async function resolveProposalPrefill(
  db: D1Database,
  rawProposalParam: string | undefined,
): Promise<NewVenueProposalPrefill | null> {
  if (!rawProposalParam) return null;

  const proposalId = Number(rawProposalParam);
  if (!Number.isInteger(proposalId) || proposalId <= 0) return null;

  const row = await db
    .prepare("SELECT * FROM change_proposals WHERE id = ? AND change_type = 'add' AND status = 'pending'")
    .bind(proposalId)
    .first<ChangeProposalRow>();
  if (!row) return null;

  const parsed = parseProposalRow(row);
  if (parsed.parseError || !parsed.diff.after) return null;

  return { proposalId, initialValues: mapAddProposalToFormValues(parsed.diff.after), proposal: parsed };
}

export default async function NewVenuePage({
  searchParams,
}: {
  searchParams?: Promise<{ submission?: string; proposal?: string }>;
} = {}) {
  let email: string;
  let showActivity = false;
  let prefill: NewVenuePrefill | null = null;
  let proposalPrefill: NewVenueProposalPrefill | null = null;
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;
    const { submission, proposal } = searchParams ? await searchParams : {};
    prefill = await resolveSubmissionPrefill(db, submission);
    proposalPrefill = await resolveProposalPrefill(db, proposal);
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="places" counts={navCounts} showActivity={showActivity} />
      <div className="px-4 py-6 sm:px-6 space-y-6">
        <h2 className="wordmark text-xl text-[var(--color-ink-900)]">Add a venue</h2>
        {proposalPrefill && (
          <div className="max-w-2xl">
            <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink-700)]">Suggested new place</h3>
            <ProposalCard proposal={proposalPrefill.proposal} />
          </div>
        )}
        {proposalPrefill ? (
          <AddVenueForm initialValues={proposalPrefill.initialValues} proposalId={proposalPrefill.proposalId} />
        ) : prefill ? (
          <AddVenueForm initialValues={prefill.initialValues} submissionId={prefill.submissionId} />
        ) : (
          <AddVenueForm />
        )}
      </div>
    </main>
  );
}
