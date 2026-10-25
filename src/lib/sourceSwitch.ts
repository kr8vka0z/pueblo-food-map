/**
 * sourceSwitch.ts — the automatic switch per (source, field) (Venue Data
 * Rebuild plan, "Decided: sources switch themselves on", Kyle 2026-10-25).
 *
 * A pair starts proposal-only. After SWITCH_THRESHOLD real changes in a row
 * that Kyle approved unedited, the weekly refresh applies that pair's
 * future changes on its own (scripts/refresh/proposalSql.ts's switch lane);
 * never closures, removals, adds, clears, or fields the venue told us.
 *
 * The count is DERIVED from change_proposals history rather than kept as a
 * counter, so the approve/reject routes need no extra write and the count
 * can't drift from what actually happened:
 *   - a human-approved update that applied something: +1 for each field it
 *     changed;
 *   - a rejected update: the run stops there (reset);
 *   - automatic rows (reviewed_by is a pipeline actor, or approved with
 *     nothing applied — the "still listed" rows) are skipped, neither
 *     counting nor breaking;
 *   - a row in source_switch_resets (migration 0023) — written when Kyle
 *     edits, in the venue form, a value a pair's change put there, which is
 *     how an "edited approval" or an undone automatic change shows up here —
 *     restarts the count after it.
 *
 * Only Care and Share is switchable in this step: the plan narrows Plentiful
 * and OpenStreetMap later (step 5) and the website reader is step 3, so
 * letting their pairs switch on now would let sources the plan is about to
 * demote write to the map unattended.
 */

import { currentFieldValue, valuesEqual, type CurrentVenueRow } from "../../scripts/refresh/diffEngine";

export const SWITCH_SOURCES = ["care_and_share"] as const;
export const SWITCH_FIELDS = ["address", "phone", "url", "hours_weekly", "hours_irregular"] as const;
export const SWITCH_THRESHOLD = 5;
/** audit_log / change_proposals actor for a change the switch applied. */
export const AUTO_SWITCH_ACTOR = "refresh-pipeline-auto";
const AUTOMATIC_ACTORS: ReadonlySet<string> = new Set(["refresh-pipeline", "refresh-pipeline-ai", AUTO_SWITCH_ACTOR]);

const SOURCE_IN = SWITCH_SOURCES.map((s) => `'${s}'`).join(",");

/** Every decided update of a switchable source. Small: one row per real change ever reviewed. */
export const SWITCH_HISTORY_SQL =
  "SELECT source, change_type, proposed_diff, status, reviewed_by, reviewed_at, applied_at FROM change_proposals " +
  `WHERE source IN (${SOURCE_IN}) AND change_type = 'update' AND status IN ('approved','rejected') AND reviewed_at IS NOT NULL`;

/** Newest reset per pair (migration 0023). */
export const SWITCH_RESETS_SQL = "SELECT source, field, MAX(reset_at) AS reset_at FROM source_switch_resets GROUP BY source, field";

/** One venue's applied changes from switchable sources, newest first — what resetsForEdit compares an edit against. */
export const RECENT_APPLIED_FOR_VENUE_SQL =
  "SELECT source, proposed_diff, applied_at FROM change_proposals " +
  `WHERE target_venue_id = ? AND source IN (${SOURCE_IN}) AND change_type = 'update' AND status = 'approved' AND applied_at IS NOT NULL ` +
  "ORDER BY applied_at DESC LIMIT 50";

/** One reset row, behind the PATCH route's usual WHERE EXISTS guard (a stale edit writes no reset). */
export const SWITCH_RESET_INSERT_SQL =
  "INSERT INTO source_switch_resets (source, field, venue_id, reset_at, reset_by) SELECT ?, ?, ?, ?, ? " +
  "WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)";

export interface SwitchHistoryRow {
  source: string;
  change_type: string;
  proposed_diff: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
}

export interface SwitchResetRow {
  source: string;
  field: string;
  reset_at: string;
}

export interface SwitchState {
  source: string;
  field: string;
  /** Unedited approvals in a row (since the last rejection or reset). */
  streak: number;
  on: boolean;
}

function changedFieldsOf(proposedDiff: string): string[] {
  try {
    const parsed = JSON.parse(proposedDiff) as { fields_changed?: unknown };
    return Array.isArray(parsed.fields_changed) ? parsed.fields_changed.filter((f): f is string => typeof f === "string") : [];
  } catch {
    return [];
  }
}

/** The state of every switchable pair, whether or not it has any history yet. */
export function computeSwitchStates(rows: SwitchHistoryRow[], resets: SwitchResetRow[]): SwitchState[] {
  const resetAt = new Map(resets.map((r) => [`${r.source}:${r.field}`, r.reset_at]));
  const newestFirst = rows
    .filter((r) => r.change_type === "update" && r.reviewed_at)
    .sort((a, b) => (b.reviewed_at! < a.reviewed_at! ? -1 : b.reviewed_at! > a.reviewed_at! ? 1 : 0));

  const states: SwitchState[] = [];
  for (const source of SWITCH_SOURCES) {
    for (const field of SWITCH_FIELDS) {
      const since = resetAt.get(`${source}:${field}`);
      let streak = 0;
      for (const r of newestFirst) {
        if (r.source !== source || !changedFieldsOf(r.proposed_diff).includes(field)) continue;
        if (since && r.reviewed_at! <= since) break;
        if (r.status === "rejected") break;
        if (AUTOMATIC_ACTORS.has(r.reviewed_by ?? "") || !r.applied_at) continue;
        streak++;
      }
      states.push({ source, field, streak, on: streak >= SWITCH_THRESHOLD });
    }
  }
  return states;
}

export function switchIsOn(states: SwitchState[], source: string, field: string): boolean {
  return states.some((s) => s.source === source && s.field === field && s.on);
}

/**
 * The pairs an admin edit resets: for each switchable field the edit
 * changes, the newest applied change of that field from a switchable
 * source — if the field still holds exactly the value that change wrote,
 * the edit is correcting it, so that pair starts over. A field someone has
 * since changed by hand doesn't reset anything (it's no longer the pair's
 * value), which also keeps later unrelated edits from resetting again.
 */
export function resetsForEdit(
  before: Partial<Record<string, unknown>>,
  after: Partial<Record<string, unknown>>,
  recentApplied: { source: string; proposed_diff: string; applied_at: string | null }[],
): { source: string; field: string }[] {
  const out: { source: string; field: string }[] = [];
  const asRow = (o: Partial<Record<string, unknown>>) => o as unknown as CurrentVenueRow;
  for (const field of SWITCH_FIELDS) {
    const prior = currentFieldValue(asRow(before), field);
    if (valuesEqual(prior, currentFieldValue(asRow(after), field))) continue;
    const newest = recentApplied.find((r) => changedFieldsOf(r.proposed_diff).includes(field));
    if (!newest) continue;
    let written: unknown;
    try {
      written = (JSON.parse(newest.proposed_diff) as { after?: Record<string, unknown> }).after?.[field];
    } catch {
      continue;
    }
    if (valuesEqual(prior, currentFieldValue(asRow({ [field]: written }), field))) out.push({ source: newest.source, field });
  }
  return out;
}
