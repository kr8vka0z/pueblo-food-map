/**
 * blessingBoxes.ts — shared D1 row shapes, SQL, and pure mapping helpers for
 * the Blessing Boxes live layer (slice 1, extended in slice 2 with real
 * check-in-derived status).
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
 *
 * SLICE 2 — computeBoxStatus() is the one place the Build Plan's state
 * diagram ("Blessing Boxes - 2 Box Status.html") is encoded. It is a pure
 * function over a list of check-ins, never a value stored anywhere — the
 * Discovery doc is explicit: "Status is calculated from the latest
 * check-ins, never typed in by hand." Every caller (the public list
 * endpoint, /box/<id>, the admin edit page) funnels through this one
 * function so the rule can never drift between call sites.
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

// ─── Check-ins (slice 2) ────────────────────────────────────────────────────

/** Mirrors migrations/0007_box_checkins.sql's `box_checkins.kind` CHECK. */
export type CheckinKind = "filled" | "took" | "low" | "empty" | "problem";

/** A box's real status, computed by computeBoxStatus() below — never stored. */
export type BoxStatus = "stocked" | "low" | "empty" | "unknown" | "out_of_service";

/** Retained as an alias so any lingering "unknown" literal comparison still reads correctly — "unknown" is BoxStatus's own no-signal value, not a slice-1-only placeholder anymore. */
export const BOX_STATUS_PLACEHOLDER: BoxStatus = "unknown";

/** The minimal shape computeBoxStatus()/computeLastFilledAt() need — deliberately narrower than the full box_checkins row (no id/note/hidden_by), so a caller can build this from either a D1 row or a test fixture with no adapter. */
export interface CheckinStatusInput {
  kind: CheckinKind;
  visibility: "visible" | "hidden";
  created_at: string; // ISO 8601
}

/** A publicly-visible check-in event — kind + timestamp only. No note, no id: the public feed shows events, not notes (Build Plan default, Discovery §7 open-question #5 resolved in the direction of the stated default). */
export interface PublicCheckinEvent {
  kind: Exclude<CheckinKind, "problem">; // 'problem' never reaches a public shape
  createdAt: string;
}

/** How long a status-setting check-in keeps its status before fading to "unknown" — Build Plan default (7 days), Discovery §7 open question #3, "number TBD" in the Discovery table. */
const STATUS_FADE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Only these three kinds ever set a status — 'took' and 'problem' are excluded by construction (not present as keys), matching "'took' does not change status by itself" (Discovery §4) and "problem reports... never in the public log" (this slice's own scope). */
const STATUS_SETTING_KIND: Readonly<Record<string, BoxStatus>> = {
  filled: "stocked",
  low: "low",
  empty: "empty",
};

/**
 * The one place the Build Plan's state diagram is encoded (Blessing Boxes -
 * 2 Box Status.html). Pure — no D1, no Date.now() — so every branch is
 * directly testable: pass `checkins` (any order; only visible, non-hidden
 * rows should ever reach this in production, but a hidden row here is
 * simply ignored, never a caller's job to pre-filter) and `now`.
 *
 * Rule, in the diagram's own order:
 *   1. `outOfService` (an admin pause or confirmed damage) wins over every
 *      check-in, however recent — the diagram's own annotation: "An admin
 *      pause or confirmed damage sends ANY status to Out of service."
 *      Slice 2 has no admin UI that can set this true yet (that's slice 3's
 *      box_events "paused" lifecycle action) — callers pass `false` today;
 *      the branch exists so slice 3 only has to supply the input, not
 *      redo this function.
 *   2. Otherwise, find the most recent VISIBLE check-in whose kind sets a
 *      status (filled/low/empty — never 'took' or 'problem', see
 *      STATUS_SETTING_KIND above). A hidden row is skipped even if it's
 *      the newest — "Hidden check-ins never count" (this slice's own
 *      scope line).
 *   3. If that check-in is more than 7 days old, or none exists at all,
 *      status fades to "unknown" — diagram: "No check-in for 7 days fades
 *      Stocked / Low / Empty back to Unknown."
 *   4. Otherwise the status is exactly what that check-in's kind maps to.
 *
 * WHY the 7-day clock is measured from the latest STATUS-SETTING check-in,
 * not the latest check-in of any kind: 'took' is explicitly a non-signal
 * ("does not change status by itself... feeds the stats" — Discovery §4),
 * and the diagram's own transition labels (FILLED / RUNNING LOW / EMPTY)
 * never mention 'took' or 'problem' at all — so a 'took' happening today
 * does not "renew" a status it never set. **This is a DELIBERATELY CHOSEN
 * reading, not the only valid one** — the Build Plan's own wording ("no
 * check-ins for 7 days") is looser and could be read as ANY check-in of
 * any kind resetting the clock, including 'took'/'problem'. Picked the
 * stricter reading (only a status-setting kind renews the window) because
 * it's the more defensible of the two against the diagram's own transition
 * labels; stated here explicitly so a later slice doesn't silently assume
 * the other reading, and so this stays visible as a known, reported
 * deviation rather than an unexamined implementation detail.
 */
export function computeBoxStatus(
  checkins: CheckinStatusInput[],
  now: Date,
  outOfService: boolean,
): BoxStatus {
  if (outOfService) return "out_of_service";

  let latest: CheckinStatusInput | null = null;
  for (const c of checkins) {
    if (c.visibility !== "visible") continue;
    if (!(c.kind in STATUS_SETTING_KIND)) continue;
    if (!latest || c.created_at > latest.created_at) latest = c;
  }
  if (!latest) return "unknown";

  const ageMs = now.getTime() - new Date(latest.created_at).getTime();
  if (ageMs > STATUS_FADE_WINDOW_MS) return "unknown";

  return STATUS_SETTING_KIND[latest.kind];
}

/**
 * The most recent VISIBLE 'filled' check-in's timestamp, with NO 7-day
 * window — a box can honestly show "last filled 3 weeks ago" even after
 * its status has faded to Unknown; that's a different fact than "is this
 * box's status still fresh." Returns null when the box has never been
 * marked filled (or every such check-in is hidden).
 */
export function computeLastFilledAt(checkins: CheckinStatusInput[]): string | null {
  let latest: string | null = null;
  for (const c of checkins) {
    if (c.visibility !== "visible" || c.kind !== "filled") continue;
    if (!latest || c.created_at > latest) latest = c.created_at;
  }
  return latest;
}

/** How many recent public check-in events a box's public shape carries — a feed, not a full history (the full history is slice 3's /boxes/activity page). */
const RECENT_CHECKINS_LIMIT = 5;

/**
 * Builds the public recent-events list from a set of already-loaded
 * check-ins: visible, non-'problem' only (problem reports are admin-only —
 * this slice's own scope line), newest first, capped at
 * RECENT_CHECKINS_LIMIT. Never carries a note — see PublicCheckinEvent's
 * own header.
 */
function toPublicCheckinEvents(checkins: CheckinStatusInput[]): PublicCheckinEvent[] {
  return checkins
    .filter((c) => c.visibility === "visible" && c.kind !== "problem")
    .slice() // don't mutate the caller's array with the sort below
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, RECENT_CHECKINS_LIMIT)
    .map((c) => ({ kind: c.kind as PublicCheckinEvent["kind"], createdAt: c.created_at }));
}

// ─── Public shape ───────────────────────────────────────────────────────────

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
    status: BoxStatus;
    lastFilledAt: string | null;
    recentCheckins: PublicCheckinEvent[];
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

/**
 * One joined D1 row -> the public shape. Pure so it's testable without a
 * live D1 binding. `checkins` defaults to [] and `now` to the real current
 * time so slice-1-era callers (and this file's own pre-slice-2 tests) that
 * pass neither still get a sensible result: no signal -> "unknown", exactly
 * the old placeholder's value.
 *
 * WHY `removed_on` is the outOfService input: no dedicated "paused" flag
 * exists yet (that's slice 3's box_events lifecycle) — `blessing_boxes.
 * removed_on` already means "box no longer in service" (migrations/0005's
 * own column comment) and is already admin-editable via AddVenueForm's box
 * fieldset, so it's the one real signal available today that matches the
 * diagram's Out-of-service state. See computeBoxStatus()'s own header for
 * the full deferral note.
 *
 * ⚠ This is NOT wired to the "Remove from map" archive action, and never
 * should be conflated with it — verified 2026-09-17 review: `POST
 * /api/admin/venues/[id]/archive` only ever sets `venues.status='archived'`;
 * it never touches `blessing_boxes.removed_on`. The two are separate,
 * non-overlapping mechanisms: archiving a box removes it from
 * SELECT_LIVE_BOXES_SQL/SELECT_LIVE_BOX_BY_ID_SQL entirely (both filter
 * `v.status != 'archived'`), so an archived box disappears from the map and
 * /box/<id> 404s — it never reaches this function or reads as
 * "out_of_service" at all. The ONLY way a box reads "out_of_service" today
 * is an admin hand-editing `removed_on` on the box's own edit fieldset
 * while leaving the venue itself published/draft (not archived). There is
 * still no admin "pause" button that flips this in one click — an admin
 * edits the field directly, same as any other box detail.
 */
export function mapRowToPublicBox(
  row: BoxJoinRow,
  checkins: CheckinStatusInput[] = [],
  now: Date = new Date(),
): PublicBlessingBox {
  const outOfService = row.removed_on !== null && row.removed_on !== "";
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
      status: computeBoxStatus(checkins, now, outOfService),
      lastFilledAt: computeLastFilledAt(checkins),
      recentCheckins: toPublicCheckinEvents(checkins),
    },
  };
}

export function mapRowsToPublicBoxes(rows: BoxJoinRow[]): PublicBlessingBox[] {
  return rows.map((row) => mapRowToPublicBox(row));
}

/** Type guard used by MapWrapper's merged venue list to route a click to /box/<id> instead of opening the normal detail card. */
export function isBlessingBox(category: VenueCategory): category is "blessing_box" {
  return category === "blessing_box";
}

// ─── Check-in SQL (slice 2) ─────────────────────────────────────────────────
// 'problem' is excluded at the SQL level, not just by toPublicCheckinEvents'
// filter above — belt-and-suspenders, same structural-guarantee reasoning
// migrations/0005 already applies to host_contact: a public read site
// should never even fetch the private row, not just remember to drop it.

// Every check-in query orders by `created_at DESC, id DESC` — id is the
// autoincrement insert order, so this is a deterministic tiebreaker for two
// rows sharing a millisecond timestamp (real on D1: created_at's precision
// is ms, and a busy box can get two check-ins in the same ms). Without it,
// which of the two "wins" computeBoxStatus()/computeLastFilledAt() (both of
// which only compare `created_at` strings, never `id`) is left to SQLite's
// unspecified tie order — id DESC pins it to "the one inserted last wins,"
// matching what a human would expect "most recent" to mean.

const SELECT_VISIBLE_CHECKINS_SQL = `
  SELECT venue_id, kind, visibility, created_at
  FROM box_checkins
  WHERE venue_id = ? AND visibility = 'visible' AND kind != 'problem'
  ORDER BY created_at DESC, id DESC
`;

/** One D1 IN(...) query for every box on the list endpoint, not N+1 — see loadLiveBoxes' own call site. */
function selectVisibleCheckinsForVenuesSql(count: number): string {
  const placeholders = Array(count).fill("?").join(", ");
  return `
    SELECT venue_id, kind, visibility, created_at
    FROM box_checkins
    WHERE visibility = 'visible' AND kind != 'problem' AND venue_id IN (${placeholders})
    ORDER BY created_at DESC, id DESC
  `;
}

interface VisibleCheckinRow extends CheckinStatusInput {
  venue_id: string;
}

/** Every visible, non-problem check-in for ONE box, newest first — feeds both computeBoxStatus/computeLastFilledAt and the public recent-events list for /box/<id>. */
export async function loadVisibleCheckins(db: D1Database, venueId: string): Promise<CheckinStatusInput[]> {
  const result = await db.prepare(SELECT_VISIBLE_CHECKINS_SQL).bind(venueId).all<CheckinStatusInput>();
  return result.results ?? [];
}

/** Same as loadVisibleCheckins, batched for every id in `venueIds` in one query — what loadLiveBoxes uses so the list endpoint doesn't issue one check-ins query per box. */
export async function loadVisibleCheckinsForVenues(
  db: D1Database,
  venueIds: string[],
): Promise<Map<string, CheckinStatusInput[]>> {
  const byVenue = new Map<string, CheckinStatusInput[]>();
  if (venueIds.length === 0) return byVenue;

  const result = await db
    .prepare(selectVisibleCheckinsForVenuesSql(venueIds.length))
    .bind(...venueIds)
    .all<VisibleCheckinRow>();

  for (const row of result.results ?? []) {
    const existing = byVenue.get(row.venue_id);
    const entry: CheckinStatusInput = { kind: row.kind, visibility: row.visibility, created_at: row.created_at };
    if (existing) existing.push(entry);
    else byVenue.set(row.venue_id, [entry]);
  }
  return byVenue;
}

// ─── Admin check-in read (slice 2) ─────────────────────────────────────────
// Unlike SELECT_VISIBLE_CHECKINS_SQL above, the admin screen needs EVERY
// check-in for a box — hidden rows and 'problem' reports included — so an
// admin can actually see what they're hiding/unhiding, and so a problem
// report (never shown publicly, see the checkins route's own header) still
// reaches the one place it's meant to be reviewed. This is intentionally a
// separate query, not a flag on the public one, so the public path can never
// accidentally start returning hidden/problem rows by a future refactor.

export interface AdminCheckinRow {
  id: number;
  venue_id: string;
  kind: CheckinKind;
  note: string | null;
  visibility: "visible" | "hidden";
  hidden_by: string | null;
  hidden_at: string | null;
  created_at: string;
}

const SELECT_ALL_CHECKINS_FOR_VENUE_SQL = `
  SELECT id, venue_id, kind, note, visibility, hidden_by, hidden_at, created_at
  FROM box_checkins
  WHERE venue_id = ?
  ORDER BY created_at DESC, id DESC
`;

/** Every check-in for ONE box — visible + hidden, including 'problem' — newest first. Feeds BoxCheckinsAdminPanel via the venue edit page's resolveBoxCheckins(). */
export async function loadAllCheckinsForBox(db: D1Database, venueId: string): Promise<AdminCheckinRow[]> {
  const result = await db.prepare(SELECT_ALL_CHECKINS_FOR_VENUE_SQL).bind(venueId).all<AdminCheckinRow>();
  return result.results ?? [];
}

// ─── D1 reads ───────────────────────────────────────────────────────────────
// Both take a D1Database directly (never getCloudflareContext themselves) so
// every caller (the public route, /box/<id>, sitemap.ts) owns its own
// try/catch + logBlessingBoxesReadFailure — same public-route convention as
// src/lib/publicSubmissions.ts (getCloudflareContext().env.ADMIN_DB read at
// the call site, this file stays a plain D1Database consumer).
//
// `now` is an optional injectable clock (defaults to `new Date()`) purely so
// tests can pin the 7-day fade window without faking global time.

export async function loadLiveBoxes(db: D1Database, now: Date = new Date()): Promise<PublicBlessingBox[]> {
  const result = await db.prepare(SELECT_LIVE_BOXES_SQL).all<BoxJoinRow>();
  const rows = result.results ?? [];
  const checkinsByVenue = await loadVisibleCheckinsForVenues(db, rows.map((r) => r.id));
  return rows.map((row) => mapRowToPublicBox(row, checkinsByVenue.get(row.id) ?? [], now));
}

export async function loadLiveBoxById(
  db: D1Database,
  id: string,
  now: Date = new Date(),
): Promise<PublicBlessingBox | null> {
  const row = await db.prepare(SELECT_LIVE_BOX_BY_ID_SQL).bind(id).first<BoxJoinRow>();
  if (!row) return null;
  const checkins = await loadVisibleCheckins(db, id);
  return mapRowToPublicBox(row, checkins, now);
}
