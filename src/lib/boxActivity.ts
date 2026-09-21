/**
 * boxActivity.ts — the combined public activity feed for /boxes/activity
 * (Blessing Boxes slice 3, Discovery stories D1-D3): a single, newest-first
 * list mixing public check-ins (filled/took/low/empty — never 'problem',
 * same filter blessingBoxes.ts's own SELECT_VISIBLE_CHECKINS_SQL already
 * applies) with box lifecycle events (box_events, migrations/0008).
 *
 * WHY a UNION ALL over two SELECTs rather than reading each table
 * separately and merging in JS: D1 is real SQLite, which supports UNION ALL
 * natively — pushing the merge, filter, and ORDER BY/LIMIT/OFFSET down to
 * the database means this endpoint never has to load more rows than one
 * page needs, unlike a JS-side merge that would have to over-fetch both
 * tables and sort in memory. Same "let the database do it" instinct as
 * every other paginated query in this repo.
 *
 * WHY both halves JOIN venues on `category = 'blessing_box' AND status !=
 * 'archived'`, not just `v.id = <table>.venue_id`: this is a LIVE current-
 * state gate, not a historical one — a venue that has since been archived,
 * or edited away from the blessing_box category, drops OUT of this feed
 * entirely, including its past check-ins and events. This mirrors
 * SELECT_LIVE_BOXES_SQL's own filter (blessingBoxes.ts) and is the same
 * reasoning boxEvents.ts's header gives for why archiving writes no event
 * in the first place: an activity log for a box that no longer exists as a
 * public box isn't useful, and the alternative (showing history for a box
 * you can no longer click through to) would be actively confusing.
 *
 * WHY row_id (the source table's own autoincrement id) is only a
 * meaningful tiebreaker WITHIN one table: box_checkins.id and box_events.id
 * are two independent autoincrement sequences, so "checkin #5 vs event #5"
 * carries no real ordering meaning across tables — `source` (a literal
 * 'checkin'/'event' string) is included ahead of row_id in the ORDER BY
 * purely to make the merge deterministic (same row set -> same order,
 * every time), not because 'checkin' sorting after 'event' means anything.
 *
 * ponytail: date-range filtering treats `from`/`to` as UTC calendar days
 * (`${date}T00:00:00.000Z` .. next day), not Pueblo's Mountain Time day —
 * a filter for "today" can be off by up to 7 hours at the edges. Good
 * enough for a "browse recent activity" filter; the upgrade path is
 * threading a real timezone offset through if this ever needs to be exact.
 *
 * #511 — the per-box history page (/box/<id>/history) adds two more kinds
 * to this same UNION: an approved photo ("Photo added") and an approved
 * sponsor ("<name> became a sponsor", dated by box_adopters.reviewed_at —
 * when the sponsorship was APPROVED, not when the application was filed).
 * Both require TWO things to be true at once — `filters.includeBoxExtras`
 * AND `filters.venueId` (buildActivityQuery's own gate) — neither flag
 * alone is enough:
 *   - `includeBoxExtras` is DELIBERATELY NOT derived from `venueId`: the
 *     global /boxes/activity feed also lets a visitor filter down to one
 *     box via its own dropdown (BoxesActivityContent.tsx), and issue
 *     #511's own risk note requires these two kinds to appear on the
 *     dedicated per-box history page ONLY. Only BoxHistoryContent.tsx ever
 *     sets this flag.
 *   - `venueId` is REQUIRED alongside it (reviewer fix, PR #521) — without
 *     this, `includeBoxExtras=true` with no box filter would let any
 *     caller pull the network's ENTIRE photo/sponsor history in a single
 *     request. The approved-only status checks below gate WHICH rows are
 *     visible; this second gate is what stops HOW MANY boxes' worth of
 *     rows one request can return.
 * Neither half joins the pending/rejected/flagged rows of its table
 * (box_photos.status, box_adopters.status) — same "approved-only, never
 * even queried otherwise" posture every other public read of these two
 * tables already uses (boxPhotos.ts's loadApprovedPhotosForVenue,
 * boxAdopters.ts's loadApprovedAdopterNamesForVenues) — and the sponsor
 * half selects only `display_name`, never `email`, mirroring that same
 * file's PRIVATE-column rule.
 *
 * ponytail: neither new half applies `filters.kind` — no caller ever
 * combines `includeBoxExtras` with a kind filter today (BoxHistoryContent
 * has no kind selector), so there's nothing to test against. If a future
 * caller ever does, the upgrade path is the same 1=0-on-mismatch guard
 * buildCheckinHalf/buildEventHalf already use.
 */

import { BOX_EVENT_KINDS, type BoxEventKind } from "@/lib/boxEvents";
import type { CheckinKind } from "@/lib/blessingBoxes";

/** The kinds a checkin half of the union can ever produce — 'problem' is structurally excluded (see SELECT below), so it's not part of this feed's own vocabulary. */
const CHECKIN_ACTIVITY_KINDS: readonly Exclude<CheckinKind, "problem">[] = ["filled", "took", "low", "empty"];

/** The full set of kind values /boxes/activity's filter can validly select — checkin kinds plus box lifecycle kinds, matching this endpoint's own combined vocabulary (not CheckinKind's, which still includes 'problem'). */
export type ActivityKind = Exclude<CheckinKind, "problem"> | BoxEventKind;
export const ACTIVITY_KINDS: readonly ActivityKind[] = [...CHECKIN_ACTIVITY_KINDS, ...BOX_EVENT_KINDS];

/**
 * The two #511 per-box-only kinds — deliberately NOT folded into
 * ActivityKind/ACTIVITY_KINDS above: that array backs the global feed's
 * "Kind" filter <option> list (BoxesActivityContent.tsx), and these two
 * kinds only ever appear when `includeBoxExtras` is set (this file's own
 * header), so listing them there would offer a filter option that always
 * returns nothing on the global feed.
 */
export type PerBoxActivityKind = "photo_added" | "sponsor_added";

const CHECKIN_KIND_SET: ReadonlySet<string> = new Set(CHECKIN_ACTIVITY_KINDS);
const EVENT_KIND_SET: ReadonlySet<string> = new Set(BOX_EVENT_KINDS);

export interface ActivityItem {
  source: "checkin" | "event" | "photo" | "sponsor";
  kind: ActivityKind | PerBoxActivityKind;
  /** Set for a lifecycle event (e.g. an address's old -> new value) and for a sponsor entry (the approved display name) — always null for a check-in or a photo, neither of which carries a public note. */
  detail: string | null;
  /** Only ever set for a 'photo' source row — the box_photos.id to build `/api/public/box-photos/<id>` and open the same PhotoViewer (#508) the card uses. Null for every other source. */
  photoId: number | null;
  createdAt: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
}

export interface ActivityFilters {
  venueId?: string;
  /** Raw, unvalidated kind string from a query param — validated against ACTIVITY_KINDS below; an unrecognized value matches nothing in either half (see buildCheckinHalf/buildEventHalf), rather than a 400. */
  kind?: string;
  /** 'YYYY-MM-DD', inclusive start of that UTC calendar day. Malformed values are ignored (treated as absent), never rejected — see this file's header. */
  from?: string;
  /** 'YYYY-MM-DD', inclusive through the end of that UTC calendar day. */
  to?: string;
  /** 1-based page number, clamped by clampPage(). */
  page?: number;
  /** Items per page, clamped by clampPageSize() — lets the D3 per-box embed request a smaller page (e.g. 5) than the global feed's default. */
  pageSize?: number;
  /** #511 — adds the approved-photo and approved-sponsor halves to the UNION, but ONLY when `venueId` is also set (buildActivityQuery's own gate — reviewer fix, PR #521: without a box filter, this alone would pull the network's entire photo/sponsor history). Set ONLY by BoxHistoryContent.tsx's per-box history page; see this file's own header for why it's a dedicated flag rather than inferred from `venueId`. */
  includeBoxExtras?: boolean;
}

export interface ActivityPage {
  items: ActivityItem[];
  hasMore: boolean;
  page: number;
}

export const ACTIVITY_PAGE_SIZE_DEFAULT = 25;
const ACTIVITY_PAGE_SIZE_MAX = 100;
const ACTIVITY_PAGE_MAX = 200; // bounds OFFSET's growth on a very long history — see clampPage's own comment

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function clampPage(page: number | undefined): number {
  if (!Number.isFinite(page) || !page || page < 1) return 1;
  return Math.min(Math.floor(page as number), ACTIVITY_PAGE_MAX);
}

export function clampPageSize(size: number | undefined): number {
  if (!Number.isFinite(size) || !size || (size as number) < 1) return ACTIVITY_PAGE_SIZE_DEFAULT;
  return Math.min(Math.floor(size as number), ACTIVITY_PAGE_SIZE_MAX);
}

/** 'YYYY-MM-DD' -> the ISO instant one UTC day later, for an exclusive upper bound (`created_at < nextDayIso(to)`) that still reads as "through the end of `to`". Malformed input returns null so callers can drop the filter instead of crashing on an invalid Date. */
function nextDayUtcIso(dateStr: string): string | null {
  if (!DATE_RE.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function startOfDayUtcIso(dateStr: string): string | null {
  if (!DATE_RE.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface HalfQuery {
  sql: string;
  params: unknown[];
}

const VENUE_JOIN = "JOIN venues v ON v.id = t.venue_id AND v.category = 'blessing_box' AND v.status != 'archived'";

/**
 * Every visible, non-problem check-in, joined to its (still-live) box.
 * WHY `kind` is bound via a fresh comparison per call rather than reusing a
 * shared IN(...) list: only one kind filter is ever active at a time (the
 * UI offers a single kind dropdown, not multi-select) — see route.ts's own
 * query-param parsing.
 */
function buildCheckinHalf(filters: ActivityFilters): HalfQuery {
  const clauses = ["t.visibility = 'visible'", "t.kind != 'problem'"];
  const params: unknown[] = [];
  if (filters.venueId) {
    clauses.push("t.venue_id = ?");
    params.push(filters.venueId);
  }
  if (filters.kind) {
    if (CHECKIN_KIND_SET.has(filters.kind)) {
      clauses.push("t.kind = ?");
      params.push(filters.kind);
    } else {
      // An event-only or unrecognized kind can never match a check-in row —
      // 1=0 makes that explicit and keeps this half's bind-param count
      // identical regardless of which branch fires (no venueId/kind param
      // silently omitted from the middle of the list).
      clauses.push("1 = 0");
    }
  }
  const fromIso = filters.from ? startOfDayUtcIso(filters.from) : null;
  if (fromIso) {
    clauses.push("t.created_at >= ?");
    params.push(fromIso);
  }
  const toIso = filters.to ? nextDayUtcIso(filters.to) : null;
  if (toIso) {
    clauses.push("t.created_at < ?");
    params.push(toIso);
  }
  const sql = `SELECT t.venue_id AS venue_id, v.name AS venue_name, v.address AS venue_address,
    'checkin' AS source, t.kind AS kind, NULL AS detail, NULL AS photo_id, t.created_at AS created_at, t.id AS row_id
    FROM box_checkins t
    ${VENUE_JOIN}
    WHERE ${clauses.join(" AND ")}`;
  return { sql, params };
}

/** Every box_events row, joined to its (still-live) box. Structurally mirrors buildCheckinHalf — same filter shape, same 1=0 fallback for an unrecognized kind, same date-range handling. */
function buildEventHalf(filters: ActivityFilters): HalfQuery {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.venueId) {
    clauses.push("t.venue_id = ?");
    params.push(filters.venueId);
  }
  if (filters.kind) {
    if (EVENT_KIND_SET.has(filters.kind)) {
      clauses.push("t.kind = ?");
      params.push(filters.kind);
    } else {
      clauses.push("1 = 0");
    }
  }
  const fromIso = filters.from ? startOfDayUtcIso(filters.from) : null;
  if (fromIso) {
    clauses.push("t.created_at >= ?");
    params.push(fromIso);
  }
  const toIso = filters.to ? nextDayUtcIso(filters.to) : null;
  if (toIso) {
    clauses.push("t.created_at < ?");
    params.push(toIso);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT t.venue_id AS venue_id, v.name AS venue_name, v.address AS venue_address,
    'event' AS source, t.kind AS kind, t.detail AS detail, NULL AS photo_id, t.created_at AS created_at, t.id AS row_id
    FROM box_events t
    ${VENUE_JOIN}
    ${where}`;
  return { sql, params };
}

/**
 * Every APPROVED photo, joined to its (still-live) box — #511. Mirrors
 * buildCheckinHalf/buildEventHalf's shape (venueId + date-range clauses),
 * minus a `kind` clause: see this file's header for why. `t.status =
 * 'approved'` is the structural privacy guarantee — a pending/rejected/
 * flagged photo is never even read here, let alone shown.
 */
function buildPhotoHalf(filters: ActivityFilters): HalfQuery {
  const clauses = ["t.status = 'approved'"];
  const params: unknown[] = [];
  if (filters.venueId) {
    clauses.push("t.venue_id = ?");
    params.push(filters.venueId);
  }
  const fromIso = filters.from ? startOfDayUtcIso(filters.from) : null;
  if (fromIso) {
    clauses.push("t.created_at >= ?");
    params.push(fromIso);
  }
  const toIso = filters.to ? nextDayUtcIso(filters.to) : null;
  if (toIso) {
    clauses.push("t.created_at < ?");
    params.push(toIso);
  }
  const sql = `SELECT t.venue_id AS venue_id, v.name AS venue_name, v.address AS venue_address,
    'photo' AS source, 'photo_added' AS kind, NULL AS detail, t.id AS photo_id, t.created_at AS created_at, t.id AS row_id
    FROM box_photos t
    ${VENUE_JOIN}
    WHERE ${clauses.join(" AND ")}`;
  return { sql, params };
}

/**
 * Every APPROVED sponsor, joined to its (still-live) box — #511. `detail`
 * carries `display_name` (the only public column this table has, per
 * boxAdopters.ts's own header) — NEVER `email`. `created_at` here is bound
 * to `t.reviewed_at`, not `t.created_at` — the log entry is dated by when
 * the sponsorship was APPROVED, matching issue #511's own spec, not when
 * the application was originally filed. `t.reviewed_at IS NOT NULL` is
 * belt-and-suspenders: the admin approve route sets `status='approved'` and
 * `reviewed_at` in the same UPDATE (src/app/api/admin/box-adopters/[id]/
 * approve/route.ts), so the two are never out of sync in practice, but a
 * NULL `created_at` sorting into this UNION would be a worse failure mode
 * than just excluding the row.
 */
function buildSponsorHalf(filters: ActivityFilters): HalfQuery {
  const clauses = ["t.status = 'approved'", "t.reviewed_at IS NOT NULL"];
  const params: unknown[] = [];
  if (filters.venueId) {
    clauses.push("t.venue_id = ?");
    params.push(filters.venueId);
  }
  const fromIso = filters.from ? startOfDayUtcIso(filters.from) : null;
  if (fromIso) {
    clauses.push("t.reviewed_at >= ?");
    params.push(fromIso);
  }
  const toIso = filters.to ? nextDayUtcIso(filters.to) : null;
  if (toIso) {
    clauses.push("t.reviewed_at < ?");
    params.push(toIso);
  }
  const sql = `SELECT t.venue_id AS venue_id, v.name AS venue_name, v.address AS venue_address,
    'sponsor' AS source, 'sponsor_added' AS kind, t.display_name AS detail, NULL AS photo_id, t.reviewed_at AS created_at, t.id AS row_id
    FROM box_adopters t
    ${VENUE_JOIN}
    WHERE ${clauses.join(" AND ")}`;
  return { sql, params };
}

/**
 * Builds the full paginated UNION ALL query. Deterministic tiebreaker per
 * this slice's own cross-cutting rule: `ORDER BY created_at DESC, source
 * DESC, row_id DESC` (see this file's header for why `source` sits ahead of
 * `row_id` — it's about determinism, not meaning). Fetches `pageSize + 1`
 * rows so loadBoxActivity can compute `hasMore` without a second COUNT(*)
 * query.
 *
 * ponytail: pagination is plain OFFSET, on a table that receives new rows
 * constantly — a row inserted between two page loads can shift every row
 * after it by one, so a visitor paging forward can see a row repeat or
 * silently skip one at the page boundary. Fine at this feature's real
 * volume (a handful of check-ins/events per box per day); the upgrade path
 * is a cursor on `created_at` (keyset pagination) instead of OFFSET, if
 * this table's write rate ever makes the boundary drift noticeable.
 */
export function buildActivityQuery(filters: ActivityFilters): { sql: string; params: unknown[] } {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;

  // #511 — the photo/sponsor halves only join in when explicitly asked for
  // (see ActivityFilters.includeBoxExtras's own header) AND scoped to one
  // box (`venueId`) — reviewer fix (PR #521): `includeBoxExtras` alone,
  // with no `venueId`, would let any caller pull the network's ENTIRE
  // photo/sponsor history in one request. The approved-only filters inside
  // buildPhotoHalf/buildSponsorHalf gate WHICH rows are visible, not HOW
  // MANY boxes' worth a single request can return — that second gate lives
  // here. This feature's only real caller (BoxHistoryContent) always sets
  // both together, so this costs it nothing.
  const halves: HalfQuery[] = [buildCheckinHalf(filters), buildEventHalf(filters)];
  if (filters.includeBoxExtras && filters.venueId) {
    halves.push(buildPhotoHalf(filters), buildSponsorHalf(filters));
  }

  const sql = `SELECT * FROM (
    ${halves.map((h) => h.sql).join("\n    UNION ALL\n    ")}
  )
  ORDER BY created_at DESC, source DESC, row_id DESC
  LIMIT ? OFFSET ?`;

  return { sql, params: [...halves.flatMap((h) => h.params), pageSize + 1, offset] };
}

interface ActivityRow {
  venue_id: string;
  venue_name: string;
  venue_address: string;
  source: "checkin" | "event" | "photo" | "sponsor";
  kind: ActivityKind | PerBoxActivityKind;
  detail: string | null;
  /** NULL for every half except buildPhotoHalf's — see ActivityItem.photoId's own header. */
  photo_id: number | null;
  created_at: string;
}

function mapRowToItem(row: ActivityRow): ActivityItem {
  return {
    source: row.source,
    kind: row.kind,
    detail: row.detail,
    photoId: row.photo_id,
    createdAt: row.created_at,
    venueId: row.venue_id,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
  };
}

/** Reads one page of the combined feed off D1. Never throws its own errors — a D1 failure propagates to the caller (the public route and BoxContent's activity panel both catch it, matching every other blessing-box read path's best-effort convention). */
export async function loadBoxActivity(db: D1Database, filters: ActivityFilters): Promise<ActivityPage> {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const { sql, params } = buildActivityQuery(filters);
  const result = await db.prepare(sql).bind(...params).all<ActivityRow>();
  const rows = result.results ?? [];
  const hasMore = rows.length > pageSize;
  return { items: rows.slice(0, pageSize).map(mapRowToItem), hasMore, page };
}
