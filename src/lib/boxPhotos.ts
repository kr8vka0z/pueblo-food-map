/**
 * boxPhotos.ts — shared D1 row shapes, SQL, and thin D1-reading helpers for
 * the Blessing Boxes photo layer (slice 5). Same split this repo already
 * uses for blessingBoxes.ts / boxActivity.ts: query + row-mapping logic
 * lives here (pure enough to unit test), route handlers own their own
 * try/catch and auth.
 *
 * WHY a separate file from blessingBoxes.ts rather than folding in: photos
 * have their own moderation lifecycle (pending/approved/rejected/flagged)
 * independent of a box's live status/check-in state, their own R2 side
 * (never a D1 concern for check-ins), and their own admin review queue —
 * enough surface area to justify a dedicated module, same reasoning
 * blessingBoxes.ts's own header gives for staying out of publishVenues.ts.
 * blessingBoxes.ts imports the one function it needs from here
 * (loadLatestApprovedPhotosForVenues) to populate PublicBlessingBox.box.
 * latestPhoto — never the reverse, so there's no import cycle.
 */

// ─── D1 row shapes ──────────────────────────────────────────────────────────

/** Mirrors migrations/0009_box_photos.sql's `box_photos` table exactly. */
export interface BoxPhotoRow {
  id: number;
  venue_id: string;
  checkin_id: number | null;
  r2_key: string;
  status: "pending" | "approved" | "rejected" | "flagged";
  width: number;
  height: number;
  bytes: number;
  flag_count: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
}

/** What a PublicBlessingBox's `box.latestPhoto` field (and the history page's photo grid) carry — id + timestamp only. The image itself is fetched separately via GET /api/public/box-photos/[id], same "small public shape, big payload lives behind its own request" split the public app already uses for everything else. */
export interface PublicBoxPhoto {
  id: number;
  createdAt: string;
}

/** One row for the admin review queue (`/admin/box-photos`) — everything an admin needs to decide, joined once rather than N+1. */
export interface AdminBoxPhotoRow {
  id: number;
  venue_id: string;
  venue_name: string;
  checkin_id: number | null;
  checkin_kind: string | null;
  status: BoxPhotoRow["status"];
  flag_count: number;
  created_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Max size of an uploaded photo AFTER client-side shrinking, enforced again server-side — never trust the client alone (same posture as every other upload guard in this app). */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** How many approved photos the history page's grid shows before a "more" button — task's own suggested cap, cheap either way at Pueblo's real photo volume. */
export const MAX_HISTORY_PHOTOS = 24;

// ─── SQL ────────────────────────────────────────────────────────────────────

/**
 * One APPROVED photo per venue — the MOST RECENT one — for N venues in a
 * single query, not N+1 (same "batched IN(...) query" convention
 * blessingBoxes.ts's loadVisibleCheckinsForVenues already established for
 * check-ins). ROW_NUMBER() OVER (PARTITION BY venue_id ...) picks exactly
 * one row per venue; `id DESC` breaks a same-millisecond tie deterministically,
 * same reasoning box_checkins' own queries use `created_at DESC, id DESC`.
 *
 * ponytail: this shares the check-ins IN(...) helper's same ~100-bound-param
 * SQLite/D1 ceiling (AGENTS.md's D1 notes) — fine at Pueblo's real box count,
 * not revisited here.
 */
function selectLatestApprovedPhotosForVenuesSql(count: number): string {
  const placeholders = Array(count).fill("?").join(", ");
  return `
    SELECT id, venue_id, created_at FROM (
      SELECT id, venue_id, created_at,
             ROW_NUMBER() OVER (PARTITION BY venue_id ORDER BY created_at DESC, id DESC) AS rn
      FROM box_photos
      WHERE status = 'approved' AND venue_id IN (${placeholders})
    )
    WHERE rn = 1
  `;
}

const SELECT_APPROVED_PHOTOS_FOR_VENUE_SQL = `
  SELECT id, created_at
  FROM box_photos
  WHERE venue_id = ? AND status = 'approved'
  ORDER BY created_at DESC, id DESC
  LIMIT ?
`;

const SELECT_BOX_PHOTO_BY_ID_SQL = "SELECT * FROM box_photos WHERE id = ?";

const SELECT_APPROVED_PHOTO_BY_ID_SQL = "SELECT * FROM box_photos WHERE id = ? AND status = 'approved'";

const SELECT_REVIEW_QUEUE_SQL = `
  SELECT p.id, p.venue_id, v.name AS venue_name, p.checkin_id, c.kind AS checkin_kind,
         p.status, p.flag_count, p.created_at
  FROM box_photos p
  JOIN venues v ON v.id = p.venue_id
  LEFT JOIN box_checkins c ON c.id = p.checkin_id
  WHERE p.status IN ('pending', 'flagged')
  ORDER BY p.created_at DESC
`;

const INSERT_PENDING_PHOTO_SQL = `
  INSERT INTO box_photos (venue_id, checkin_id, r2_key, width, height, bytes)
  VALUES (?, ?, ?, ?, ?, ?)
`;

// ─── D1 reads/writes ────────────────────────────────────────────────────────
// Every function takes a D1Database directly (never getCloudflareContext
// itself) — same convention blessingBoxes.ts's own "D1 reads" section
// documents: every caller owns its own try/catch and degrade-on-failure
// posture, since what counts as "acceptable to fail open on" differs by
// call site (a public list read degrades to null; an admin queue read is
// allowed to throw and 500, same as any other admin page).

interface LatestPhotoRow {
  id: number;
  venue_id: string;
  created_at: string;
}

/** Batched "most recent approved photo per box" for the public list endpoint — one query for every box, not N+1. Empty input returns an empty map without touching D1. */
export async function loadLatestApprovedPhotosForVenues(
  db: D1Database,
  venueIds: string[],
): Promise<Map<string, PublicBoxPhoto>> {
  const byVenue = new Map<string, PublicBoxPhoto>();
  if (venueIds.length === 0) return byVenue;

  const result = await db
    .prepare(selectLatestApprovedPhotosForVenuesSql(venueIds.length))
    .bind(...venueIds)
    .all<LatestPhotoRow>();

  for (const row of result.results ?? []) {
    byVenue.set(row.venue_id, { id: row.id, createdAt: row.created_at });
  }
  return byVenue;
}

/** Every APPROVED photo for one box, newest first, capped — feeds /box/<id>/history's "Photos" section. */
export async function loadApprovedPhotosForVenue(
  db: D1Database,
  venueId: string,
  limit: number = MAX_HISTORY_PHOTOS,
): Promise<PublicBoxPhoto[]> {
  const result = await db
    .prepare(SELECT_APPROVED_PHOTOS_FOR_VENUE_SQL)
    .bind(venueId, limit)
    .all<{ id: number; created_at: string }>();
  return (result.results ?? []).map((row) => ({ id: row.id, createdAt: row.created_at }));
}

/** Full row by id, ANY status — used by the admin preview route (which needs to show a pending/flagged photo too) and the approve/reject/flag routes (which need the row to check/flip). Null if the id doesn't exist. */
export async function loadBoxPhotoById(db: D1Database, id: number): Promise<BoxPhotoRow | null> {
  return db.prepare(SELECT_BOX_PHOTO_BY_ID_SQL).bind(id).first<BoxPhotoRow>();
}

/** Full row by id, APPROVED ONLY — what the public serve route uses, so an unapproved photo's bytes are never even fetched from R2 (same "never even reach the private thing" structural guarantee blessingBoxes.ts's host_contact/problem-report filters already establish). */
export async function loadApprovedBoxPhotoById(db: D1Database, id: number): Promise<BoxPhotoRow | null> {
  return db.prepare(SELECT_APPROVED_PHOTO_BY_ID_SQL).bind(id).first<BoxPhotoRow>();
}

/** Every pending/flagged photo, newest first, joined with its box name and (if attached) the check-in's kind — the admin review queue's one query. */
export async function loadReviewQueue(db: D1Database): Promise<AdminBoxPhotoRow[]> {
  const result = await db.prepare(SELECT_REVIEW_QUEUE_SQL).all<AdminBoxPhotoRow>();
  return result.results ?? [];
}

/** How many photos are currently awaiting a decision — the admin header's cheap nav-badge count (COUNT only, no row data). */
export async function countPendingReview(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM box_photos WHERE status IN ('pending', 'flagged')")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export interface NewPhotoInput {
  venueId: string;
  checkinId: number | null;
  r2Key: string;
  width: number;
  height: number;
  bytes: number;
}

/** Inserts one new photo row, status='pending' (the column DEFAULT), and returns its new id — D1's `meta.last_row_id` on a successful INSERT into an INTEGER PRIMARY KEY AUTOINCREMENT column. */
export async function insertPendingPhoto(db: D1Database, input: NewPhotoInput): Promise<number> {
  const result = await db
    .prepare(INSERT_PENDING_PHOTO_SQL)
    .bind(input.venueId, input.checkinId, input.r2Key, input.width, input.height, input.bytes)
    .run();
  const id = result.meta?.last_row_id;
  if (typeof id !== "number") {
    throw new Error("box_photos insert did not return a last_row_id");
  }
  return id;
}
