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
 * uses, so the two screens can never disagree about a box's status. The
 * chips strip's two counts reuse loadReviewQueue/loadPendingAdopters'
 * FULL pending arrays (same loaders /admin/box-photos and
 * /admin/box-adopters already call) purely for their `.length` — no extra
 * COUNT query, same reasoning the Dashboard's own navCounts construction
 * gives.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadBoxHealthEntries } from "@/lib/adminBoxes";
import { bucketCheckinsByWeek } from "@/lib/adminDashboard";
import { loadRecentCheckinsAllBoxes } from "@/lib/blessingBoxes";
import { loadReviewQueue, type AdminBoxPhotoRow } from "@/lib/boxPhotos";
import { loadPendingAdopters, type AdminBoxAdopterRow } from "@/lib/boxAdopters";
import { loadAdminNavCounts, type AdminNavCounts } from "@/lib/adminNavCounts";
import AdminNav from "@/components/AdminNav";
import BoxesWaitingChips from "@/components/BoxesWaitingChips";
import BoxReportsChart from "@/components/BoxReportsChart";
import AllBoxesTable from "@/components/AllBoxesTable";

/** The chart's own window — src/lib/adminDashboard.ts's bucketCheckinsByWeek default. */
const CHART_WEEKS = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function BoxesPage() {
  let email: string;
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

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="boxes" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        <BoxesWaitingChips photosCount={photos.length} adoptersCount={adopters.length} />

        <h2 className="wordmark mb-4 text-lg text-[var(--color-ink-900)]">Blessing boxes — {inServiceCount} in service</h2>

        <section className="elevation-1 mb-6 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
          <h2 className="wordmark text-lg text-[var(--color-ink-900)]">Box reports, last 8 weeks</h2>
          <div className="mt-3">
            <BoxReportsChart buckets={weeklyBuckets} />
          </div>
        </section>

        <section>
          <h2 className="wordmark mb-3 text-lg text-[var(--color-ink-900)]">All boxes</h2>
          <AllBoxesTable entries={boxHealthEntries} />
        </section>
      </div>
    </main>
  );
}
