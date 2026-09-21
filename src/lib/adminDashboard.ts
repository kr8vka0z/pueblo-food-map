/**
 * adminDashboard.ts — pure helpers for the /admin Dashboard's "Places due
 * for a check" panel and the /admin/boxes tab's "Box reports, last 8
 * weeks" chart. Kept free of D1 (same split adminVenues.ts / adminProposals.ts
 * already use for this admin surface) so every branch — a fresh venue with
 * no stale rows at all, a week-bucket boundary, an all-zero week — is
 * directly testable with plain fixtures instead of a live binding.
 */

import type { AdminVenueRow, VenueCategory } from "@/types/venue";
import type { CheckinKind } from "@/lib/blessingBoxes";

// ─── Stale places ───────────────────────────────────────────────────────────

export interface StalePlace {
  id: string;
  name: string;
  category: VenueCategory;
  lastVerified: string;
  monthsSince: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Average calendar-month length — good enough for a "roughly N months"
// display column, not a billing or legal calculation.
const AVG_DAYS_PER_MONTH = 30.44;

type StaleSourceRow = Pick<AdminVenueRow, "id" | "name" | "category" | "status" | "last_verified">;

/**
 * Published venues whose `last_verified` is at least `months` old, oldest
 * first — the Dashboard's "Places due for a check" panel. Blessing boxes
 * are excluded: their health signal is check-ins (src/lib/boxHealth.ts),
 * not a hand-verified `last_verified` date, so lumping them in here would
 * flag every box as "due" the moment it's created (boxes are never
 * re-verified the way a pantry/grocery listing is). UTC date math, same
 * convention as adminVenues.ts's formatLastVerified — this can run from a
 * Mountain-time laptop or Cloudflare's UTC edge, and `last_verified`
 * carries no time component of its own.
 *
 * `totalCount` is the full matching count (for a "See all N" link) even
 * when `items` is capped by `opts.limit`.
 */
export function selectStalePlaces(
  rows: StaleSourceRow[],
  now: Date,
  opts: { months?: number; limit?: number } = {},
): { items: StalePlace[]; totalCount: number } {
  const months = opts.months ?? 12;
  const cutoffDays = months * AVG_DAYS_PER_MONTH;

  const stale = rows
    .filter((r) => r.status === "published" && r.category !== "blessing_box")
    .map((r) => {
      const days = (now.getTime() - new Date(r.last_verified).getTime()) / MS_PER_DAY;
      return { row: r, days };
    })
    .filter((r) => r.days >= cutoffDays)
    // Oldest last_verified first — string comparison is safe since
    // last_verified is a plain ISO/date-only string (same "compare the
    // stored string directly" convention adminVenues.ts's updated_at >
    // published_at check already relies on).
    .sort((a, b) => a.row.last_verified.localeCompare(b.row.last_verified));

  const limited = typeof opts.limit === "number" ? stale.slice(0, opts.limit) : stale;
  const items: StalePlace[] = limited.map(({ row, days }) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    lastVerified: row.last_verified,
    monthsSince: Math.floor(days / AVG_DAYS_PER_MONTH),
  }));

  return { items, totalCount: stale.length };
}

// ─── Weekly check-in bucketing ──────────────────────────────────────────────

export interface WeeklyCheckinBucket {
  /** ISO date (UTC, date-only) of this bucket's first day. */
  weekStart: string;
  ok: number;
  trouble: number;
}

/** 'filled'/'took' read as "someone used or restocked the box" (OK); 'low'/'empty'/'problem' read as "something needs attention" (trouble) — same split the approved mockup's own legend uses. */
const OK_KINDS: ReadonlySet<CheckinKind> = new Set(["filled", "took"]);

/**
 * Buckets check-ins into `weeks` consecutive 7-day windows ending today,
 * oldest first — the Boxes tab's "last 8 weeks" bar chart. UTC day
 * boundaries so the bucketing doesn't shift with the host's local
 * timezone (same reasoning formatLastVerified pins UTC). A check-in older
 * than the whole window is silently dropped (the caller is expected to
 * have already queried only the window it needs — see
 * loadRecentCheckinsAllBoxes's own cutoff — but this function tolerates a
 * wider input without crashing).
 */
export function bucketCheckinsByWeek(
  checkins: { kind: CheckinKind; createdAt: string }[],
  now: Date,
  weeks: number = 8,
): WeeklyCheckinBucket[] {
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const bucketStarts: number[] = [];
  const buckets: WeeklyCheckinBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const startMs = todayUTC - (i + 1) * 7 * MS_PER_DAY;
    bucketStarts.push(startMs);
    buckets.push({ weekStart: new Date(startMs).toISOString().slice(0, 10), ok: 0, trouble: 0 });
  }

  for (const c of checkins) {
    const t = Date.parse(c.createdAt);
    if (Number.isNaN(t)) continue; // defensive: never let one malformed timestamp break the whole chart
    for (let i = bucketStarts.length - 1; i >= 0; i--) {
      if (t >= bucketStarts[i]) {
        if (OK_KINDS.has(c.kind)) buckets[i].ok += 1;
        else buckets[i].trouble += 1;
        break;
      }
    }
  }

  return buckets;
}
