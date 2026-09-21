/**
 * /box/[id]/history — a single blessing box's full history (map-first
 * rework, scope addition 2026-09-18: Kyle wanted the in-map card to show
 * only the current snapshot, with a "History" link to "a separate page
 * where we could show all the historical information, check-ins, and all
 * that fun stuff").
 *
 * Same server-shell shape as the old /box/[id]/page.tsx this replaces as a
 * real destination: `force-dynamic` (boxes are live, not published — see
 * that file's own header, unchanged reasoning), `loadBox` reads D1 directly
 * for `generateMetadata`, best-effort degrade to `notFound()` on a D1
 * failure or an unknown id. The actual history LIST is
 * BoxHistoryContent.tsx (client), which reuses useBoxActivity/
 * BoxActivityList — the same activity read path slice 3 built, filtered to
 * this one box, not a second query.
 *
 * Passes the FULL loaded `box` (fix, PR review 2026-09-18), not just its id
 * and name — BoxHistoryContent now also renders BoxCardBody (status,
 * check-in panel) above the list, since a mapUnavailable visitor is routed
 * straight here with no other way to check in. Same D1 read already done
 * for `generateMetadata`, not a second query.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildPageMetadata } from "@/lib/site";
import { loadLiveBoxById, loadVisibleCheckins, type CheckinStatusInput } from "@/lib/blessingBoxes";
import { loadApprovedPhotosForVenue } from "@/lib/boxPhotos";
import { ALL_TIME_PHOTO_LIMIT } from "@/lib/boxStats";
import { logBlessingBoxesReadFailure } from "@/lib/logger";
import BoxHistoryContent from "@/components/BoxHistoryContent";

export const dynamic = "force-dynamic";

async function loadBox(id: string) {
  try {
    const { env } = getCloudflareContext();
    return await loadLiveBoxById(env.ADMIN_DB, id);
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return null;
  }
}

/**
 * Slice 7 (Numbers) — the box's ENTIRE check-in history and approved-photo
 * timestamps, read once here (server-side) and handed to BoxNumbersPanel via
 * props, so switching the period picker (7d/30d/90d/all) recomputes counts
 * client-side with zero extra fetch (boxStats.ts's functions are pure).
 * Reuses loadVisibleCheckins/loadApprovedPhotosForVenue — no new D1 query for
 * the per-box case at all (see boxStats.ts's own header). Best-effort,
 * separate from loadBox() above: a Numbers-only D1 hiccup must degrade to
 * "no numbers" (empty arrays), never take down the rest of the page (the
 * box's own snapshot/check-in panel/photo gallery all already loaded fine).
 */
async function loadBoxStatsInputs(id: string): Promise<{ checkins: CheckinStatusInput[]; approvedPhotoCreatedAts: string[] }> {
  try {
    const { env } = getCloudflareContext();
    const [checkins, photos] = await Promise.all([
      loadVisibleCheckins(env.ADMIN_DB, id),
      loadApprovedPhotosForVenue(env.ADMIN_DB, id, ALL_TIME_PHOTO_LIMIT),
    ]);
    return { checkins, approvedPhotoCreatedAts: photos.map((p) => p.createdAt) };
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (box stats read)");
    return { checkins: [], approvedPhotoCreatedAts: [] };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const box = await loadBox(id);
  if (!box) return {};
  return buildPageMetadata({
    title: `${box.name} — History`,
    description: `Full check-in and activity history for ${box.name}, a community blessing box in Pueblo, CO.`,
    path: `/box/${box.id}/history`,
  });
}

export default async function BoxHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const box = await loadBox(id);
  if (!box) notFound();
  const statsInputs = await loadBoxStatsInputs(id);

  return <BoxHistoryContent box={box} allCheckins={statsInputs.checkins} approvedPhotoCreatedAts={statsInputs.approvedPhotoCreatedAts} />;
}
