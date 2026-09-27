/**
 * adminBoxes.ts — assembles src/lib/boxHealth.ts's BoxHealthEntry[] from D1
 * for the admin surfaces that show it: the /admin Dashboard's "Boxes that
 * need help" panel and the /admin/boxes tab's all-boxes table. ONE loader so
 * both pages read the exact same box set, latest check-in, and sponsor
 * names — the task spec's own requirement that both screens use "the SAME
 * function" for status extends naturally to the query that feeds it; two
 * independently-written D1 reads could drift (e.g. one forgetting the
 * `status != 'archived'` filter).
 *
 * Kept out of blessingBoxes.ts (same "own module" reasoning boxPhotos.ts /
 * boxAdopters.ts already give for their own admin queries) — this is
 * ADMIN-only assembly wiring three already-existing reads together, not a
 * new public-facing concern.
 */

import { loadLatestCheckinPerBox } from "@/lib/blessingBoxes";
import { loadApprovedAdopterNamesForVenues, type AdminBoxAdopterRow } from "@/lib/boxAdopters";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";
import { computeBoxHealth, type BoxHealthCheckin, type BoxHealthEntry } from "@/lib/boxHealth";

interface BoxVenueRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** blessing_boxes.removed_on, via LEFT JOIN — null both when the box is in service AND when it has no blessing_boxes row at all (shouldn't happen post-#? but never treated differently; see BoxHealthEntry.removedOn's own header). */
  removed_on: string | null;
}

export const SELECT_BOX_VENUES_SQL = `
  SELECT v.id, v.name, v.address, v.lat, v.lng, b.removed_on
  FROM venues v
  LEFT JOIN blessing_boxes b ON b.venue_id = v.id
  WHERE v.category = 'blessing_box' AND v.status != 'archived'
`;

/**
 * Every in-service box's health entry — cheap at Pueblo's real box count (a
 * handful today; see AGENTS.md's Blessing Boxes section), so no pagination.
 * `venues` is allowed to throw on failure (same convention every other core
 * venues read in this app follows, e.g. /admin/places's own SELECT * FROM
 * venues) — the two supporting reads (latest check-in, adopter names) each
 * already degrade to empty on their own failure, so one missing/broken
 * table there shows every box as "quiet"/sponsorless rather than 500ing
 * this panel.
 */
export async function loadBoxHealthEntries(db: D1Database, now: Date = new Date()): Promise<BoxHealthEntry[]> {
  const venuesResult = await db.prepare(SELECT_BOX_VENUES_SQL).all<BoxVenueRow>();
  const venues = venuesResult.results ?? [];
  if (venues.length === 0) return [];

  const venueIds = venues.map((v) => v.id);
  const [latestByVenue, adopterNamesByVenue] = await Promise.all([
    loadLatestCheckinPerBox(db),
    // #568 item 7: loadApprovedAdopterNamesForVenues chunks past D1's
    // 100-bound-param ceiling itself now (see that function's own header) —
    // this call site no longer needs to reason about the limit at all.
    // Best-effort (degrades to no sponsor data) rather than throwing,
    // matching the "one missing table must never break this panel" posture
    // above.
    loadApprovedAdopterNamesForVenues(db, venueIds).catch(() => new Map<string, string[]>()),
  ]);

  return venues.map((venue) => {
    const latest = latestByVenue.get(venue.id);
    const checkins: BoxHealthCheckin[] = latest
      ? [{ kind: latest.kind, visibility: "visible", createdAt: latest.created_at, note: latest.note }]
      : [];
    const names = adopterNamesByVenue.get(venue.id);
    return {
      venueId: venue.id,
      name: venue.name,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      health: computeBoxHealth(checkins, now),
      // #671: pass the FULL approved-adopter list through (not just
      // names?.[0]) so AllBoxesTable's Sponsor column can match the public
      // card's "A, B, +N more" format — see BoxHealthEntry.sponsors' own doc.
      sponsors: names ?? [],
      removedOn: venue.removed_on,
    };
  });
}

// ─── #677: "To review" grouping for the /admin/boxes tab ───────────────────
// The tab's own summary box, chip, column and default sort all need "which
// venues have something pending, and what" — grouped ONCE here (by the page
// that already calls loadReviewQueue()/loadPendingAdopters() for the
// summary counts) rather than each consumer re-deriving its own Map, same
// "one loader, one shape" reasoning loadBoxHealthEntries's own header gives
// for the box-health assembly above.

/** One venue's review-column contents — at most one photo and one sponsor request shown per venue (a box with several pending photos is rare at Pueblo's real volume; the edit page's own "Things to review" box is where every item, not just one, is listed and resolved). */
export interface BoxReviewSummary {
  photo?: { id: number; status: "pending" | "flagged"; flagCount: number };
  sponsorRequest?: { displayName: string };
}

/**
 * Groups the tab's own already-fetched review queues by venue id. A
 * FLAGGED photo wins over a merely-pending one when a venue somehow has
 * both (rare) — a visitor's report is the more urgent of the two to
 * surface in one glance. Both input arrays come pre-sorted newest-first
 * (loadReviewQueue/loadPendingAdopters' own ORDER BY), so "first match per
 * venue" is also "most recent."
 *
 * ponytail: only the FIRST matching photo/adopter per venue is kept for
 * this column's single-item summary — a box with a second, third, etc.
 * pending item just doesn't show it here. Ceiling: fine at Pueblo's real
 * volume (a handful of boxes, rarely more than one open item each); the
 * edit page's BoxReviewBox.tsx is the un-capped list if that ever changes.
 */
export function groupBoxReviewItems(
  photos: AdminBoxPhotoRow[],
  adopters: AdminBoxAdopterRow[],
): Record<string, BoxReviewSummary> {
  const byVenue: Record<string, BoxReviewSummary> = {};

  for (const photo of photos) {
    const existing = byVenue[photo.venue_id];
    if (existing?.photo && existing.photo.status === "flagged") continue; // already have the more urgent kind
    byVenue[photo.venue_id] = {
      ...existing,
      photo: { id: photo.id, status: photo.status === "flagged" ? "flagged" : "pending", flagCount: photo.flag_count },
    };
  }

  for (const adopter of adopters) {
    const existing = byVenue[adopter.venue_id];
    if (existing?.sponsorRequest) continue;
    byVenue[adopter.venue_id] = { ...existing, sponsorRequest: { displayName: adopter.display_name } };
  }

  return byVenue;
}
