/**
 * adminVenueLookup.ts — the "current venue" context lookup a change-proposal
 * card needs to show alongside its diff. Originally lived inline in
 * src/app/admin/flags/page.tsx (#397/#390/staging-review widenings — see
 * git history there for the full why); MOVED here (admin dashboard build)
 * because the new /admin Dashboard's "Needs a decision" panel shows a
 * capped preview of the SAME pending proposals and needs the SAME venue
 * context for its rows — a second, hand-copied batching query would risk
 * silently drifting from this one (e.g. the 100-bound-param batching, or
 * which columns VenueCard's real preview needs). src/app/admin/flags/page.tsx
 * re-exports `VenueLookup` so its own existing importers (ProposalsReviewView,
 * both pages' tests) are unaffected by the move.
 */

import { D1_MAX_BOUND_PARAMS, chunkArray } from "@/lib/d1";
import type { WeeklyHours } from "@/types/venue";

interface VenueLookupRow {
  id: string;
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
 * operator, email, audit fields) — VenueCard doesn't render any of those,
 * so pulling them would just be an unused read.
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
 * One `SELECT ... WHERE id IN (...)` per batch of target_venue_ids — never a
 * per-row lookup. Returns an empty map for an empty input rather than issuing
 * a query with no placeholders (invalid SQL). Carries `status` alongside the
 * rest so a caller can label an `add` proposal targeting an already-archived
 * id "Restore" instead of "New" (spec §6.6's "Restore" labeling) without a
 * second query.
 *
 * BATCHING (fix, 2026-09-02): this used to bind every unique id into ONE
 * statement, which threw above 100 ids and 500'd the whole page — the FIRST
 * real pipeline run wrote 107 proposals against 107 distinct venues, so the
 * ceiling is not an edge case here, it is the normal monthly shape.
 *
 * Batching rather than paginating deliberately: a reviewer needs to see the
 * whole queue to filter it, and splitting one wide read into a few narrower
 * ones keeps that true without changing what the screen shows.
 */
export async function loadVenueLookup(db: D1Database, ids: string[]): Promise<Record<string, VenueLookup>> {
  const uniqueIds = [...new Set(ids)];
  const map: Record<string, VenueLookup> = {};

  for (const batch of chunkArray(uniqueIds, D1_MAX_BOUND_PARAMS)) {
    const placeholders = batch.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT id, name, category, lat, lng, address, phone, url, hours_weekly, accepts_snap, accepts_wic, source, last_verified, status FROM venues WHERE id IN (${placeholders})`,
      )
      .bind(...batch)
      .all<VenueLookupRow>();
    for (const row of result.results) {
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
      map[row.id] = {
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
  }

  return map;
}
