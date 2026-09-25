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
  | "meal_site"
  | "blessing_box";

export type WeeklyHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string[]>
>;

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * Non-weekly recurrences `hours_weekly` cannot express (#400) — e.g. "4th
 * Tuesday of each month, 11:00 AM – 12:00 PM," the real shape 3 of the 35
 * live Pueblo Plentiful pantries use. Stored in the `hours_irregular` JSON
 * column ALONGSIDE `hours_weekly` (migrations/0015_venue_hours_irregular.sql)
 * — never replacing it: a venue (e.g. Lynn Gardens Baptist Church) can
 * legitimately have both a weekly recurrence and a separate monthly special.
 *
 * `slots` reuses `hours_weekly`'s own slot-string format (parsed/formatted
 * by src/lib/hours.ts's shared parseSlot/formatSlot) so both schedule kinds
 * render through identical time-formatting code — no second time parser.
 */
export interface IrregularSchedule {
  /** "monthly_ordinal": e.g. 4th Tuesday. "monthly_date": a fixed day-of-month. "other": prose-only via `note`. */
  recurrence: "monthly_ordinal" | "monthly_date" | "other";
  /** Required (and only meaningful) when recurrence === "monthly_ordinal". "last" covers a month's final occurrence of `weekday`, whatever date that lands on. */
  ordinal?: 1 | 2 | 3 | 4 | 5 | "last";
  /** Required when recurrence === "monthly_ordinal". */
  weekday?: DayKey;
  /** Required (and only meaningful) when recurrence === "monthly_date". 1-31; a value past the month's real length is skipped for that month (see src/lib/hours.ts). */
  day_of_month?: number;
  /** Same format as WeeklyHours' per-day slot arrays, e.g. ["11:00-12:00"]. */
  slots: string[];
  /** Free-text fallback, required for recurrence === "other" (e.g. "3rd weekend, call ahead"); optional annotation otherwise. */
  note?: string;
}

export interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  lat: number;
  lng: number;
  address: string;
  hours_weekly?: WeeklyHours;
  /** Non-weekly schedules (monthly-ordinal, etc.) — see IrregularSchedule's own doc comment. Always ALONGSIDE hours_weekly, never a replacement. */
  hours_irregular?: IrregularSchedule[];
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
// ever imports something from this one (see src/data/pfp-venues.ts's header
// on why it had to move out of venues.ts for the same reason). A few
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
  /** JSON-encoded IrregularSchedule[] (nullable) — migrations/0015_venue_hours_irregular.sql. */
  hours_irregular: string | null;
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
