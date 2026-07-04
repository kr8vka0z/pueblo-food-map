/**
 * Canonical Venue type and VenueCategory union.
 *
 * Every data source (src/data/venues.ts, grocery-osm.ts, pantries-plentiful.ts)
 * conforms to this interface. Components import from here — never from
 * individual data files — so the type definition stays in one place.
 */

export type VenueCategory =
  | "pantry"
  | "grocery"
  | "convenience"
  | "farm"
  | "garden"
  | "edible_landscape"
  | "meal_site";

export type WeeklyHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string[]>
>;

export interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  lat: number;
  lng: number;
  address: string;
  hours_weekly?: WeeklyHours;
  accepts_snap?: boolean;
  accepts_wic?: boolean;
  phone?: string;
  email?: string;
  url?: string;
  notes?: string;
  operator?: string;
  source: string;
  last_verified: string;
}

// ─── Admin row shape (#253) ─────────────────────────────────────────────────
// The admin's read-only venue list (src/app/admin/page.tsx,
// src/components/VenueListView.tsx) reads full D1 `venues` rows, not the
// public Venue shape above — SELECT * includes every admin-only workflow
// column (status, source_type, outside_county, audit columns) that the
// publish path strips before a row ever becomes a public Venue.
//
// Deliberately NOT unified with src/lib/publishVenues.ts's VenueRow, even
// though the two describe the same D1 table: that file's VenueRow is the
// PRE-validation shape (category loosely typed as `string`, since publish
// hasn't checked it against the enum yet) used by a validate-then-strip
// pipeline. This file has zero imports today (every data source in this
// app conforms to it, never the reverse) — importing VenueRow from a
// lib/ module here would risk a circular import the moment that module
// ever imports something from this one (see ARCHITECTURE.md's note on why
// pfp-venues.ts had to move out of venues.ts for the same reason). A few
// duplicated field names is cheaper than that failure mode.

/** Mirrors the `venues.status` CHECK constraint (migrations/0001_init_admin_schema.sql). */
export type AdminVenueStatus = "draft" | "published" | "archived";

/** Mirrors the `venues.source_type` CHECK constraint (migrations/0001_init_admin_schema.sql). */
export type AdminVenueSourceType = "pfp" | "osm" | "plentiful" | "gtfs" | "manual";

/**
 * One full row of the D1 `venues` table — every column, admin-only ones
 * included. `category` is typed as the strict VenueCategory union (not
 * `string`, unlike VenueRow) because this type is read-only display data
 * trusted to already satisfy the DB's CHECK constraint, not an
 * about-to-be-validated publish candidate.
 */
export interface AdminVenueRow {
  id: string;
  name: string;
  category: VenueCategory;
  lat: number;
  lng: number;
  address: string;
  hours_weekly: string | null;
  accepts_snap: number | null;
  accepts_wic: number | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  notes: string | null;
  operator: string | null;
  source: string;
  last_verified: string;
  status: AdminVenueStatus;
  source_type: AdminVenueSourceType;
  outside_county: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  published_at: string | null;
  published_by: string | null;
}
