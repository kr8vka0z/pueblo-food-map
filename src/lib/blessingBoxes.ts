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
import { loadLatestApprovedPhotosForVenues, type PublicBoxPhoto } from "@/lib/boxPhotos";
import { loadApprovedAdopterNamesForVenues } from "@/lib/boxAdopters";
import { logBlessingBoxesReadFailure } from "@/lib/logger";

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

// ─── "What would help you next time?" ask (migration 0012) ────────────────
// Nine fixed choices, owner-approved mockup v3 Part 2. This array is the
// SINGLE source of truth for the vocabulary — the needs route validates
// against it, the admin panel labels off it, and BoxCheckinPanel.tsx's own
// chip list order matches it exactly (see that component's own import).

export const NEED_KEYS = [
  "canned_food",
  "fresh_food",
  "bread",
  "baby_items",
  "diapers",
  "hygiene",
  "pet_food",
  "drinks",
  "warm_clothing",
] as const;
export type NeedKey = (typeof NEED_KEYS)[number];
export const NEED_KEY_SET: ReadonlySet<string> = new Set(NEED_KEYS);
/** "max 9" per the task spec — happens to equal NEED_KEYS.length, since every valid key is unique; kept as its own named constant rather than an inline `NEED_KEYS.length` so the needs route's own 400-on-oversized-array check reads as an intentional cap, not a coincidence. */
export const MAX_NEEDS = NEED_KEYS.length;

/**
 * Validates and normalizes a client-submitted `needs` field (the needs
 * route's own request body). `undefined` (field omitted) is valid and
 * normalizes to `[]` — the "typed text only, no chips" case. Any other
 * malformed shape (not an array, over MAX_NEEDS entries, a non-string
 * item, or any string not in NEED_KEY_SET) fails closed — the needs route
 * maps a `{ ok: false }` result to its own 400, per the task's own
 * instruction ("unknown keys → 400"). A valid result is deduped (a client
 * sending the same key twice) and returned in NEED_KEYS' own canonical
 * order, not submission order — so the same picks always serialize
 * identically regardless of tap order, which keeps `needs` JSON diffable
 * and keeps computeNeededFromVisitorsMap's aggregation from needing to
 * care about order at all.
 */
export function parseNeedsField(raw: unknown): { ok: true; keys: NeedKey[] } | { ok: false } {
  if (raw === undefined) return { ok: true, keys: [] };
  if (!Array.isArray(raw) || raw.length > MAX_NEEDS) return { ok: false };
  const submitted = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !NEED_KEY_SET.has(item)) return { ok: false };
    submitted.add(item);
  }
  return { ok: true, keys: NEED_KEYS.filter((k) => submitted.has(k)) };
}

/** One box's top-3 aggregated visitor picks — computeNeededFromVisitorsMap's own output shape, and PublicBlessingBox.box.neededFromVisitors' element type. */
export interface NeededFromVisitors {
  key: NeedKey;
  count: number;
}

/** computeNeededFromVisitorsMap's raw input row shape — one (venue, key) pair's aggregate, exactly what SELECT_NEEDED_FROM_VISITORS_SQL's GROUP BY produces (json_each's per-array-item expansion already collapsed by COUNT/MAX in SQL, not in JS — see that query's own comment for why). */
export interface NeedCountRow {
  venue_id: string;
  key: string;
  n: number;
  last_at: string;
}

/** Reviewer fix pass (2026-09-19) — display floor: a need key needs at least this many distinct picks within the 30-day window before "Most needed" will show it at all. One visitor's single pick shouldn't headline a box as its top community-reported need; below this floor, that key is dropped from consideration entirely (not just deprioritized), so a 1-pick key can never occupy a top-3 slot ahead of, or instead of, a key that clears the floor. Upgrade path if this ever needs to be per-box or admin-configurable: thread it through as a parameter here instead of a module constant. */
export const NEEDED_FROM_VISITORS_MIN_COUNT = 2;

/**
 * Groups already-aggregated (venue, key, count, last_at) rows by venue,
 * drops any key that hasn't cleared NEEDED_FROM_VISITORS_MIN_COUNT, ranks
 * what's left by count DESC then last_at DESC (a tie goes to whichever key
 * was picked most recently — "most needed" reads as "still being asked
 * for", not an arbitrary key-name tiebreak), and keeps the top 3. Pure — no
 * D1 — so every branch (ties, an unknown/legacy key filtered out
 * defensively, the display floor, a venue with fewer than 3 qualifying
 * keys) is directly testable with plain fixtures, same convention as
 * computeBoxStatus above.
 */
export function computeNeededFromVisitorsMap(rows: NeedCountRow[]): Map<string, NeededFromVisitors[]> {
  const byVenue = new Map<string, NeedCountRow[]>();
  for (const row of rows) {
    // Defensive: a row whose key isn't (or is no longer) in NEED_KEY_SET —
    // e.g. a future vocabulary change leaving old rows behind — is dropped
    // rather than surfaced as a chip nobody can translate a label for.
    if (!NEED_KEY_SET.has(row.key)) continue;
    if (row.n < NEEDED_FROM_VISITORS_MIN_COUNT) continue;
    const existing = byVenue.get(row.venue_id);
    if (existing) existing.push(row);
    else byVenue.set(row.venue_id, [row]);
  }

  const result = new Map<string, NeededFromVisitors[]>();
  for (const [venueId, venueRows] of byVenue) {
    const ranked = venueRows
      .slice()
      .sort((a, b) => b.n - a.n || (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0))
      .slice(0, 3)
      .map((r) => ({ key: r.key as NeedKey, count: r.n }));
    result.set(venueId, ranked);
  }
  return result;
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
    /** Slice 5 — the most recent APPROVED photo, or null (never uploaded, or nothing approved yet). Null is also what a degraded (D1-failure) photo read returns — see loadLiveBoxes'/loadLiveBoxById's own comment for why a photos-table failure must never take the whole box down the way a checkins-table failure does. */
    latestPhoto: PublicBoxPhoto | null;
    /** Slice 6 — approved adopter display names ONLY, oldest first ("Cared for by A, B" reads as an accumulating roster). Never the adopter's email — see boxAdopters.ts's own header on why that column exists at all and is never selected here. Empty array (never null) when nobody's been approved yet, or on a degraded (D1-failure) read — same best-effort posture as latestPhoto above. */
    adopters: string[];
    /**
     * "What would help you next time?" ask (migration 0012) — the top 3
     * need keys visitors have picked at this box in the last 30 days, most-
     * picked first. Populated (never null, defaults to []) by every real
     * loader (loadLiveBoxes/loadLiveBoxById), including on a degraded
     * D1-failure read — same best-effort posture as latestPhoto/adopters
     * above. Optional here (not `: NeededFromVisitors[]`) only so existing
     * hand-written PublicBlessingBox test fixtures across this repo that
     * predate migration 0012 keep compiling without every one of them
     * being touched — every real reader treats a missing value as `[]` via
     * `?? []`. The CALLER decides display precedence, not this shape: an
     * admin-typed `mostNeeded` wins when set (see BoxCardBody.tsx), this
     * field is what fills in when it isn't.
     */
    neededFromVisitors?: NeededFromVisitors[];
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
  latestPhoto: PublicBoxPhoto | null = null,
  adopters: string[] = [],
  neededFromVisitors: NeededFromVisitors[] = [],
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
      latestPhoto,
      adopters,
      neededFromVisitors,
    },
  };
}

export function mapRowsToPublicBoxes(rows: BoxJoinRow[]): PublicBlessingBox[] {
  return rows.map((row) => mapRowToPublicBox(row));
}

/**
 * Type guard for the merged venue list. Map-first rework (2026-09-18): a
 * box click now opens the SAME in-map card every other venue uses
 * (BottomSheet/DesktopVenueWindow), just with box-specific content
 * (BoxCardBody) instead of routing to a separate page — this guard is what
 * those components use (`venue.category === "blessing_box"` inline, or via
 * this function) to pick which body to render, and what MapWrapper uses to
 * look up the matching PublicBlessingBox record for the card.
 */
export function isBlessingBox(category: VenueCategory): category is "blessing_box" {
  return category === "blessing_box";
}

// ─── Shared UI constant (slice 2, relocated here slice 4) ──────────────────
// Moved out of BoxContent.tsx so /boxes' row list (slice 4) can share it
// instead of a second copy drifting out of sync with the detail page's
// badge. Plain Tailwind class strings, no JSX/framework import — still
// fits this file's own "pure" convention (see header), same as i18n.ts
// living in lib/ with no React import either.
/** Semantic-token color pairing per status — success/warning/danger are DESIGN.md's general status tokens, not admin-only (see AGENTS.md's own note on --color-danger, which is about ONE admin button's rationale, not a restriction on this token's normal error/status use elsewhere). Unknown/out_of_service intentionally reuse the same muted neutral treatment slice 1 already used for the placeholder — neither is an alarming state. */
export const STATUS_BADGE_CLASS: Record<BoxStatus, string> = {
  stocked: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  low: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  empty: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  unknown: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
  out_of_service: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
};

/** Card-redesign (2026-09-19) — the small solid dot on the status pill/check-in buttons. Same semantic-token pairing as STATUS_BADGE_CLASS above, just a solid fill instead of a 10%-tint background. */
export const STATUS_DOT_CLASS: Record<BoxStatus, string> = {
  stocked: "bg-[var(--color-success)]",
  low: "bg-[var(--color-warning)]",
  empty: "bg-[var(--color-danger)]",
  unknown: "bg-[var(--color-ink-400)]",
  out_of_service: "bg-[var(--color-ink-400)]",
};

/** Card-redesign (2026-09-19) — the status WORD's own text color on the photo pill (mockup v3: the word itself carries the status color; the "· filled {time}" detail segment stays neutral ink-500, set directly in BoxCardBody). Same pairing as STATUS_DOT_CLASS, just a text-color utility instead of a background one — kept as its own map rather than derived at render time so both are equally greppable/token-checkable. */
export const STATUS_TEXT_CLASS: Record<BoxStatus, string> = {
  stocked: "text-[var(--color-success)]",
  low: "text-[var(--color-warning)]",
  empty: "text-[var(--color-danger)]",
  unknown: "text-[var(--color-ink-400)]",
  out_of_service: "text-[var(--color-ink-400)]",
};

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
  /** Raw JSON array text from the needs ask (migration 0012), or null if never asked/skipped — see parseAdminNeeds() below for the parsed form BoxCheckinsAdminPanel.tsx actually renders. Optional (not `: string | null`) so existing hand-written AdminCheckinRow test fixtures that predate 0012 keep compiling — parseAdminNeeds(undefined-as-any) is never called directly; callers read `row.needs ?? null`. */
  needs?: string | null;
}

const SELECT_ALL_CHECKINS_FOR_VENUE_SQL = `
  SELECT id, venue_id, kind, note, visibility, hidden_by, hidden_at, created_at, needs
  FROM box_checkins
  WHERE venue_id = ?
  ORDER BY created_at DESC, id DESC
`;

/** Every check-in for ONE box — visible + hidden, including 'problem' — newest first. Feeds BoxCheckinsAdminPanel via the venue edit page's resolveBoxCheckins(). */
export async function loadAllCheckinsForBox(db: D1Database, venueId: string): Promise<AdminCheckinRow[]> {
  const result = await db.prepare(SELECT_ALL_CHECKINS_FOR_VENUE_SQL).bind(venueId).all<AdminCheckinRow>();
  return result.results ?? [];
}

/** Parses an AdminCheckinRow's raw `needs` JSON text into a display-ready NeedKey[] — defensive against malformed/legacy JSON (never thrown from the admin render path over one bad row). Filters to known keys only, same defensive posture as computeNeededFromVisitorsMap above. Accepts undefined (as well as null) since AdminCheckinRow.needs is itself optional (see that field's own comment). */
export function parseAdminNeeds(raw: string | null | undefined): NeedKey[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is NeedKey => typeof v === "string" && NEED_KEY_SET.has(v));
  } catch {
    return [];
  }
}

// ─── Needs aggregation (migration 0012) ────────────────────────────────────
// json_each is SQLite's json1 table-valued function (D1 is SQLite, and json1
// ships enabled by default) — expanding `needs`'s JSON array in SQL means
// this never needs an IN(...) placeholder list (unlike
// selectVisibleCheckinsForVenuesSql above), so D1's 100-bound-parameter cap
// is never in play regardless of how many boxes exist: the all-boxes query
// below takes exactly one bind param (the 30-day cutoff).

/** Visitor picks fade out of "most needed" after 30 days — same order-of-magnitude freshness window as the rest of this feature's own design discussion (mirrors the task's own "over the last 30 days" instruction, not derived from any other constant in this file). */
export const NEEDED_FROM_VISITORS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Reviewer fix pass (2026-09-19) — json_each(c.needs) throws a SQL error if
// c.needs is ever non-NULL but not valid JSON (this app's own write path,
// the needs route, always writes a clean JSON.stringify'd array or NULL, so
// this shouldn't happen in practice — but a direct D1 edit, a future write
// path, or row corruption would otherwise take down the WHOLE aggregation
// query for every box at once, not just the one bad row, since json_each is
// evaluated per-row inside the join). The CASE falls back to an empty JSON
// array for a malformed value, which json_each expands to zero rows —
// exactly as if that one check-in had no needs at all.
// Exported (unlike SELECT_VISIBLE_CHECKINS_SQL/SELECT_ALL_CHECKINS_FOR_VENUE_SQL
// above) so blessingBoxes.test.ts can run the ACTUAL query text against a
// real better-sqlite3 engine — the fake-D1 mocks everywhere else in that
// file discriminate on SQL substrings and can't catch a real syntax error
// or a wrong column in a query this shaped (json_each + a CASE guard).
export const SELECT_NEEDED_FROM_VISITORS_SQL = `
  SELECT c.venue_id AS venue_id, j.value AS key, COUNT(*) AS n, MAX(c.created_at) AS last_at
  FROM box_checkins c, json_each(CASE WHEN json_valid(c.needs) THEN c.needs ELSE '[]' END) j
  WHERE c.kind = 'took' AND c.visibility = 'visible' AND c.needs IS NOT NULL
    AND c.created_at >= ?
  GROUP BY c.venue_id, j.value
`;

export const SELECT_NEEDED_FROM_VISITORS_FOR_VENUE_SQL = `
  SELECT c.venue_id AS venue_id, j.value AS key, COUNT(*) AS n, MAX(c.created_at) AS last_at
  FROM box_checkins c, json_each(CASE WHEN json_valid(c.needs) THEN c.needs ELSE '[]' END) j
  WHERE c.kind = 'took' AND c.visibility = 'visible' AND c.needs IS NOT NULL
    AND c.created_at >= ? AND c.venue_id = ?
  GROUP BY c.venue_id, j.value
`;

/** Best-effort, every box at once — feeds loadLiveBoxes. Same "degrade to empty, never take the box list down" posture as loadLatestPhotosBestEffort/loadAdoptersBestEffort below (a promotion landing before migration 0012, or any other read failure, must not re-create slice 2's "every pin disappears" outage for a purely additive display field). */
async function loadNeededFromVisitorsBestEffort(
  db: D1Database,
  now: Date,
): Promise<Map<string, NeededFromVisitors[]>> {
  try {
    const cutoff = new Date(now.getTime() - NEEDED_FROM_VISITORS_WINDOW_MS).toISOString();
    const result = await db.prepare(SELECT_NEEDED_FROM_VISITORS_SQL).bind(cutoff).all<NeedCountRow>();
    return computeNeededFromVisitorsMap(result.results ?? []);
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (needs aggregation read)");
    return new Map();
  }
}

/** Same as loadNeededFromVisitorsBestEffort, scoped to ONE venue — feeds loadLiveBoxById. */
async function loadNeededFromVisitorsForVenueBestEffort(
  db: D1Database,
  venueId: string,
  now: Date,
): Promise<NeededFromVisitors[]> {
  try {
    const cutoff = new Date(now.getTime() - NEEDED_FROM_VISITORS_WINDOW_MS).toISOString();
    const result = await db
      .prepare(SELECT_NEEDED_FROM_VISITORS_FOR_VENUE_SQL)
      .bind(cutoff, venueId)
      .all<NeedCountRow>();
    return computeNeededFromVisitorsMap(result.results ?? []).get(venueId) ?? [];
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (needs aggregation read)");
    return [];
  }
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

/**
 * Best-effort latest-photo lookup for one or many venues — unlike
 * loadVisibleCheckins(Forvenues) above, this is wrapped HERE rather than
 * left to the caller: a missing/broken box_photos table (e.g. a promotion
 * landing before migration 0009, mirroring the exact 0007 outage this
 * file's own history documents) must degrade to "no photo shown," not take
 * down the whole box list/detail the way a checkins failure structurally
 * does (loadVisibleCheckins has no try/catch of its own and is allowed to
 * propagate). Photos are a purely additive display feature layered on top
 * of an already-working box — there's no reason a photos-table outage
 * should re-create slice 2's "every pin disappears" failure mode.
 */
async function loadLatestPhotosBestEffort(db: D1Database, venueIds: string[]): Promise<Map<string, PublicBoxPhoto>> {
  try {
    return await loadLatestApprovedPhotosForVenues(db, venueIds);
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (box_photos read)");
    return new Map();
  }
}

/**
 * Best-effort approved-adopter-names lookup, same "degrade to empty, never
 * take the box down" posture as loadLatestPhotosBestEffort above — a
 * missing/broken box_adopters table (e.g. a promotion landing before
 * migration 0010 is applied) must never re-create slice 2's "every pin
 * disappears" outage for a purely additive display field.
 */
async function loadAdoptersBestEffort(db: D1Database, venueIds: string[]): Promise<Map<string, string[]>> {
  try {
    return await loadApprovedAdopterNamesForVenues(db, venueIds);
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (box_adopters read)");
    return new Map();
  }
}

export async function loadLiveBoxes(db: D1Database, now: Date = new Date()): Promise<PublicBlessingBox[]> {
  const result = await db.prepare(SELECT_LIVE_BOXES_SQL).all<BoxJoinRow>();
  const rows = result.results ?? [];
  const venueIds = rows.map((r) => r.id);
  const checkinsByVenue = await loadVisibleCheckinsForVenues(db, venueIds);
  const photosByVenue = await loadLatestPhotosBestEffort(db, venueIds);
  const adoptersByVenue = await loadAdoptersBestEffort(db, venueIds);
  const neededByVenue = await loadNeededFromVisitorsBestEffort(db, now);
  return rows.map((row) =>
    mapRowToPublicBox(
      row,
      checkinsByVenue.get(row.id) ?? [],
      now,
      photosByVenue.get(row.id) ?? null,
      adoptersByVenue.get(row.id) ?? [],
      neededByVenue.get(row.id) ?? [],
    ),
  );
}

// ─── Admin health (Dashboard + Blessing Boxes tab) ─────────────────────────
// Unlike every query above, these read EVERY visible check-in kind,
// including 'problem' — an admin needs to see a problem report to act on
// it; 'problem' being excluded from the public shape is a scope/privacy
// rule for visitors (this file's own header), not a reason to hide "needs
// help" signal from the person who fixes it. Both queries join directly on
// `venues.category = 'blessing_box'` rather than an IN(...) id list (same
// technique SELECT_NEEDED_FROM_VISITORS_SQL above already uses) — a FIXED
// number of bind params regardless of how many boxes exist, so D1's
// 100-bound-param ceiling (src/lib/d1.ts) never comes into play here even
// as the box count grows well past 100.

export interface AdminLatestCheckinRow {
  venue_id: string;
  kind: CheckinKind;
  note: string | null;
  created_at: string;
}

/** One row per box — its single most recent VISIBLE check-in, any kind — the input src/lib/boxHealth.ts's computeBoxHealth needs for every box at once. */
export const SELECT_LATEST_CHECKIN_PER_BOX_SQL = `
  SELECT venue_id, kind, note, created_at FROM (
    SELECT c.venue_id AS venue_id, c.kind AS kind, c.note AS note, c.created_at AS created_at,
           ROW_NUMBER() OVER (PARTITION BY c.venue_id ORDER BY c.created_at DESC, c.id DESC) AS rn
    FROM box_checkins c
    JOIN venues v ON v.id = c.venue_id
    WHERE v.category = 'blessing_box' AND v.status != 'archived' AND c.visibility = 'visible'
  )
  WHERE rn = 1
`;

/** Best-effort — a broken/missing box_checkins table must degrade to "every box unknown," never take down the Dashboard/Boxes tab (same posture loadLatestPhotosBestEffort above already applies to box_photos). */
export async function loadLatestCheckinPerBox(db: D1Database): Promise<Map<string, AdminLatestCheckinRow>> {
  try {
    const result = await db.prepare(SELECT_LATEST_CHECKIN_PER_BOX_SQL).all<AdminLatestCheckinRow>();
    const map = new Map<string, AdminLatestCheckinRow>();
    for (const row of result.results ?? []) map.set(row.venue_id, row);
    return map;
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (admin latest-checkin read)");
    return new Map();
  }
}

export interface AdminRecentCheckinRow {
  venue_id: string;
  kind: CheckinKind;
  created_at: string;
}

/** Every visible check-in across every box, no per-box cap — feeds the Boxes tab's "Box reports, last 8 weeks" chart (src/lib/adminDashboard.ts's bucketCheckinsByWeek). The caller supplies the window's start so this file never has to know how many weeks the chart shows. */
export const SELECT_RECENT_CHECKINS_ALL_BOXES_SQL = `
  SELECT c.venue_id AS venue_id, c.kind AS kind, c.created_at AS created_at
  FROM box_checkins c
  JOIN venues v ON v.id = c.venue_id
  WHERE v.category = 'blessing_box' AND v.status != 'archived' AND c.visibility = 'visible' AND c.created_at >= ?
`;

/** Best-effort, same degrade-to-empty posture as loadLatestCheckinPerBox above. */
export async function loadRecentCheckinsAllBoxes(db: D1Database, sinceIso: string): Promise<AdminRecentCheckinRow[]> {
  try {
    const result = await db.prepare(SELECT_RECENT_CHECKINS_ALL_BOXES_SQL).bind(sinceIso).all<AdminRecentCheckinRow>();
    return result.results ?? [];
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (admin recent-checkins read)");
    return [];
  }
}

export async function loadLiveBoxById(
  db: D1Database,
  id: string,
  now: Date = new Date(),
): Promise<PublicBlessingBox | null> {
  const row = await db.prepare(SELECT_LIVE_BOX_BY_ID_SQL).bind(id).first<BoxJoinRow>();
  if (!row) return null;
  const checkins = await loadVisibleCheckins(db, id);
  const photosByVenue = await loadLatestPhotosBestEffort(db, [id]);
  const adoptersByVenue = await loadAdoptersBestEffort(db, [id]);
  const neededFromVisitors = await loadNeededFromVisitorsForVenueBestEffort(db, id, now);
  return mapRowToPublicBox(
    row,
    checkins,
    now,
    photosByVenue.get(id) ?? null,
    adoptersByVenue.get(id) ?? [],
    neededFromVisitors,
  );
}
