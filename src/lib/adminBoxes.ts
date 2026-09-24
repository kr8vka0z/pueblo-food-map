/**
 * adminBoxes.ts — assembles src/lib/boxHealth.ts's BoxHealthEntry[] from D1
 * for the admin surfaces that show it: the /admin Dashboard's "Boxes that
 * need help" panel and the /admin/boxes tab (map, "Needs help now"/"Gone
 * quiet" lists, all-boxes table). ONE loader so both pages read the exact
 * same box set, latest check-in, and caretaker name — the task spec's own
 * requirement that both screens use "the SAME function" for status extends
 * naturally to the query that feeds it; two independently-written D1 reads
 * could drift (e.g. one forgetting the `status != 'archived'` filter).
 *
 * Kept out of blessingBoxes.ts (same "own module" reasoning boxPhotos.ts /
 * boxAdopters.ts already give for their own admin queries) — this is
 * ADMIN-only assembly wiring three already-existing reads together, not a
 * new public-facing concern.
 */

import { loadLatestCheckinPerBox } from "@/lib/blessingBoxes";
import { loadApprovedAdopterNamesForVenues } from "@/lib/boxAdopters";
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
 * table there shows every box as "quiet"/uncaretakered rather than 500ing
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
    // Best-effort (degrades to no caretaker data) rather than throwing,
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
      caretaker: names?.[0] ?? null,
      removedOn: venue.removed_on,
    };
  });
}
