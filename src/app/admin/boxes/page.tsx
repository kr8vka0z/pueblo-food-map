/**
 * /admin/boxes — the Blessing Boxes tab (admin dashboard build, approved
 * mockup Direction B "boxes first"). Everything blessing-boxes-specific
 * that doesn't belong on the Dashboard's general to-do list: an 8-week
 * reports chart and the full box table (status filters, search, Sponsor
 * filter, sort — src/components/AllBoxesTable.tsx). #678 removed the
 * status map + color key that used to sit above the chart (the table's own
 * status filter + "Needs attention first" default sort already carries that
 * "does this need attention" information, and #671 removed this tab's old
 * "Needs help now" / "Gone quiet" lists for the same reason). "Places due
 * for a check" deliberately does NOT appear here (task spec: Dashboard-only
 * — boxes are excluded from that panel's own query in the first place, see
 * src/lib/adminDashboard.ts).
 *
 * Same Better Auth chain as every other admin page (AGENTS.md "Admin
 * authentication"): getAdminDb() verifies identity before this page renders
 * anything, failing closed via handlePageAuthError.
 *
 * Reuses src/lib/adminBoxes.ts's loadBoxHealthEntries() — the SAME loader
 * (and therefore the same box set + status math, via boxHealth.ts's
 * computeBoxHealth) the Dashboard's "Boxes that need help" panel already
 * uses, so the two screens can never disagree about a box's status.
 * loadReviewQueue/loadPendingAdopters' FULL pending arrays (same loaders
 * /admin/box-photos and /admin/box-adopters already call) feed BOTH the
 * "To review" summary box's X/Y/Z counts (their own `.length`s, no extra
 * COUNT query — same reasoning the Dashboard's own navCounts construction
 * gives) AND, via adminBoxes.ts's groupBoxReviewItems(), AllBoxesTable's own
 * "To review" column/chip/sort (#677).
 *
 * `?show=review` (same convention #674 established for /admin/places) pre-
 * selects the table's "To review" chip. AllBoxesTable's `initialShowReview`
 * prop only seeds its OWN internal `useState` on first mount — clicking
 * BoxesToReviewBox's "Show them" link navigates to this SAME route with a
 * new query, and React would otherwise keep the already-mounted
 * AllBoxesTable instance (and its stale filter state) rather than re-run
 * that initializer. The `key` below forces a remount exactly when `show`
 * flips, so "Show them" actually shows them.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadBoxHealthEntries, groupBoxReviewItems } from "@/lib/adminBoxes";
import { bucketCheckinsByWeek } from "@/lib/adminDashboard";
import { loadRecentCheckinsAllBoxes } from "@/lib/blessingBoxes";
import { loadReviewQueue, type AdminBoxPhotoRow } from "@/lib/boxPhotos";
import { loadPendingAdopters, type AdminBoxAdopterRow } from "@/lib/boxAdopters";
import { loadAdminNavCounts, type AdminNavCounts } from "@/lib/adminNavCounts";
import AdminNav from "@/components/AdminNav";
import BoxesToReviewBox from "@/components/BoxesToReviewBox";
import BoxReportsChart from "@/components/BoxReportsChart";
import AllBoxesTable from "@/components/AllBoxesTable";

/** The chart's own window — src/lib/adminDashboard.ts's bucketCheckinsByWeek default. */
const CHART_WEEKS = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function BoxesPage({
  searchParams,
}: {
  searchParams?: Promise<{ show?: string }>;
} = {}) {
  let email: string;
  let showActivity = false;
  let boxHealthEntries: Awaited<ReturnType<typeof loadBoxHealthEntries>>;
  let recentCheckins: Awaited<ReturnType<typeof loadRecentCheckinsAllBoxes>>;
  let photos: AdminBoxPhotoRow[];
  let adopters: AdminBoxAdopterRow[];
  let navCounts: AdminNavCounts;

  const now = new Date();
  // Window start for the 8-week chart — same boundary bucketCheckinsByWeek's
  // own first bucket starts at, so the query never fetches less than the
  // chart can show (a wider fetch than needed just wastes one D1 read).
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceIso = new Date(todayUtc - CHART_WEEKS * 7 * MS_PER_DAY).toISOString();

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;

    [boxHealthEntries, recentCheckins, photos, adopters, navCounts] = await Promise.all([
      loadBoxHealthEntries(db, now).catch(() => [] as Awaited<ReturnType<typeof loadBoxHealthEntries>>),
      loadRecentCheckinsAllBoxes(db, sinceIso),
      loadReviewQueue(db).catch(() => [] as AdminBoxPhotoRow[]),
      loadPendingAdopters(db).catch(() => [] as AdminBoxAdopterRow[]),
      // Same shared counts helper every other admin page calls (item 7 fix)
      // — this page used to hard-code submissions/proposals to 0, which read
      // as "nothing pending" even when the full queues had real rows.
      loadAdminNavCounts(db),
    ]);
  } catch (err) {
    handlePageAuthError(err);
  }

  const inServiceCount = boxHealthEntries.filter((e) => e.removedOn === null).length;
  const weeklyBuckets = bucketCheckinsByWeek(
    recentCheckins.map((c) => ({ kind: c.kind, createdAt: c.created_at })),
    now,
    CHART_WEEKS,
  );

  const reviewByVenueId = groupBoxReviewItems(photos, adopters);
  const reviewingBoxCount = Object.keys(reviewByVenueId).length;
  const flaggedPhotosCount = photos.filter((p) => p.status === "flagged").length;
  const { show } = searchParams ? await searchParams : {};
  const showReview = show === "review";

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="boxes" counts={navCounts} showActivity={showActivity} />
      <div className="px-4 py-6 sm:px-6">
        <BoxesToReviewBox
          reviewingBoxCount={reviewingBoxCount}
          photosCount={photos.length}
          flaggedPhotosCount={flaggedPhotosCount}
          sponsorRequestsCount={adopters.length}
        />

        <h2 className="wordmark mb-4 text-lg text-[var(--color-ink-900)]">Blessing boxes — {inServiceCount} in service</h2>

        <section className="elevation-1 mb-6 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
          <h2 className="wordmark text-lg text-[var(--color-ink-900)]">Box reports, last 8 weeks</h2>
          <div className="mt-3">
            <BoxReportsChart buckets={weeklyBuckets} />
          </div>
        </section>

        <section>
          <h2 className="wordmark mb-3 text-lg text-[var(--color-ink-900)]">All boxes</h2>
          {/* key forces a remount on `?show=review` — see this file's own header. */}
          <AllBoxesTable
            key={showReview ? "review" : "all"}
            entries={boxHealthEntries}
            reviewByVenueId={reviewByVenueId}
            initialShowReview={showReview}
          />
        </section>
      </div>
    </main>
  );
}
