/**
 * /admin/places — the venue list + Publish panel (#237 checkpoint c; venue
 * list added #253; "Add place" link added #254; Publish panel added #256;
 * "Review queue" nav link added as a #259 follow-up; single per-venue
 * status computed here + staging banner added #673).
 *
 * MOVED HERE from /admin (admin dashboard build): /admin is now the
 * Dashboard (src/app/admin/page.tsx), a to-do-list landing page — this is
 * the exact same list + Publish panel that page used to render, unchanged
 * in behavior, just at its own URL so the Dashboard can be a genuinely
 * different screen rather than this one with extra panels bolted on.
 * Anything that used to redirect/link to "/admin" meaning THIS list (save,
 * archive, publish, "Back to venue list") now points at /admin/places
 * instead — grepped and updated across the app in the same change (see
 * AddVenueForm.tsx, ArchiveVenueButton.tsx, and every other admin page's
 * header).
 *
 * Proves the full auth chain end-to-end: Better Auth session
 * (getAdminDb, src/lib/adminDb.ts) → a real D1 binding handed back only on
 * success — then renders AdminNav (the shared header/nav every admin page
 * now shares) above the Publish panel (PublishPanel, below) and a
 * read-only table of every venues row (draft + published + archived).
 * This page itself still performs no mutation and issues no non-GET
 * request, so it has no requireAdminOrigin() CSRF check here — that guard
 * exists only for non-GET /api/admin/* mutations (src/lib/adminOrigin.ts).
 *
 * summarizePublishChanges() (src/lib/adminVenues.ts) computes PublishPanel's
 * new/edited/archived counts from the SAME rows already SELECTed for
 * VenueListView below — no second query. loadAdminNavCounts()
 * (src/lib/adminNavCounts.ts) is the one extra read AdminNav needs for its
 * pending-count pills — every admin page now makes this same call.
 *
 * #673: displayStatusOf() needs `src/data/published-venues.ts` (what the
 * public map is ACTUALLY serving) to tell "Live" apart from "Live · edits
 * waiting," and needs to know whether this is staging (edits waiting is
 * always a false alarm there, since staging can never Publish —
 * isProductionWorker(), publishVenues.ts). Both are computed HERE, once per
 * page load, into a plain `Record<id, AdminDisplayStatus>` — VenueListView
 * is a "use client" component and must never import the ~2000-entry
 * published-venues.ts snapshot itself (see that component's own header).
 * On staging, the Publish panel and status key's "edits waiting" state
 * would only ever mislead (staging's D1 test data has no bearing on what
 * production will show), so a "Test site" banner replaces the panel
 * outright rather than showing a panel that can never do anything.
 *
 * #674 ("fold the Data refresh tab into Places"): this page now ALSO loads
 * every pending `change_proposals` row (the same query /admin/flags/page.tsx
 * used to run — that page is now a redirect here) and groups it by
 * `target_venue_id`: a proposal whose target is one of the venues already
 * SELECTed above (an update/remove, or an `add` restoring an archived one)
 * goes into `proposalsByVenueId`; everything else — a genuinely-new `add`
 * with no matching venue row at all — goes into `addProposals`, rendered by
 * VenueListView as its own "Suggested new place" row. `?show=review`
 * pre-selects the "To review" chip (passed down as a plain boolean prop,
 * never parsed client-side — see VenueListView's own header).
 *
 * #675 ("fold the Review queue into Places"): this page ALSO loads every
 * pending `public_submissions` row (the same query the now-retired
 * /admin/submissions/page.tsx used to run) and groups it the SAME way as
 * proposals above, into the SAME `ReviewItem[]` shape VenueListView and
 * SuggestionsBox both already dispatch on: a "closure" row's
 * target_venue_id always matches a `venues` row (venues are archived, never
 * deleted — see migrations/0002_public_submissions.sql's own comment on why
 * that column isn't a FOREIGN KEY), including an archived one, so a report
 * against a place that's since been removed shows on that place's own
 * "Removed" row rather than being silently dropped. A "new_venue" row has
 * no target_venue_id at all and becomes its own "Suggested new place" row,
 * same shape as a genuinely-new `add` proposal. `?from=public` mirrors
 * `?show=review`'s own pre-select convention, pointed at the source filter
 * this time (VenueListView's own header covers why it's a plain prop, never
 * parsed client-side).
 *

 * On AccessDeniedError this delegates to handlePageAuthError()
 * (src/lib/adminAuthErrors.ts): a missing Better Auth session redirects to
 * /admin/login; every other denial reason calls Next's forbidden()
 * control-flow function, which renders src/app/forbidden.tsx and returns a
 * real HTTP 403 — not a 200 with an inline error message.
 *
 * Not unit-tested directly — RSC page tests (real D1 binding + headers()+
 * forbidden()) are hard in this stack; coverage concentrates on
 * VenueListView and src/lib/adminVenues.ts, both of which this page is a
 * thin, mostly-untested wrapper around (see their own test files). The
 * auth-guard contract itself IS pinned here (page.test.tsx, moved from
 * /admin unchanged).
 */

import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { summarizePublishChanges, displayStatusOf, type AdminDisplayStatus } from "@/lib/adminVenues";
import { isProductionWorker } from "@/lib/publishVenues";
import { publishedVenues } from "@/data/published-venues";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import { parseProposalRow, type ChangeProposalRow, type ParsedProposal } from "@/lib/adminProposals";
import { parseSubmissionRow, type PublicSubmissionRow, type ReviewItem, type ReviewSubmission } from "@/lib/publicSubmissions";
import VenueListView from "@/components/VenueListView";
import ToReviewSummaryBox from "@/components/ToReviewSummaryBox";
import PublishPanel from "@/components/PublishPanel";
import AdminNav from "@/components/AdminNav";
import type { AdminVenueRow } from "@/types/venue";

/**
 * Groups every pending review item (a `change_proposals` row OR a
 * `public_submissions` row, both already normalized to `ReviewItem`) by
 * whether its target already exists among `venues` (any status — an
 * archived match is either a restore proposal or a report against a
 * since-removed place, both still attached to that row) or not (a
 * genuinely-new `add` proposal, or a "new_venue" submission — neither has an
 * existing row to attach to, so both become their own "Suggested new place"
 * row). See this file's own header for the full #674/#675 reasoning.
 */
function groupItemsByTarget(
  items: ReviewItem[],
  venues: AdminVenueRow[],
): { itemsByVenueId: Record<string, ReviewItem[]>; addItems: ReviewItem[] } {
  const venueIds = new Set(venues.map((v) => v.id));
  const itemsByVenueId: Record<string, ReviewItem[]> = {};
  const addItems: ReviewItem[] = [];
  for (const item of items) {
    const targetId = item.kind === "proposal" ? item.proposal.row.target_venue_id : item.submission.targetVenueId;
    if (targetId && venueIds.has(targetId)) {
      (itemsByVenueId[targetId] ??= []).push(item);
    } else {
      addItems.push(item);
    }
  }
  return { itemsByVenueId, addItems };
}

export default async function PlacesPage({
  searchParams,
}: { searchParams?: Promise<{ show?: string; from?: string }> } = {}) {
  let email: string;
  let showActivity = false;
  let venues: AdminVenueRow[];
  let proposals: ParsedProposal[] = [];
  let submissions: ReviewSubmission[] = [];
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;
    const result = await db
      .prepare("SELECT * FROM venues ORDER BY name COLLATE NOCASE ASC")
      .all<AdminVenueRow>();
    venues = result.results;
    // Same query /admin/flags/page.tsx used to run before #674 folded that
    // queue into this page.
    const proposalsResult = await db
      .prepare("SELECT * FROM change_proposals WHERE status = 'pending' ORDER BY created_at DESC")
      .all<ChangeProposalRow>();
    proposals = proposalsResult.results.map(parseProposalRow);
    // #675: same query the now-retired /admin/submissions/page.tsx used to
    // run before that queue folded into this page.
    const submissionsResult = await db
      .prepare("SELECT * FROM public_submissions WHERE status = 'pending' ORDER BY created_at DESC")
      .all<PublicSubmissionRow>();
    submissions = submissionsResult.results.map(parseSubmissionRow);
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  const { env } = await getCloudflareContext({ async: true });
  const isStaging = !isProductionWorker(env);

  const publishedById = new Map(publishedVenues.map((v) => [v.id, v]));
  const statusByVenueId: Record<string, AdminDisplayStatus> = {};
  for (const venue of venues) {
    statusByVenueId[venue.id] = displayStatusOf(venue, publishedById.get(venue.id), { isStaging });
  }

  const items: ReviewItem[] = [
    ...proposals.map((proposal): ReviewItem => ({ kind: "proposal", proposal })),
    ...submissions.map((submission): ReviewItem => ({ kind: "submission", submission })),
  ];
  const { itemsByVenueId, addItems } = groupItemsByTarget(items, venues);
  const reviewRowCount = Object.values(itemsByVenueId).filter((i) => i.length > 0).length + addItems.length;
  const { show, from } = searchParams ? await searchParams : {};

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="places" counts={navCounts} showActivity={showActivity} />
      <div className="px-4 py-6 sm:px-6">
        <ToReviewSummaryBox reviewRowCount={reviewRowCount} proposals={proposals} submissionCount={submissions.length} />
        {isStaging ? (
          // #673 pt.6: staging can never Publish (isProductionWorker() is
          // false there) — a Publish panel that always no-ops, next to
          // status badges that could never legitimately read "edits
          // waiting," would only teach an admin to distrust this screen.
          <p className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-clay-500)] bg-[var(--color-clay-100)] px-4 py-3 text-sm text-[var(--color-clay-700)]">
            Test site: publishing is turned off here.
          </p>
        ) : (
          <PublishPanel summary={summarizePublishChanges(venues)} />
        )}
        <VenueListView
          venues={venues}
          statusByVenueId={statusByVenueId}
          itemsByVenueId={itemsByVenueId}
          addItems={addItems}
          initialShowReview={show === "review"}
          initialSourceFilter={from === "public" ? "public" : undefined}
        />
      </div>
    </main>
  );
}
