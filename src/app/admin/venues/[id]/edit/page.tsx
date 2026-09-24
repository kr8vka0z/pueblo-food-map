/**
 * /admin/venues/[id]/edit — admin-gated "Edit a venue" page,
 * plus the "Remove from map" (archive) action (#255); `?submission=<id>`
 * closure-report review context added #270; `?proposal=<id>` link_health
 * review context added #390.
 *
 * Same auth chain as /admin and /admin/venues/new (AGENTS.md "Admin
 * authentication"): getAdminDb() verifies the caller's Better Auth session
 * before this page renders anything, failing closed on AccessDeniedError
 * (handlePageAuthError: login redirect or Next's forbidden()). Unlike the create
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
 *
 * #390: `?proposal=<id>` is the /admin/flags queue's link_health hand-off —
 * that queue's card intentionally has no Approve button for a link_health
 * proposal (a dead-URL observation isn't safe to blindly apply; see
 * src/components/ProposalsReviewView.tsx's own header), only a "Review &
 * fix link" navigation link here. resolveLinkHealthProposalContext() below
 * mirrors resolveClosureReportContext() exactly — same match-against-THIS-
 * venue check, same "any failure degrades to the plain page" shape — and
 * when accepted threads the proposal id through as AddVenueForm's new
 * `proposalId` prop (that component's header explains the PATCH-time
 * approval), plus renders the dead URL + last-seen HTTP status in a banner
 * so the admin has context before editing.
 *
 * #265: passes `venue.updated_at` straight through to AddVenueForm's
 * `expectedUpdatedAt` prop — the optimistic-concurrency precondition PATCH
 * /api/admin/venues/[id] checks on save (see that route's + AddVenueForm's
 * own headers). This SELECT above is the ONLY place that value is read, so
 * it's always exactly what PATCH itself will re-check against.
 *
 * Blessing Boxes slice 2: when `venue.category === 'blessing_box'`,
 * resolveBoxCheckins() loads every check-in for this box (visible, hidden,
 * and 'problem' reports alike — see loadAllCheckinsForBox's own header) and
 * renders BoxCheckinsAdminPanel below the form, so hide/unhide and
 * 'problem' report review live on the same screen as the rest of a box's
 * admin data. Wrapped in the same try/catch-degrades-to-empty shape as
 * resolveClosureReportContext()/resolveLinkHealthProposalContext() above —
 * a D1 read failure here must never take down the whole edit page.
 */

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import AdminNav from "@/components/AdminNav";
import AddVenueForm from "@/components/AddVenueForm";
import ArchiveVenueButton from "@/components/ArchiveVenueButton";
import BoxCheckinsAdminPanel from "@/components/BoxCheckinsAdminPanel";
import HostAlertsAdminPanel from "@/components/HostAlertsAdminPanel";
import { mapVenueRowToFormValues } from "@/lib/adminVenueForm";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import { parseProposalRow, type ChangeProposalRow } from "@/lib/adminProposals";
import { loadAllCheckinsForBox, type AdminCheckinRow } from "@/lib/blessingBoxes";
import { loadHostSubscriptions } from "@/lib/boxAlerts";
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

interface LinkHealthProposalContext {
  proposalId: number;
  /** null when the stored diff failed to parse, or carried no url/http_status — the banner falls back to generic copy, same parseError-tolerant shape as ClosureReportContext.detail above. */
  deadUrl: string | null;
  httpStatus: number | null;
}

/**
 * Resolves `?proposal=<id>` to a link_health review context, or null on ANY
 * failure mode — same shape as resolveClosureReportContext() above: param
 * absent/non-integer, no matching pending link_health row, a
 * `target_venue_id` that doesn't match THIS venue, or a D1 read failure
 * (wrapped so it degrades to the plain edit page rather than 500ing it).
 */
async function resolveLinkHealthProposalContext(
  db: D1Database,
  venueId: string,
  rawProposalParam: string | undefined,
): Promise<LinkHealthProposalContext | null> {
  if (!rawProposalParam) return null;

  const proposalId = Number(rawProposalParam);
  if (!Number.isInteger(proposalId) || proposalId <= 0) return null;

  try {
    const row = await db
      .prepare("SELECT * FROM change_proposals WHERE id = ? AND source = 'link_health' AND status = 'pending'")
      .bind(proposalId)
      .first<ChangeProposalRow>();
    if (!row || row.target_venue_id !== venueId) return null;

    const parsed = parseProposalRow(row);
    if (parsed.parseError) return { proposalId, deadUrl: null, httpStatus: null };

    const httpStatus = typeof parsed.diff.meta?.http_status === "number" ? parsed.diff.meta.http_status : null;
    const deadUrl = typeof parsed.diff.before?.url === "string" ? parsed.diff.before.url : null;
    return { proposalId, deadUrl, httpStatus };
  } catch {
    return null; // a D1 failure here must never crash the edit page itself
  }
}

/**
 * Loads every check-in for this box (all visibilities, all kinds) for
 * BoxCheckinsAdminPanel — see that function's own header in
 * src/lib/blessingBoxes.ts. Only called for a blessing_box venue; degrades
 * to [] on any D1 failure so this optional admin panel can never take down
 * the rest of the edit page.
 */
async function resolveBoxCheckins(db: D1Database, venueId: string): Promise<AdminCheckinRow[]> {
  try {
    return await loadAllCheckinsForBox(db, venueId);
  } catch {
    return [];
  }
}

/** Same degrade-to-empty shape as resolveBoxCheckins() above — a missing alert_subscriptions table (migration 0010 not yet applied) must never take down the edit page. */
async function resolveHostAlerts(db: D1Database, venueId: string): Promise<{ id: number; email: string }[]> {
  try {
    return await loadHostSubscriptions(db, venueId);
  } catch {
    return [];
  }
}

export default async function EditVenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submission?: string; proposal?: string }>;
}) {
  const { id } = await params;
  let email: string;
  let venue: AdminVenueRow | null;
  let closureContext: ClosureReportContext | null = null;
  let linkHealthContext: LinkHealthProposalContext | null = null;
  let boxCheckins: AdminCheckinRow[] = [];
  let hostAlerts: { id: number; email: string }[] = [];
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    venue = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(id).first<AdminVenueRow>();
    if (venue) {
      const { submission, proposal } = await searchParams;
      closureContext = await resolveClosureReportContext(db, id, submission);
      linkHealthContext = await resolveLinkHealthProposalContext(db, id, proposal);
      if (venue.category === "blessing_box") {
        boxCheckins = await resolveBoxCheckins(db, id);
        hostAlerts = await resolveHostAlerts(db, id);
      }
    }
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  if (!venue) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="places" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6 space-y-6">
        <h2 className="wordmark text-xl text-[var(--color-ink-900)]">Edit {venue.name}</h2>
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
        {linkHealthContext && (
          <div className="max-w-2xl rounded-[var(--radius-lg)] bg-[var(--color-clay-100)] px-4 py-3 text-sm text-[var(--color-clay-700)]">
            <p className="font-semibold">Reviewing a dead link</p>
            <p className="mt-1">
              {linkHealthContext.deadUrl
                ? `The automated refresh couldn't reach ${linkHealthContext.deadUrl}${
                    linkHealthContext.httpStatus ? ` (HTTP ${linkHealthContext.httpStatus})` : ""
                  }.`
                : "The automated refresh flagged this venue's link as unreachable."}{" "}
              Update or remove the URL below, then save.
            </p>
            <Link href="/admin/flags" className="mt-2 inline-block font-medium underline underline-offset-2">
              Back to data refresh queue
            </Link>
          </div>
        )}
        <AddVenueForm
          venueId={venue.id}
          initialValues={mapVenueRowToFormValues(venue)}
          proposalId={linkHealthContext?.proposalId}
          expectedUpdatedAt={venue.updated_at}
        />

        {venue.category === "blessing_box" && (
          <div className="max-w-2xl border-t border-[var(--color-bone-200)] pt-5">
            <h2 className="text-sm font-semibold text-[var(--color-ink-700)] mb-2">Check-ins</h2>
            <BoxCheckinsAdminPanel checkins={boxCheckins} />
          </div>
        )}

        {venue.category === "blessing_box" && (
          <div className="max-w-2xl border-t border-[var(--color-bone-200)] pt-5">
            <h2 className="text-sm font-semibold text-[var(--color-ink-700)] mb-2">Host alert emails</h2>
            <HostAlertsAdminPanel venueId={venue.id} initialHosts={hostAlerts} />
          </div>
        )}

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
