/**
 * adminVenueLookup.ts — the "current venue" context a change-proposal card
 * needs to show alongside its diff. The venue edit page maps its own row
 * through toVenueLookup() for SuggestionsBox; ProposalCard.tsx and
 * SuggestionsBox.tsx import the `VenueLookup` type from here.
 */

import type { WeeklyHours } from "@/types/venue";

/** The raw `venues` columns toVenueLookup reads; an AdminVenueRow satisfies it. */
interface VenueLookupRow {
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  phone: string | null;
  url: string | null;
  hours_weekly: string | null;
  accepts_snap: number | null;
  accepts_wic: number | null;
  source: string;
  last_verified: string;
  status: string;
}

/**
 * Widened from {name, status} (#390 review — Kyle: "How am I supposed to
 * tell what the change is? There's no detail."). A reviewer needs enough of
 * the CURRENT venue to recognise the place and sanity-check a proposed
 * change against it — name and status alone answer "does this id exist,"
 * not "is this the place I think it is."
 *
 * Widened AGAIN (right-hand preview, staging review — Kyle: "it would be
 * nice if there was a full preview... easier to catch errors that way").
 * The preview reuses the real public VenueCard component, which needs
 * lat/lng/hours_weekly/accepts_snap/accepts_wic/source to render a genuine
 * card — the previous {name, category, address, phone, url, last_verified,
 * status} shape had enough for a text summary but not enough for a real
 * render. Still deliberately NOT every AdminVenueRow column (no notes,
 * operator, email, audit fields) — VenueCard doesn't render any of those.
 */
export interface VenueLookup {
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  phone: string | null;
  url: string | null;
  hours_weekly: WeeklyHours | null;
  accepts_snap?: boolean;
  accepts_wic?: boolean;
  source: string;
  last_verified: string;
  status: string;
}

/**
 * Maps a raw `venues` row (the edit page's own `SELECT *`, so no second read)
 * to the VenueLookup shape. Carries `status` so a caller can label an `add`
 * proposal targeting an already-archived id "Restore" instead of "New".
 */
export function toVenueLookup(row: VenueLookupRow): VenueLookup {
  // hours_weekly is JSON text in D1 (migrations/0001) — same shape
  // src/lib/adminVenueForm.ts's hoursWeeklyJsonToDraft() unpacks, but
  // parsed straight to the object VenueCard/Venue expects here rather
  // than that file's per-day-comma-string draft shape (that's a form
  // editing convenience, not what a read-only preview needs). A bad
  // JSON blob degrades to null (no hours row) rather than throwing —
  // same fail-soft posture as parseProposalRow.
  let hours: WeeklyHours | null = null;
  if (row.hours_weekly) {
    try {
      hours = JSON.parse(row.hours_weekly) as WeeklyHours;
    } catch {
      hours = null;
    }
  }
  return {
    name: row.name,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    phone: row.phone,
    url: row.url,
    hours_weekly: hours,
    // Tri-state INTEGER -> optional boolean, same NULL=unknown mapping
    // publishVenues.ts's serializer already uses for the exact same
    // column (src/lib/publishVenues.ts, "key omitted" comment).
    accepts_snap: row.accepts_snap === null ? undefined : row.accepts_snap === 1,
    accepts_wic: row.accepts_wic === null ? undefined : row.accepts_wic === 1,
    source: row.source,
    last_verified: row.last_verified,
    status: row.status,
  };
}
