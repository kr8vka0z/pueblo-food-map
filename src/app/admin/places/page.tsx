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
import VenueListView from "@/components/VenueListView";
import ToReviewSummaryBox from "@/components/ToReviewSummaryBox";
import PublishPanel from "@/components/PublishPanel";
import AdminNav from "@/components/AdminNav";
import type { AdminVenueRow } from "@/types/venue";

/**
 * Groups every pending proposal by whether its target already exists among
 * `venues` (any status — an archived match is a restore, still attached to
 * that row) or not (a genuinely-new `add`, its own "Suggested new place"
 * row). See this file's own header for the full reasoning.
 */
function groupProposalsByTarget(
  proposals: ParsedProposal[],
  venues: AdminVenueRow[],
): { proposalsByVenueId: Record<string, ParsedProposal[]>; addProposals: ParsedProposal[] } {
  const venueIds = new Set(venues.map((v) => v.id));
  const proposalsByVenueId: Record<string, ParsedProposal[]> = {};
  const addProposals: ParsedProposal[] = [];
  for (const proposal of proposals) {
    const targetId = proposal.row.target_venue_id;
    if (venueIds.has(targetId)) {
      (proposalsByVenueId[targetId] ??= []).push(proposal);
    } else {
      addProposals.push(proposal);
    }
  }
  return { proposalsByVenueId, addProposals };
}

export default async function PlacesPage({ searchParams }: { searchParams?: Promise<{ show?: string }> } = {}) {
  let email: string;
  let venues: AdminVenueRow[];
  let proposals: ParsedProposal[] = [];
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
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

  const { proposalsByVenueId, addProposals } = groupProposalsByTarget(proposals, venues);
  const reviewRowCount =
    Object.values(proposalsByVenueId).filter((p) => p.length > 0).length + addProposals.length;
  const { show } = searchParams ? await searchParams : {};

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="places" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        <ToReviewSummaryBox reviewRowCount={reviewRowCount} proposals={proposals} />
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
          proposalsByVenueId={proposalsByVenueId}
          addProposals={addProposals}
          initialShowReview={show === "review"}
        />
      </div>
    </main>
  );
}
