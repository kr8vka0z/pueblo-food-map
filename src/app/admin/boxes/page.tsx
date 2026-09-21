/**
 * /admin/boxes — the Blessing Boxes tab (admin dashboard build, approved
 * mockup Direction B "boxes first"). Everything blessing-boxes-specific
 * that doesn't belong on the Dashboard's general to-do list: a status map,
 * "Needs help now" / "Gone quiet" lists, an 8-week reports chart, and the
 * full box table. "Places due for a check" deliberately does NOT appear
 * here (task spec: Dashboard-only — boxes are excluded from that panel's
 * own query in the first place, see src/lib/adminDashboard.ts).
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
import { rankNeedsHelp, rankQuiet } from "@/lib/boxHealth";
import { bucketCheckinsByWeek } from "@/lib/adminDashboard";
import { loadRecentCheckinsAllBoxes } from "@/lib/blessingBoxes";
import { loadReviewQueue, type AdminBoxPhotoRow } from "@/lib/boxPhotos";
import { loadPendingAdopters, type AdminBoxAdopterRow } from "@/lib/boxAdopters";
import type { AdminNavCounts } from "@/lib/adminNavCounts";
import AdminNav from "@/components/AdminNav";
import BoxesWaitingChips from "@/components/BoxesWaitingChips";
import BoxHealthList from "@/components/BoxHealthList";
import AdminBoxesMap from "@/components/AdminBoxesMap";
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

  const now = new Date();
  // Window start for the 8-week chart — same boundary bucketCheckinsByWeek's
  // own first bucket starts at, so the query never fetches less than the
  // chart can show (a wider fetch than needed just wastes one D1 read).
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceIso = new Date(todayUtc - CHART_WEEKS * 7 * MS_PER_DAY).toISOString();

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;

    [boxHealthEntries, recentCheckins, photos, adopters] = await Promise.all([
      loadBoxHealthEntries(db, now).catch(() => [] as Awaited<ReturnType<typeof loadBoxHealthEntries>>),
      loadRecentCheckinsAllBoxes(db, sinceIso),
      loadReviewQueue(db).catch(() => [] as AdminBoxPhotoRow[]),
      loadPendingAdopters(db).catch(() => [] as AdminBoxAdopterRow[]),
    ]);
  } catch (err) {
    handlePageAuthError(err);
  }

  const navCounts: AdminNavCounts = {
    // Nav pills for submissions/proposals aren't this page's concern to
    // compute — AdminNav only shows a pill when the count is non-zero, so
    // 0 here simply means "no pill," never a wrong number (this page just
    // doesn't have those two counts in hand without an extra query neither
    // this tab nor the task spec asks for).
    submissions: 0,
    proposals: 0,
    photos: photos.length,
    adopters: adopters.length,
  };

  const inServiceCount = boxHealthEntries.filter((e) => e.removedOn === null).length;
  const needsHelp = rankNeedsHelp(boxHealthEntries);
  const quiet = rankQuiet(boxHealthEntries);
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

        <section className="elevation-1 mb-6 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
          <h2 className="wordmark text-lg text-[var(--color-ink-900)]">Blessing boxes — {inServiceCount} in service</h2>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <AdminBoxesMap entries={boxHealthEntries} />
            </div>
            <div className="flex w-full flex-col gap-5 lg:w-[320px] lg:flex-none">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-ink-700)]">Needs help now</h3>
                <div className="mt-2">
                  <BoxHealthList entries={needsHelp} variant="needs-help" emptyMessage="Every box is doing fine." />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-ink-700)]">Gone quiet</h3>
                <div className="mt-2">
                  <BoxHealthList entries={quiet} variant="quiet" emptyMessage="Every box has reported in recently." />
                </div>
              </div>
            </div>
          </div>
        </section>

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
