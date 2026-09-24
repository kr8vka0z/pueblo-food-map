/**
 * /admin — the Dashboard (admin dashboard build, approved mockup Direction
 * A "to-do list first"). Replaces the old /admin (venue list + Publish
 * panel, now at /admin/places — see that page's own header for the move).
 * This is now the admin's landing page: what needs a decision right now,
 * plus two "worth a glance" side panels, rather than a data table.
 *
 * Same Better Auth chain as every other admin page (AGENTS.md "Admin
 * authentication"): getAdminDb() verifies identity before this page renders
 * anything, failing closed via handlePageAuthError.
 *
 * Every read below is either a) a query ALSO used by an existing full-queue
 * page (venues, for the Publish bar + stale-places panel — same rows
 * src/app/admin/places/page.tsx already loads; box health, via
 * src/lib/adminBoxes.ts, shared with the future /admin/boxes tab), or b) a
 * small `LIMIT 3` preview of a query an existing full-queue page already
 * runs unfiltered (submissions, proposals) — never a new mutation path, per
 * the task spec's "reuse the same API routes" instruction, which this page
 * satisfies simply by not writing any of its own.
 *
 * Independent reads run via Promise.all (quality bar: "Promise.all for
 * independent queries"). `photos`/`adopters` reuse their FULL pending
 * arrays (loadReviewQueue/loadPendingAdopters, the exact same loaders
 * /admin/box-photos and /admin/box-adopters already call) rather than a
 * separate LIMIT+COUNT pair — this page already needs the full list to
 * hand NeedsDecisionPanel a real total, so slicing the first 3 off an
 * already-fetched array is cheaper than issuing a second COUNT query for
 * the same thing loadAdminNavCounts()'s countPendingReview/
 * countPendingAdopters would otherwise duplicate. AdminNav's own counts are
 * therefore built BY HAND from these same numbers below rather than via a
 * second loadAdminNavCounts() call (every other admin page calls that
 * helper directly since it has no richer version of the same counts
 * already in hand; this page does).
 *
 * `venues`/`public_submissions`/`change_proposals` reads are allowed to
 * throw on failure (same "core admin data" convention every other admin
 * page's own main query follows); the two blessing-boxes-adjacent reads
 * (box photos/adopters queue, box health) degrade to empty/unknown on
 * failure instead — "one missing table must never break the whole
 * Dashboard," same posture src/lib/adminNavCounts.ts already established
 * for these exact two tables.
 */

import { headers } from "next/headers";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { summarizePublishChanges } from "@/lib/adminVenues";
import { selectStalePlaces } from "@/lib/adminDashboard";
import { loadBoxHealthEntries } from "@/lib/adminBoxes";
import { rankNeedsHelp } from "@/lib/boxHealth";
import { parseProposalRow, type ChangeProposalRow, type ParsedProposal } from "@/lib/adminProposals";
import { loadVenueLookup, type VenueLookup } from "@/lib/adminVenueLookup";
import { loadReviewQueue, type AdminBoxPhotoRow } from "@/lib/boxPhotos";
import { loadPendingAdopters, type AdminBoxAdopterRow } from "@/lib/boxAdopters";
import { fetchPublishBotPrStatus, type PublishBotPrStatus } from "@/lib/publishVenues";
import type { AdminNavCounts } from "@/lib/adminNavCounts";
import type { AdminVenueRow } from "@/types/venue";
import type { ClosurePayload, NewVenuePayload, PublicSubmissionRow } from "@/lib/publicSubmissions";
import AdminNav from "@/components/AdminNav";
import PublishPanel from "@/components/PublishPanel";
import PublishBotStatusBanner from "@/components/PublishBotStatusBanner";
import NeedsDecisionPanel from "@/components/NeedsDecisionPanel";
import BoxHealthList from "@/components/BoxHealthList";
import StalePlacesList from "@/components/StalePlacesList";
import type { ReviewSubmission } from "@/components/SubmissionsReviewView";

/** How many rows the Dashboard shows per "Needs a decision" group before "+N more →" — task spec's own suggested cap. */
const DECISION_PREVIEW_LIMIT = 3;
/** How many rows the two right-column panels show before their own "see all" link. */
const SIDE_PANEL_LIMIT = 4;

/**
 * Identical to submissions/page.tsx's own parseSubmissionRow — kept as a
 * separate local copy rather than a shared import, matching this app's
 * established convention of a small, page-local parser per admin page (that
 * page's own version is not exported). Degrades one malformed row to
 * `parseError: true` rather than throwing, same defensive shape used
 * everywhere this JSON column is read.
 */
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

export default async function DashboardPage() {
  let email: string;
  let venues: AdminVenueRow[];
  let submissionRows: PublicSubmissionRow[];
  let submissionsTotal: number;
  let proposals: ParsedProposal[];
  let proposalsTotal: number;
  let proposalVenueLookup: Record<string, VenueLookup>;
  let photos: AdminBoxPhotoRow[];
  let adopters: AdminBoxAdopterRow[];
  let boxHealthEntries: Awaited<ReturnType<typeof loadBoxHealthEntries>>;
  let publishBotStatus: PublishBotPrStatus | null;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;

    // #598: reads the SAME open publish-bot PR commitPublishedVenues()
    // (publishVenues.ts) opens — deliberately gated behind getAdminDb()
    // resolving first (this whole call sits inside the try below, after the
    // auth line above), so an unauthenticated hit can never trigger a
    // GitHub call. `GITHUB_PUBLISH_TOKEN` is absent on staging (this file's
    // own header/AGENTS.md) — skipped entirely rather than fetched with an
    // empty token, and `.catch(() => null)` matches every other best-effort
    // Dashboard read above (one GitHub hiccup must never break the page).
    const publishToken = process.env.GITHUB_PUBLISH_TOKEN;

    const [
      venuesResult,
      submissionsPreviewResult,
      submissionsTotalRow,
      proposalsPreviewResult,
      proposalsTotalRow,
      photosAll,
      adoptersAll,
      boxHealth,
      publishBotStatusResult,
    ] = await Promise.all([
      db.prepare("SELECT * FROM venues ORDER BY name COLLATE NOCASE ASC").all<AdminVenueRow>(),
      db
        .prepare("SELECT * FROM public_submissions WHERE status = 'pending' ORDER BY created_at DESC LIMIT ?")
        .bind(DECISION_PREVIEW_LIMIT)
        .all<PublicSubmissionRow>(),
      db.prepare("SELECT COUNT(*) AS n FROM public_submissions WHERE status = 'pending'").first<{ n: number }>(),
      db
        .prepare("SELECT * FROM change_proposals WHERE status = 'pending' ORDER BY created_at DESC LIMIT ?")
        .bind(DECISION_PREVIEW_LIMIT)
        .all<ChangeProposalRow>(),
      db.prepare("SELECT COUNT(*) AS n FROM change_proposals WHERE status = 'pending'").first<{ n: number }>(),
      loadReviewQueue(db).catch(() => [] as AdminBoxPhotoRow[]),
      loadPendingAdopters(db).catch(() => [] as AdminBoxAdopterRow[]),
      loadBoxHealthEntries(db).catch(() => [] as Awaited<ReturnType<typeof loadBoxHealthEntries>>),
      publishToken ? fetchPublishBotPrStatus(publishToken).catch(() => null) : Promise.resolve(null),
    ]);

    venues = venuesResult.results;
    submissionRows = submissionsPreviewResult.results;
    submissionsTotal = submissionsTotalRow?.n ?? 0;
    proposals = proposalsPreviewResult.results.map(parseProposalRow);
    proposalsTotal = proposalsTotalRow?.n ?? 0;
    proposalVenueLookup = await loadVenueLookup(
      db,
      proposals.map((p) => p.row.target_venue_id),
    );
    photos = photosAll;
    adopters = adoptersAll;
    boxHealthEntries = boxHealth;
    publishBotStatus = publishBotStatusResult;
  } catch (err) {
    handlePageAuthError(err);
  }

  const navCounts: AdminNavCounts = {
    submissions: submissionsTotal,
    proposals: proposalsTotal,
    photos: photos.length,
    adopters: adopters.length,
  };

  const publishSummary = summarizePublishChanges(venues);
  const showPublishBar = publishSummary.newDrafts > 0 || publishSummary.editedSincePublish > 0 || publishSummary.archived > 0;

  const stalePlaces = selectStalePlaces(venues, new Date(), { limit: SIDE_PANEL_LIMIT });
  const needsHelpBoxes = rankNeedsHelp(boxHealthEntries, SIDE_PANEL_LIMIT);

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="dashboard" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        {/* #598: independent of showPublishBar — after a publish, D1 is
            already promoted (the Publish bar's own summary drops to zero),
            exactly when this banner needs to show instead. */}
        {publishBotStatus && (
          <PublishBotStatusBanner
            prNumber={publishBotStatus.number}
            prUrl={publishBotStatus.htmlUrl}
            state={publishBotStatus.state}
          />
        )}
        {showPublishBar && <PublishPanel summary={publishSummary} reviewHref="/admin/places" />}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <NeedsDecisionPanel
              submissions={submissionRows.map(parseSubmissionRow)}
              submissionsTotal={submissionsTotal}
              proposals={proposals}
              proposalsTotal={proposalsTotal}
              venueLookup={proposalVenueLookup}
              photos={photos.slice(0, DECISION_PREVIEW_LIMIT)}
              photosTotal={photos.length}
              adopters={adopters.slice(0, DECISION_PREVIEW_LIMIT)}
              adoptersTotal={adopters.length}
            />
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:flex-none">
            <section className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
              <h2 className="wordmark text-base text-[var(--color-ink-900)]">Boxes that need help</h2>
              <div className="mt-2">
                <BoxHealthList entries={needsHelpBoxes} variant="needs-help" emptyMessage="Every box is doing fine." />
              </div>
              <Link
                href="/admin/boxes"
                className="mt-3 inline-block text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
              >
                All boxes →
              </Link>
            </section>

            <section className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
              <h2 className="wordmark text-base text-[var(--color-ink-900)]">Places due for a check</h2>
              <div className="mt-2">
                <StalePlacesList items={stalePlaces.items} totalCount={stalePlaces.totalCount} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
