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
 * #390: `?proposal=<id>` is a link_health hand-off (originally from the now-
 * folded-into-Places /admin/flags queue, #674) — a link_health proposal
 * intentionally has no Approve button on its ProposalCard (a dead-URL
 * observation isn't safe to blindly apply; see ProposalCard.tsx's own
 * header), only a "Review & fix link" navigation link. That card is one of
 * potentially several this page's own SuggestionsBox renders below (#674:
 * every pending proposal targeting this venue, not just a link_health one);
 * resolveLinkHealthProposalContext() below is a SEPARATE, narrower resolver
 * that only powers the banner + AddVenueForm's `proposalId` prop for the
 * ONE proposal `?proposal=` names — mirrors resolveClosureReportContext()
 * exactly — same match-against-THIS-venue check, same "any failure degrades
 * to the plain page" shape — and when accepted threads the proposal id
 * through as AddVenueForm's `proposalId` prop (that component's header
 * explains the PATCH-time approval), plus renders the dead URL + last-seen
 * HTTP status in a banner so the admin has context before editing.
 *
 * #674: SuggestionsBox (rendered below, right under the page title) shows
 * EVERY pending change_proposals row targeting this venue as its own card —
 * see resolvePendingProposals() below and SuggestionsBox.tsx's own header.
 *
 * #675 ("fold the Review queue into Places"): resolvePendingSubmissions()
 * below adds every pending `public_submissions` "closure" row targeting
 * this venue to the SAME box, as its own ReviewItem — a "new_venue"
 * submission never targets an existing venue (target_venue_id is NULL for
 * that kind) so it can never appear here; it keeps its own
 * /admin/venues/new?submission=<id> hand-off unchanged (VenueListView.tsx's
 * "Suggested new place" row). `?submission=<id>` still separately resolves
 * a CLOSURE-REPORT BANNER + ArchiveVenueButton's submissionId (see
 * resolveClosureReportContext below, unchanged) — that is the
 * remove-and-resolve path for a report that says the place is really gone;
 * this box is for reading every OPEN report/proposal on the page, whether
 * or not one of them happens to be the one `?submission=` names.
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
 *
 * #677: for the same `blessing_box` check, resolveBoxReviewItems() loads
 * this box's own pending/flagged photos and pending sponsor requests, shown
 * right under the title in BoxReviewBox.tsx's "Things to review" box — the
 * on-page home for what used to live only on the now-folded-away
 * /admin/box-photos and /admin/box-adopters tabs. See that resolver's own
 * header for why this reuses the tab's existing loaders rather than a new
 * query.
 *
 * #673 pt.3: resolveWaitingToPublishChanges() renders the "Waiting to
 * publish" box (WaitingToPublishBox.tsx) right under the page title for a
 * place displayStatusOf() (src/lib/adminVenues.ts) reads as
 * `live_edits_waiting` — never for a draft, an unedited live place, an
 * archived place, a blessing box, or (on staging) anything at all, since
 * those are exactly the states that function returns for. Field-level
 * diffs come from diffPublishedFields() (compares this D1 row against its
 * src/data/published-venues.ts entry); "who changed it" comes from
 * attributeFieldChange() reading audit_log + change_proposals — see both
 * functions' own headers in adminVenues.ts for the exact rules. Same
 * degrade-to-empty shape as the other resolvers on this page: any D1
 * failure here must never take down the rest of the edit page, so it falls
 * back to naming the venue's own `updated_by` for every field rather than
 * throwing.
 */

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import AdminNav from "@/components/AdminNav";
import AddVenueForm from "@/components/AddVenueForm";
import ArchiveVenueButton from "@/components/ArchiveVenueButton";
import BoxCheckinsAdminPanel from "@/components/BoxCheckinsAdminPanel";
import HostAlertsAdminPanel from "@/components/HostAlertsAdminPanel";
import WaitingToPublishBox, { type WaitingToPublishChange } from "@/components/WaitingToPublishBox";
import SuggestionsBox from "@/components/SuggestionsBox";
import BoxReviewBox from "@/components/BoxReviewBox";
import { mapVenueRowToFormValues } from "@/lib/adminVenueForm";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import { parseProposalRow, type ChangeProposalRow, type ParsedProposal } from "@/lib/adminProposals";
import { parseSubmissionRow, type ReviewItem } from "@/lib/publicSubmissions";
import { loadAllCheckinsForBox, type AdminCheckinRow } from "@/lib/blessingBoxes";
import { loadHostSubscriptions } from "@/lib/boxAlerts";
import { loadReviewQueue, type AdminBoxPhotoRow } from "@/lib/boxPhotos";
import { loadPendingAdopters, type AdminBoxAdopterRow } from "@/lib/boxAdopters";
import { loadVenueLookup, type VenueLookup } from "@/lib/adminVenueLookup";
import {
  displayStatusOf,
  diffPublishedFields,
  attributeFieldChange,
  type VenueAuditEntry,
  type ApprovedProposalMark,
} from "@/lib/adminVenues";
import { isProductionWorker } from "@/lib/publishVenues";
import { publishedVenues } from "@/data/published-venues";
import type { AdminVenueRow } from "@/types/venue";
import type { ClosurePayload, PublicSubmissionRow } from "@/lib/publicSubmissions";

interface ClosureReportContext {
  submissionId: number;
  /** null when the stored payload failed to parse — target_venue_id (the
   *  match this context was accepted on) is a real column independent of
   *  that payload, so the submissionId itself is still good; only the
   *  banner's descriptive text degrades to generic copy. Same
   *  parseError-tolerant reasoning as SubmissionCard's closure
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

/**
 * #677: this box's own pending/flagged photos and pending sponsor requests,
 * for the "Things to review" box (BoxReviewBox.tsx). Reuses the SAME
 * loaders the /admin/boxes tab's summary and column read
 * (loadReviewQueue/loadPendingAdopters), filtered client-side to this one
 * venue — no new SQL, same "ponytail" reasoning as adminBoxes.ts's own
 * D1_MAX_BOUND_PARAMS note: this app's real box/queue volume never
 * approaches the size where "filter the full queue in memory" would cost
 * anything over a dedicated WHERE clause, so a second dedicated query isn't
 * worth adding. Same degrade-to-empty shape as this file's other optional
 * resolvers — a D1 failure here must never take down the rest of the edit
 * page.
 */
async function resolveBoxReviewItems(
  db: D1Database,
  venueId: string,
): Promise<{ photos: AdminBoxPhotoRow[]; adopters: AdminBoxAdopterRow[] }> {
  try {
    const [allPhotos, allAdopters] = await Promise.all([loadReviewQueue(db), loadPendingAdopters(db)]);
    return {
      photos: allPhotos.filter((p) => p.venue_id === venueId),
      adopters: allAdopters.filter((a) => a.venue_id === venueId),
    };
  } catch {
    return { photos: [], adopters: [] };
  }
}

/**
 * #674: every PENDING `change_proposals` row targeting this venue, newest
 * first — the SuggestionsBox at the top of this page. Same degrade-to-empty
 * shape as this file's other optional resolvers (resolveBoxCheckins,
 * resolveHostAlerts above) — a D1 failure here must never take down the
 * rest of the edit page, and a plain [] is exactly what SuggestionsBox
 * already renders nothing for.
 */
async function resolvePendingProposals(db: D1Database, venueId: string): Promise<ParsedProposal[]> {
  try {
    const result = await db
      .prepare("SELECT * FROM change_proposals WHERE target_venue_id = ? AND status = 'pending' ORDER BY created_at DESC")
      .bind(venueId)
      .all<ChangeProposalRow>();
    return result.results.map(parseProposalRow);
  } catch {
    return [];
  }
}

/**
 * #675: every PENDING `public_submissions` "closure" row targeting this
 * venue, newest first — same query shape and degrade-to-empty posture as
 * resolvePendingProposals() above (a D1 failure here must never take down
 * the rest of the edit page). `kind = 'closure'` only: a "new_venue" row's
 * target_venue_id is always NULL (migrations/0002's own schema comment), so
 * it could never match this WHERE clause anyway — the filter is explicit
 * here for readability, not because it changes what rows come back.
 */
async function resolvePendingSubmissions(db: D1Database, venueId: string) {
  try {
    const result = await db
      .prepare(
        "SELECT * FROM public_submissions WHERE target_venue_id = ? AND status = 'pending' AND kind = 'closure' ORDER BY created_at DESC",
      )
      .bind(venueId)
      .all<PublicSubmissionRow>();
    return result.results.map(parseSubmissionRow);
  } catch {
    return [];
  }
}

/**
 * Resolves the "Waiting to publish" box's data for `venue`, or null when it
 * shouldn't render at all — see this file's own header for the full
 * reasoning. Only ever called for a place whose status is already known to
 * be `live_edits_waiting` (the caller checks first), so a null return here
 * means "the diff came back empty" (shouldn't happen, but never worth a
 * crash) rather than "this place doesn't qualify."
 */
async function resolveWaitingToPublishChanges(
  db: D1Database,
  venue: AdminVenueRow,
  viewerEmail: string,
): Promise<WaitingToPublishChange[]> {
  const publishedById = new Map(publishedVenues.map((v) => [v.id, v]));
  const diffs = diffPublishedFields(venue, publishedById.get(venue.id));
  if (diffs.length === 0) return [];

  try {
    const [auditResult, proposalsResult] = await Promise.all([
      db
        .prepare(
          "SELECT actor_email, before_json, after_json, timestamp FROM audit_log " +
            "WHERE entity = 'venue' AND entity_id = ? AND timestamp > ? ORDER BY timestamp DESC",
        )
        .bind(venue.id, venue.published_at ?? "")
        .all<VenueAuditEntry>(),
      // reviewed_by is the approving admin's email (adminProposals.ts's
      // APPROVE_PROPOSAL_SQL) — aliased to actor_email so this reads as the
      // same shape attributeFieldChange() expects.
      db
        .prepare(
          "SELECT reviewed_by AS actor_email, applied_at FROM change_proposals " +
            "WHERE target_venue_id = ? AND status = 'approved' AND applied_at IS NOT NULL",
        )
        .bind(venue.id)
        .all<{ actor_email: string | null; applied_at: string }>(),
    ]);

    const auditEntries = auditResult.results;
    const approvedMarks: ApprovedProposalMark[] = proposalsResult.results.filter(
      (mark): mark is ApprovedProposalMark => mark.actor_email !== null,
    );

    return diffs.map((diff) => ({
      ...diff,
      who: attributeFieldChange(diff.field, auditEntries, approvedMarks, viewerEmail, venue.updated_by),
    }));
  } catch {
    // A D1 read failure here must never crash the edit page — fall back to
    // naming the venue row's own updated_by for every field rather than
    // throwing (same degrade-to-generic shape as this file's other
    // resolvers, just with a non-empty fallback instead of null/[]).
    return diffs.map((diff) => ({ ...diff, who: venue.updated_by }));
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
  let boxReviewPhotos: AdminBoxPhotoRow[] = [];
  let boxReviewAdopters: AdminBoxAdopterRow[] = [];
  let waitingToPublish: WaitingToPublishChange[] = [];
  let pendingProposals: ParsedProposal[] = [];
  let suggestionItems: ReviewItem[] = [];
  let suggestionsVenue: VenueLookup | null = null;
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
        const reviewItems = await resolveBoxReviewItems(db, id);
        boxReviewPhotos = reviewItems.photos;
        boxReviewAdopters = reviewItems.adopters;
      }
      // #674: "Suggestions to review" box — every pending change_proposals
      // row targeting this venue (an archived venue can have one too: a
      // restore, ProposalCard.tsx's own `isRestore` branch). Only bothers
      // loading the venue's VenueLookup context (a second, tiny SELECT)
      // when there's actually something to show it to — the common case
      // (an unedited place) skips this entirely.
      pendingProposals = await resolvePendingProposals(db, id);
      // #675: every pending closure report targeting this venue joins the
      // SAME "Suggestions to review" box as the proposals above — one
      // ReviewItem[] the box dispatches on by `kind`, see SuggestionsBox.tsx.
      const pendingSubmissions = await resolvePendingSubmissions(db, id);
      suggestionItems = [
        ...pendingProposals.map((proposal): ReviewItem => ({ kind: "proposal", proposal })),
        ...pendingSubmissions.map((submission): ReviewItem => ({ kind: "submission", submission })),
      ];
      if (suggestionItems.length > 0) {
        const lookup = await loadVenueLookup(db, [id]);
        suggestionsVenue = lookup[id] ?? null;
      }
      // #673 pt.3: only fetch/compute the diff for a place actually waiting
      // — displayStatusOf() is the single source of truth for that (never a
      // box, a draft, an unedited live place, or — on staging — anything at
      // all), same rule the Places tab's own status badge uses.
      const { env } = await getCloudflareContext({ async: true });
      const isStaging = !isProductionWorker(env);
      const publishedById = new Map(publishedVenues.map((v) => [v.id, v]));
      const status = displayStatusOf(venue, publishedById.get(venue.id), { isStaging });
      if (status === "live_edits_waiting") {
        waitingToPublish = await resolveWaitingToPublishChanges(db, venue, identity.email);
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
        {venue.category === "blessing_box" && (
          <BoxReviewBox photos={boxReviewPhotos} adopters={boxReviewAdopters} />
        )}
        {suggestionItems.length > 0 && suggestionsVenue && (
          <SuggestionsBox items={suggestionItems} venue={suggestionsVenue} />
        )}
        <WaitingToPublishBox changes={waitingToPublish} />
        {closureContext && (
          <div className="max-w-2xl rounded-[var(--radius-lg)] bg-[var(--color-clay-100)] px-4 py-3 text-sm text-[var(--color-clay-700)]">
            <p className="font-semibold">Reviewing a closure report</p>
            <p className="mt-1">
              {closureContext.detail
                ? `${closureContext.detail.issueLabel} — ${closureContext.detail.description}`
                : "A closure report was submitted for this venue."}
            </p>
            <Link href="/admin/places?show=review&from=public" className="mt-2 inline-block font-medium underline underline-offset-2">
              Back to Places
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
            <Link href="/admin/places?show=review" className="mt-2 inline-block font-medium underline underline-offset-2">
              Back to Places
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
