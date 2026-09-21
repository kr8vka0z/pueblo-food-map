/**
 * boxHealth.ts — the ADMIN triage read of a blessing box's status, used by
 * the /admin Dashboard's "Boxes that need help" panel and the /admin/boxes
 * tab (map pins, "Needs help now" / "Gone quiet" lists, the all-boxes
 * table). Deliberately a SEPARATE function from blessingBoxes.ts's
 * computeBoxStatus(): that one is the PUBLIC map's contract (7-day fade
 * window, 'took'/'problem' never set a status, an out-of-service override)
 * and must not be bent to fit an admin-only display rule — see that
 * function's own header for why its reading is deliberately narrow.
 *
 * This file answers a different, admin-facing question — "does this box
 * need someone to go check on it right now, or has nobody said anything in
 * a while?" — with its own thresholds (task spec, admin dashboard build):
 *
 *   - The latest VISIBLE check-in is low/empty/problem -> that status, AT
 *     ANY AGE. An unresolved "empty" report from three weeks ago still
 *     needs a person; it does not quietly fade back to "fine" the way the
 *     public badge does after 7 days. There is no age cap here by design.
 *   - The latest visible check-in is filled/took and within the 30-day
 *     "still being watched" window -> "ok".
 *   - No visible check-in at all, or the latest one is older than 30 days
 *     -> "quiet" (nobody has reported on it in a while — not necessarily a
 *     problem, just unmonitored).
 */

import type { CheckinKind } from "@/lib/blessingBoxes";

export type BoxHealthStatus = "ok" | "low" | "empty" | "problem" | "quiet";

/** The minimal check-in shape this module needs — same "narrower than the full D1 row" convention blessingBoxes.ts's CheckinStatusInput uses, so a caller can build this from a D1 row or a test fixture with no adapter. */
export interface BoxHealthCheckin {
  kind: CheckinKind;
  visibility: "visible" | "hidden";
  createdAt: string; // ISO 8601
  note?: string | null;
}

export interface BoxHealth {
  status: BoxHealthStatus;
  latest: BoxHealthCheckin | null;
  /** Whole days since the latest visible check-in, or null when there has never been one. */
  daysSinceLastReport: number | null;
}

/** A report older than this, with nothing since, reads as "gone quiet" rather than "ok" — task spec's own number, independent of blessingBoxes.ts's 7-day PUBLIC fade window (see this file's header for why the two must not be unified). */
export const QUIET_WINDOW_DAYS = 30;

const NEEDS_HELP_KINDS: ReadonlySet<CheckinKind> = new Set(["low", "empty", "problem"]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / MS_PER_DAY));
}

/**
 * Pure — no D1, no Date.now() (an injectable `now` keeps this testable
 * without faking global time, same convention as blessingBoxes.ts's
 * computeBoxStatus). Pass every check-in for one box, in any order; hidden
 * rows are ignored even if newest, same "hidden check-ins never count"
 * rule the public computation already applies.
 */
export function computeBoxHealth(checkins: BoxHealthCheckin[], now: Date = new Date()): BoxHealth {
  let latest: BoxHealthCheckin | null = null;
  for (const c of checkins) {
    if (c.visibility !== "visible") continue;
    if (!latest || c.createdAt > latest.createdAt) latest = c;
  }
  if (!latest) return { status: "quiet", latest: null, daysSinceLastReport: null };

  const days = daysSince(latest.createdAt, now);
  if (NEEDS_HELP_KINDS.has(latest.kind)) {
    return { status: latest.kind as "low" | "empty" | "problem", latest, daysSinceLastReport: days };
  }
  if (days > QUIET_WINDOW_DAYS) return { status: "quiet", latest, daysSinceLastReport: days };
  return { status: "ok", latest, daysSinceLastReport: days };
}

/** One box's health plus the display context both the Dashboard panel and the Boxes tab need — built by each page's own loader, not by this file (no D1 here). */
export interface BoxHealthEntry {
  venueId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  health: BoxHealth;
  /** First approved adopter's display name, or null — "no caretaker" is a display-layer decision, not this module's. */
  caretaker: string | null;
  /**
   * `blessing_boxes.removed_on` — same "box no longer in service" meaning
   * blessingBoxes.ts's own mapRowToPublicBox already gives it (a display
   * flag, NOT a query filter: a removed box still appears here, same as it
   * still appears on the public map marked out-of-service, rather than
   * disappearing from admin management entirely). Feeds the Boxes tab's
   * "N in service" count (src/app/admin/boxes/page.tsx); unused by the
   * Dashboard's "Boxes that need help" panel, which doesn't distinguish it.
   */
  removedOn: string | null;
}

/**
 * Boxes needing help right now (status low/empty/problem), most recent
 * report first — feeds BOTH the Dashboard's compact "Boxes that need help"
 * panel and the Boxes tab's fuller "Needs help now" list, same ranking
 * either way so the two screens never disagree about which box is most
 * urgent.
 */
export function rankNeedsHelp(entries: BoxHealthEntry[], limit?: number): BoxHealthEntry[] {
  const needing = entries
    .filter((e) => e.health.status === "low" || e.health.status === "empty" || e.health.status === "problem")
    .sort((a, b) => {
      const at = a.health.latest?.createdAt ?? "";
      const bt = b.health.latest?.createdAt ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0;
    });
  return typeof limit === "number" ? needing.slice(0, limit) : needing;
}

/**
 * Boxes nobody has reported on in 30+ days, longest-quiet first. A box that
 * has NEVER had a check-in (`daysSinceLastReport === null`) sorts ahead of
 * every numeric age — it is the least-known of the two, not the
 * "freshest" quiet box, which a naive numeric sort (treating null as 0)
 * would produce.
 */
export function rankQuiet(entries: BoxHealthEntry[], limit?: number): BoxHealthEntry[] {
  const quiet = entries
    .filter((e) => e.health.status === "quiet")
    .sort((a, b) => {
      const ad = a.health.daysSinceLastReport;
      const bd = b.health.daysSinceLastReport;
      if (ad === null && bd === null) return 0;
      if (ad === null) return -1;
      if (bd === null) return 1;
      return bd - ad;
    });
  return typeof limit === "number" ? quiet.slice(0, limit) : quiet;
}
