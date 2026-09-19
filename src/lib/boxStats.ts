/**
 * boxStats.ts — Blessing Boxes slice 7 ("Numbers"). Pure aggregation logic
 * over check-ins/photos already collected by slices 1-6, plus the one new
 * D1 read this slice needs (the network-wide raw-data query, below) — no
 * new migration, no new table, no new dependency. Per-box numbers reuse
 * blessingBoxes.ts's existing `loadVisibleCheckins` and boxPhotos.ts's
 * existing `loadApprovedPhotosForVenue` directly (see /box/[id]/history's
 * page.tsx) — this file adds no D1 query for that case at all.
 *
 * WHY the aggregation functions are pure, taking plain arrays rather than a
 * D1Database: same split every other lib file in this feature already uses
 * (blessingBoxes.ts, boxActivity.ts) — testable with fixtures, no fake D1
 * binding required for the logic that actually matters.
 *
 * WHY network totals are NOT simply "the live box list's own checkins":
 * loadLiveBoxes/loadVisibleCheckinsForVenues (blessingBoxes.ts) and
 * loadBoxActivity (boxActivity.ts) both JOIN venues ON status != 'archived'
 * — correct for "what's live on the map right now," wrong for network
 * totals, which must keep counting an archived box's history (task's own
 * rule: archived boxes drop out of the "needs love" ranking, never out of
 * the network sum). loadNetworkStatsData() below is therefore a DELIBERATE,
 * NARROW widening of that JOIN — every other privacy/scope filter this
 * feature enforces (kind != 'problem', category = 'blessing_box') still
 * applies; only the archived-status exclusion is dropped, and only here.
 *
 * WHY pair averages/need-love ranking are always computed over ALL-TIME
 * check-ins, never the period-scoped subset the counts panel uses: a 7-day
 * window rarely contains two of the right kind of check-in to pair up, so
 * period-scoping the averages would mostly render "—". The period picker
 * (PeriodKey below) only ever filters the raw counts (fills/uses/empty/low/
 * totalCheckins/approvedPhotos) and, by extension, the milestone totals —
 * never the pair-average or ranking inputs, which read the box's/network's
 * entire history regardless of which period is selected on screen.
 */

import type { CheckinKind, CheckinStatusInput } from "@/lib/blessingBoxes";

// ─── Period picker ──────────────────────────────────────────────────────────

export type PeriodKey = "7d" | "30d" | "90d" | "all";
export const PERIOD_KEYS: readonly PeriodKey[] = ["7d", "30d", "90d", "all"];
const PERIOD_DAYS: Record<Exclude<PeriodKey, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** The inclusive lower bound (epoch ms) for a period, or null for "all time" (no lower bound at all). */
export function periodStartMs(period: PeriodKey, now: Date): number | null {
  if (period === "all") return null;
  return now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
}

/** Keeps only items whose `created_at` falls within `period`, inclusive of the boundary instant itself. `all` returns every item unfiltered — same object references, no defensive copy needed since callers never mutate. */
export function filterByPeriod<T extends { created_at: string }>(items: readonly T[], period: PeriodKey, now: Date): T[] {
  const start = periodStartMs(period, now);
  if (start === null) return [...items];
  return items.filter((i) => new Date(i.created_at).getTime() >= start);
}

// ─── Public-safe check-in filtering ─────────────────────────────────────────
// Mirrors two guarantees this feature already enforces elsewhere, applied a
// second time here (belt-and-suspenders, same posture blessingBoxes.ts's own
// computeBoxStatus/computeLastFilledAt take on their inputs): a hidden
// check-in never counts toward any public number, and a 'problem' report —
// admin-only from the moment it's written (migrations/0007's own header) —
// is never surfaced in a public count, not even as an anonymous number.

/** The four kinds this feature's public numbers ever count — 'problem' is structurally excluded, matching boxActivity.ts's own CHECKIN_ACTIVITY_KINDS list for the identical reason. */
const COUNTED_KINDS: readonly Exclude<CheckinKind, "problem">[] = ["filled", "took", "low", "empty"];
const COUNTED_KIND_SET: ReadonlySet<string> = new Set(COUNTED_KINDS);

function publicCheckins(checkins: readonly CheckinStatusInput[]): CheckinStatusInput[] {
  return checkins.filter((c) => c.visibility === "visible" && COUNTED_KIND_SET.has(c.kind));
}

// ─── Raw counts ─────────────────────────────────────────────────────────────

export interface CheckinCounts {
  fills: number;
  uses: number;
  emptyReports: number;
  lowReports: number;
  /** fills + uses + emptyReports + lowReports — never includes a 'problem' report, see this file's header. */
  totalCheckins: number;
}

export function computeCheckinCounts(checkins: readonly CheckinStatusInput[]): CheckinCounts {
  let fills = 0;
  let uses = 0;
  let emptyReports = 0;
  let lowReports = 0;
  for (const c of publicCheckins(checkins)) {
    if (c.kind === "filled") fills++;
    else if (c.kind === "took") uses++;
    else if (c.kind === "empty") emptyReports++;
    else if (c.kind === "low") lowReports++;
  }
  return { fills, uses, emptyReports, lowReports, totalCheckins: fills + uses + emptyReports + lowReports };
}

// ─── Pair averages ──────────────────────────────────────────────────────────

export interface PairAverages {
  emptyToFillMs: number | null;
  fillToFillMs: number | null;
  fillToEmptyMs: number | null;
}

function averageOf(deltasMs: readonly number[]): number | null {
  if (deltasMs.length === 0) return null;
  return deltasMs.reduce((sum, d) => sum + d, 0) / deltasMs.length;
}

function sortByCreatedAt(checkins: readonly CheckinStatusInput[]): CheckinStatusInput[] {
  return [...checkins].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

/**
 * For every check-in of `fromKind`, finds the FIRST later check-in of
 * `toKind` (chronologically — any other kinds in between are irrelevant,
 * this only asks "how long until the next one of THAT kind") and records the
 * gap in ms. A `fromKind` event with no later `toKind` at all contributes
 * NOTHING — never a 0, never dropped-as-if-instant — so a box with exactly
 * one 'empty' and no fill after it correctly produces no pair, not a
 * misleading average of one zero-length interval.
 *
 * ponytail: O(n²) in the worst case (every event scans forward for its
 * match) — fine at this feature's real per-box/per-network volume (a
 * handful of check-ins a day, same scale every other blessing-box query in
 * this repo assumes); the upgrade path is a single forward pass tracking
 * "last unmatched fromKind index per toKind" if this ever needs to run over
 * a much larger history.
 */
function collectPairDeltasMs(sorted: readonly CheckinStatusInput[], fromKind: CheckinKind, toKind: CheckinKind): number[] {
  const deltas: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].kind !== fromKind) continue;
    const fromMs = new Date(sorted[i].created_at).getTime();
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].kind === toKind) {
        deltas.push(new Date(sorted[j].created_at).getTime() - fromMs);
        break;
      }
    }
  }
  return deltas;
}

/** One box's own average timing, computed over its ENTIRE history (see this file's header for why period-scoping would mostly starve this of pairs). */
export function computePairAverages(checkins: readonly CheckinStatusInput[]): PairAverages {
  const sorted = sortByCreatedAt(publicCheckins(checkins));
  return {
    emptyToFillMs: averageOf(collectPairDeltasMs(sorted, "empty", "filled")),
    fillToFillMs: averageOf(collectPairDeltasMs(sorted, "filled", "filled")),
    fillToEmptyMs: averageOf(collectPairDeltasMs(sorted, "filled", "empty")),
  };
}

/**
 * Network average = the mean over EVERY pair pooled across every box, NOT
 * the mean of each box's own average (task's own explicit rule) — a box
 * with many short refill cycles naturally outweighs a box with a single
 * long one, exactly as a plain average of every individual observation
 * would. Pairs never cross a box boundary: each box's own check-ins are
 * sorted and paired independently (collectPairDeltasMs never sees another
 * box's events), only the resulting delta lists are pooled before the final
 * average.
 */
export function computeNetworkPairAverages(checkinsByBox: ReadonlyMap<string, readonly CheckinStatusInput[]>): PairAverages {
  const emptyToFill: number[] = [];
  const fillToFill: number[] = [];
  const fillToEmpty: number[] = [];
  for (const checkins of checkinsByBox.values()) {
    const sorted = sortByCreatedAt(publicCheckins(checkins));
    emptyToFill.push(...collectPairDeltasMs(sorted, "empty", "filled"));
    fillToFill.push(...collectPairDeltasMs(sorted, "filled", "filled"));
    fillToEmpty.push(...collectPairDeltasMs(sorted, "filled", "empty"));
  }
  return {
    emptyToFillMs: averageOf(emptyToFill),
    fillToFillMs: averageOf(fillToFill),
    fillToEmptyMs: averageOf(fillToEmpty),
  };
}

/** venue_id-tagged check-in, as the network raw-data query returns — groupCheckinsByVenue's own input shape. */
export interface NetworkStatsCheckin extends CheckinStatusInput {
  venue_id: string;
}

export function groupCheckinsByVenue(checkins: readonly NetworkStatsCheckin[]): Map<string, CheckinStatusInput[]> {
  const byVenue = new Map<string, CheckinStatusInput[]>();
  for (const { venue_id, ...rest } of checkins) {
    const existing = byVenue.get(venue_id);
    if (existing) existing.push(rest);
    else byVenue.set(venue_id, [rest]);
  }
  return byVenue;
}

// ─── Duration formatting ────────────────────────────────────────────────────

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type DurationUnit = "hours" | "days";
export interface FormattedDuration {
  value: number;
  unit: DurationUnit;
}

/** Under 24h reads in whole hours ("2 hours" reads better than "0.1 days"); 24h and over reads in days to one decimal. Pure number-crunching only — the call site supplies the localized unit word via i18n (`box.stats.duration.<unit>`). */
export function formatDurationMs(ms: number): FormattedDuration {
  if (ms < MS_PER_DAY) return { value: Math.round(ms / MS_PER_HOUR), unit: "hours" };
  return { value: Math.round((ms / MS_PER_DAY) * 10) / 10, unit: "days" };
}

// ─── "Boxes that need love" ─────────────────────────────────────────────────

export interface NeedLoveBox {
  id: string;
  name: string;
  archived: boolean;
  /** That box's own check-ins, ALL-TIME — same input shape computePairAverages/lastFilledAtFor already expect. */
  checkins: readonly CheckinStatusInput[];
}

export const NEED_LOVE_LIST_SIZE = 5;

/**
 * The limit /box/[id]/history's server component passes to boxPhotos.ts's
 * loadApprovedPhotosForVenue() when loading a box's photo timestamps for the
 * Numbers section — deliberately much larger than that function's own
 * MAX_HISTORY_PHOTOS default (24, the gallery grid's own display cap): the
 * Numbers panel needs a real all-time/period count, not a gallery-sized
 * sample. A high, round ceiling rather than "unbounded" purely so the bind
 * parameter is never literally infinite; Pueblo's real photo volume is
 * nowhere close to it.
 */
export const ALL_TIME_PHOTO_LIMIT = 100_000;

function lastFilledAtFor(checkins: readonly CheckinStatusInput[]): string | null {
  let latest: string | null = null;
  for (const c of publicCheckins(checkins)) {
    if (c.kind !== "filled") continue;
    if (!latest || c.created_at > latest) latest = c.created_at;
  }
  return latest;
}

export interface LastFillEntry {
  id: string;
  name: string;
  /** null = never filled — sorts FIRST (task's own explicit rule: a never-filled box needs love more urgently than any box with at least one recorded fill, however old). */
  lastFilledAt: string | null;
}

/**
 * Archived boxes never appear here (task's own explicit rule — their check-in
 * history still feeds the network totals elsewhere, just not this "needs
 * attention now" ranking, since nobody can act on an archived box). Boxes
 * that have been filled sort oldest-first (longest since); ties (including
 * every never-filled box) break by name for a deterministic, testable order.
 */
export function rankLongestSinceLastFill(boxes: readonly NeedLoveBox[], limit: number = NEED_LOVE_LIST_SIZE): LastFillEntry[] {
  return boxes
    .filter((b) => !b.archived)
    .map((b) => ({ id: b.id, name: b.name, lastFilledAt: lastFilledAtFor(b.checkins) }))
    .sort((a, b) => {
      if (a.lastFilledAt === null && b.lastFilledAt === null) return a.name.localeCompare(b.name);
      if (a.lastFilledAt === null) return -1;
      if (b.lastFilledAt === null) return 1;
      if (a.lastFilledAt !== b.lastFilledAt) return a.lastFilledAt < b.lastFilledAt ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export interface EmptyReportEntry {
  id: string;
  name: string;
  emptyReportCount: number;
}

/** Archived boxes excluded (same rule as rankLongestSinceLastFill). A box with zero empty reports isn't "needing love" by this measure, so it's dropped entirely rather than padding the list with zeros. */
export function rankMostEmptyReports(boxes: readonly NeedLoveBox[], limit: number = NEED_LOVE_LIST_SIZE): EmptyReportEntry[] {
  return boxes
    .filter((b) => !b.archived)
    .map((b) => ({
      id: b.id,
      name: b.name,
      emptyReportCount: publicCheckins(b.checkins).filter((c) => c.kind === "empty").length,
    }))
    .filter((b) => b.emptyReportCount > 0)
    .sort((a, b) => b.emptyReportCount - a.emptyReportCount || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export interface SlowRefillEntry {
  id: string;
  name: string;
  avgRefillMs: number;
}

/** Archived boxes excluded (same rule). A box with no empty->fill pair at all has no number to rank by — excluded, not shown at 0 or last (same "no pair, no number" rule computePairAverages' own null case already establishes). */
export function rankSlowestRefill(boxes: readonly NeedLoveBox[], limit: number = NEED_LOVE_LIST_SIZE): SlowRefillEntry[] {
  return boxes
    .filter((b) => !b.archived)
    .map((b) => ({ id: b.id, name: b.name, avgRefillMs: computePairAverages(b.checkins).emptyToFillMs }))
    .filter((b): b is SlowRefillEntry => b.avgRefillMs !== null)
    .sort((a, b) => b.avgRefillMs - a.avgRefillMs || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ─── Community milestones ───────────────────────────────────────────────────

export type MilestoneMetric = "fills" | "uses";
const MILESTONE_METRICS: readonly MilestoneMetric[] = ["fills", "uses"];
const MILESTONE_THRESHOLDS: readonly number[] = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export interface Milestone {
  metric: MilestoneMetric;
  threshold: number;
}

/**
 * Picks the SINGLE highest threshold each metric has reached — not every
 * threshold ever crossed, so the copy reads as one proud number ("Pueblo has
 * filled its boxes 250 times"), not a scrolling list of every milestone
 * since 10. A metric that hasn't reached even the first threshold produces
 * no entry at all (task's own "show none if no threshold reached" rule) —
 * never a 0-value milestone line.
 */
export function computeMilestones(totals: { fills: number; uses: number }): Milestone[] {
  const out: Milestone[] = [];
  for (const metric of MILESTONE_METRICS) {
    const value = totals[metric];
    let reached: number | null = null;
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (value >= threshold) reached = threshold;
      else break;
    }
    if (reached !== null) out.push({ metric, threshold: reached });
  }
  return out;
}

// ─── Network-wide raw data (the one new D1 read this slice adds) ──────────

export interface StatsBoxMeta {
  id: string;
  name: string;
  archived: boolean;
}

export interface NetworkStatsPhoto {
  venue_id: string;
  created_at: string;
}

export interface NetworkStatsData {
  boxes: StatsBoxMeta[];
  checkins: NetworkStatsCheckin[];
  photos: NetworkStatsPhoto[];
}

/**
 * Every blessing-box venue (archived included — see this file's header for
 * why network totals must not drop an archived box's history). Still scoped
 * to real boxes only: JOINs `blessing_boxes` (a venue can't be a box without
 * a row there) the same way SELECT_LIVE_BOXES_SQL (blessingBoxes.ts) does.
 */
const SELECT_ALL_BOX_VENUES_SQL = `
  SELECT v.id, v.name, v.status
  FROM venues v
  JOIN blessing_boxes b ON b.venue_id = v.id
  WHERE v.category = 'blessing_box'
  ORDER BY v.name COLLATE NOCASE ASC
`;

/**
 * Every non-problem check-in for every blessing-box venue, regardless of
 * that venue's archived status — the DELIBERATE widening this file's header
 * describes: boxActivity.ts's own VENUE_JOIN adds `AND v.status != 'archived'`
 * for the live activity feed; this query drops that one clause and keeps
 * every other guard (category = 'blessing_box', kind != 'problem') intact.
 * Hidden check-ins are NOT filtered here — the pure aggregation functions
 * above filter `visibility` themselves (publicCheckins()), same
 * belt-and-suspenders split blessingBoxes.ts's computeBoxStatus already uses
 * for its own inputs.
 */
const SELECT_ALL_BOX_CHECKINS_SQL = `
  SELECT c.venue_id, c.kind, c.visibility, c.created_at
  FROM box_checkins c
  JOIN venues v ON v.id = c.venue_id AND v.category = 'blessing_box'
  WHERE c.kind != 'problem'
  ORDER BY c.created_at ASC
`;

/** Every APPROVED photo for every blessing-box venue, archived included — same widening as the check-ins query above, for the same reason. */
const SELECT_ALL_BOX_PHOTOS_SQL = `
  SELECT p.venue_id, p.created_at
  FROM box_photos p
  JOIN venues v ON v.id = p.venue_id AND v.category = 'blessing_box'
  WHERE p.status = 'approved'
  ORDER BY p.created_at ASC
`;

interface VenueMetaRow {
  id: string;
  name: string;
  status: string;
}

/**
 * The one new D1 read this slice adds — everything /boxes/activity's
 * Numbers section needs, in three queries, no aggregation done in SQL (the
 * pure functions above do that, so the exact same logic that's unit-tested
 * against plain fixtures is what actually runs). Boxes/checkins are allowed
 * to throw (propagate to the caller, same "an outage is a full stats
 * outage" posture loadVisibleCheckins/loadLiveBoxes already take) — only
 * the photos read is wrapped here, mirroring blessingBoxes.ts's own
 * loadLatestPhotosBestEffort: a missing/broken box_photos table must
 * degrade to "no photo numbers," never take the whole stats response down.
 *
 * ponytail: no pagination or row cap — fine at Pueblo's real box/check-in
 * volume (the same scale every other blessing-box query in this repo
 * assumes); the upgrade path if this table ever grows large is moving the
 * aggregation server-side (SQL GROUP BY / window functions) instead of
 * shipping every raw row to the browser once.
 */
export async function loadNetworkStatsData(db: D1Database): Promise<NetworkStatsData> {
  const venuesResult = await db.prepare(SELECT_ALL_BOX_VENUES_SQL).all<VenueMetaRow>();
  const boxes: StatsBoxMeta[] = (venuesResult.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    archived: r.status === "archived",
  }));

  const checkinsResult = await db.prepare(SELECT_ALL_BOX_CHECKINS_SQL).all<NetworkStatsCheckin>();
  const checkins = checkinsResult.results ?? [];

  let photos: NetworkStatsPhoto[] = [];
  try {
    const photosResult = await db.prepare(SELECT_ALL_BOX_PHOTOS_SQL).all<NetworkStatsPhoto>();
    photos = photosResult.results ?? [];
  } catch {
    photos = [];
  }

  return { boxes, checkins, photos };
}
