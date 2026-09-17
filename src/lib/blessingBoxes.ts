/**
 * blessingBoxes.ts — shared D1 row shapes, SQL, and pure mapping helpers for
 * the Blessing Boxes live layer (slice 1).
 *
 * WHY a separate lib rather than folding into publishVenues.ts/adminVenues.ts:
 * boxes are explicitly NOT part of the draft->publish snapshot pipeline
 * (Blessing Boxes Build Plan, architecture call #1 — "boxes are live, not
 * published") — their read path is its own thing: a public live endpoint and
 * /box/<id> page both read D1 directly, at request time, every time. Keeping
 * the query + row-mapping logic here (pure, no Next.js/Cloudflare imports)
 * makes it unit-testable with plain fixtures, same split this repo already
 * uses for publishVenues.ts vs. its route handler.
 *
 * WHY `host_contact` is never in PublicBlessingBox: it's the one field the
 * schema comment (migrations/0005_blessing_boxes.sql) calls PRIVATE. Naming
 * every public column explicitly in SELECT_BOX_COLUMNS/mapRowToPublicBox
 * (never `SELECT *`) is what makes that guarantee structural rather than a
 * rule someone has to remember at every call site.
 */

import type { Venue, VenueCategory } from "@/types/venue";

// ─── D1 row shapes ──────────────────────────────────────────────────────────

/** Mirrors migrations/0005_blessing_boxes.sql's `blessing_boxes` table exactly. */
export interface BlessingBoxRow {
  venue_id: string;
  host_name: string | null;
  host_note: string | null;
  host_contact: string | null; // PRIVATE — read by admin code only, never mapped into a public shape.
  most_needed: string | null;
  installed_on: string | null;
  removed_on: string | null;
  qr_code_id: string | null;
  created_at: string;
  updated_at: string;
}

/** The subset of a `venues` row a blessing_box join needs — same shape family as publishVenues.ts's VenueRow. */
export interface BoxVenueRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  source: string;
  last_verified: string;
}

/** One joined `venues` + `blessing_boxes` row, as SELECTed by the queries below. */
export interface BoxJoinRow extends BoxVenueRow {
  host_name: string | null;
  host_note: string | null;
  most_needed: string | null;
  installed_on: string | null;
  removed_on: string | null;
}

// ─── Public shape ───────────────────────────────────────────────────────────

/**
 * Slice 1 has no check-ins yet (that's slice 2), so a box's status is always
 * this one placeholder — never computed, never stored. Exported as a named
 * constant (not a literal repeated at each call site) so slice 2's real
 * status calculation has one obvious place to replace.
 */
export const BOX_STATUS_PLACEHOLDER = "unknown" as const;

/**
 * What the public live endpoint and /box/<id> page are allowed to return.
 * Extends Venue (not BoxVenueRow) so a box slots into the same map-marker /
 * filter-pipeline code every other Venue already flows through (see
 * MapWrapper.tsx's box-merge comment) — `category` is always literally
 * "blessing_box", never a union member from elsewhere.
 */
export interface PublicBlessingBox extends Venue {
  category: "blessing_box";
  box: {
    hostName: string | null;
    hostNote: string | null;
    mostNeeded: string | null;
    installedOn: string | null;
    removedOn: string | null;
    status: typeof BOX_STATUS_PLACEHOLDER;
  };
}

// ─── SQL ────────────────────────────────────────────────────────────────────

/**
 * Live boxes are never gated by `venues.status` (draft/published) the way
 * ordinary venues are — that column exists for the publish-snapshot flow,
 * which boxes deliberately skip (architecture call #1). "Live" for a box
 * means "not archived": an admin's newly-created box (still `status='draft'`
 * because the create route always inserts drafts) is visible immediately,
 * with no publish click required — that's the whole point of the live layer.
 */
export const SELECT_LIVE_BOXES_SQL = `
  SELECT v.id, v.name, v.lat, v.lng, v.address, v.source, v.last_verified,
         b.host_name, b.host_note, b.most_needed, b.installed_on, b.removed_on
  FROM venues v
  JOIN blessing_boxes b ON b.venue_id = v.id
  WHERE v.category = 'blessing_box' AND v.status != 'archived'
  ORDER BY v.name COLLATE NOCASE ASC
`;

export const SELECT_LIVE_BOX_BY_ID_SQL = `
  SELECT v.id, v.name, v.lat, v.lng, v.address, v.source, v.last_verified,
         b.host_name, b.host_note, b.most_needed, b.installed_on, b.removed_on
  FROM venues v
  JOIN blessing_boxes b ON b.venue_id = v.id
  WHERE v.category = 'blessing_box' AND v.status != 'archived' AND v.id = ?
`;

// ─── Pure mapping ───────────────────────────────────────────────────────────

/** One joined D1 row -> the public shape. Pure so it's testable without a live D1 binding. */
export function mapRowToPublicBox(row: BoxJoinRow): PublicBlessingBox {
  return {
    id: row.id,
    name: row.name,
    category: "blessing_box",
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    source: row.source,
    last_verified: row.last_verified,
    box: {
      hostName: row.host_name,
      hostNote: row.host_note,
      mostNeeded: row.most_needed,
      installedOn: row.installed_on,
      removedOn: row.removed_on,
      status: BOX_STATUS_PLACEHOLDER,
    },
  };
}

export function mapRowsToPublicBoxes(rows: BoxJoinRow[]): PublicBlessingBox[] {
  return rows.map(mapRowToPublicBox);
}

/** Type guard used by MapWrapper's merged venue list to route a click to /box/<id> instead of opening the normal detail card. */
export function isBlessingBox(category: VenueCategory): category is "blessing_box" {
  return category === "blessing_box";
}

// ─── D1 reads ───────────────────────────────────────────────────────────────
// Both take a D1Database directly (never getCloudflareContext themselves) so
// every caller (the public route, /box/<id>, sitemap.ts) owns its own
// try/catch + logBlessingBoxesReadFailure — same public-route convention as
// src/lib/publicSubmissions.ts (getCloudflareContext().env.ADMIN_DB read at
// the call site, this file stays a plain D1Database consumer).

export async function loadLiveBoxes(db: D1Database): Promise<PublicBlessingBox[]> {
  const result = await db.prepare(SELECT_LIVE_BOXES_SQL).all<BoxJoinRow>();
  return mapRowsToPublicBoxes(result.results ?? []);
}

export async function loadLiveBoxById(db: D1Database, id: string): Promise<PublicBlessingBox | null> {
  const row = await db.prepare(SELECT_LIVE_BOX_BY_ID_SQL).bind(id).first<BoxJoinRow>();
  return row ? mapRowToPublicBox(row) : null;
}
