/**
 * adminProposals.ts — pure parsing + lifecycle-correctness logic for the
 * `/admin/flags` change-proposal review queue (issue: build the screen that
 * consumes what scripts/refresh-ingest.ts + scripts/refresh/diffEngine.ts
 * write into `change_proposals` — migrations/0001_init_admin_schema.sql).
 *
 * Kept free of D1/fetch (same reasoning diffEngine.ts's own header gives):
 * the one thing that actually has to be right here — does this proposal's
 * assumption still hold against the CURRENT venue row — is exactly the kind
 * of logic a wrong answer either silently discards a real admin edit
 * (over-eager apply) or nags an admin forever with a proposal that can never
 * cleanly apply (over-eager staleness). Both failure modes are cheap to
 * catch with plain fixtures here; neither is cheap to catch by reading
 * production D1 after the fact.
 *
 * WHY this reuses diffEngine.ts's own currentFieldValue()/valuesEqual()
 * rather than re-deriving field equality: the stale-apply guard (§6.10c,
 * docs/admin/cloudflare-native-admin-spec.md) exists specifically to
 * re-check a proposal's `before` snapshot against a fresh D1 read using the
 * SAME comparison the diff engine used to produce that snapshot in the
 * first place. A second, independently-written comparison would risk
 * silently diverging from it — e.g. hours_weekly's day-key-sorted JSON
 * normalization — which could misclassify a genuinely-unchanged field as
 * "moved" (false staleness) or the reverse (a real change let through).
 */

import type { AdminVenueRow, Venue } from "@/types/venue";
import { currentFieldValue, valuesEqual, type CurrentVenueRow } from "../../scripts/refresh/diffEngine";

// ─── Row + parsed-diff shapes ───────────────────────────────────────────────

/** Mirrors the `change_proposals` CHECK constraints (migrations/0001_init_admin_schema.sql). */
export type ProposalStatus = "pending" | "approved" | "rejected" | "superseded";
export type ProposalSourceValue = "osm" | "plentiful" | "gtfs" | "link_health";
export type ProposalChangeType = "add" | "update" | "remove";

/** One full row of the D1 `change_proposals` table. */
export interface ChangeProposalRow {
  id: number;
  source: string;
  target_venue_id: string;
  change_type: string;
  proposed_diff: string; // JSON text — see ProposedDiff below
  diff_hash: string;
  run_id: string;
  anomaly: number;
  status: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
}

/** Mirrors change_proposals.proposed_diff's one shape for every source (schema comment, migrations/0001; scripts/refresh/diffEngine.ts's own ProposedDiff). */
export interface ProposedDiff {
  before: Partial<Venue> | null;
  after: Partial<Venue> | null;
  fields_changed: string[];
  meta?: Record<string, unknown>;
}

export type ParsedProposal =
  | { row: ChangeProposalRow; parseError: false; diff: ProposedDiff }
  | { row: ChangeProposalRow; parseError: true; diff: null };

/**
 * Parses one D1 row's `proposed_diff` JSON, degrading to `parseError: true`
 * on any bad JSON rather than throwing — same per-row defensive pattern
 * src/app/admin/submissions/page.tsx's parseSubmissionRow already
 * established: one malformed row must degrade to that single card's own
 * error state, never blank the whole queue or 500 the page.
 */
export function parseProposalRow(row: ChangeProposalRow): ParsedProposal {
  try {
    const diff = JSON.parse(row.proposed_diff) as ProposedDiff;
    return { row, parseError: false, diff };
  } catch {
    return { row, parseError: true, diff: null };
  }
}

// ─── Stale-apply guard (spec §6.10c) ────────────────────────────────────────

/**
 * The stale-apply guard's input shape: a real, freshly-read `venues` row, or
 * null when target_venue_id no longer exists at all. A full AdminVenueRow
 * structurally satisfies diffEngine's own CurrentVenueRow (every field that
 * type needs — id/name/category/lat/lng/address/hours_weekly/phone/url/
 * operator/last_verified — is present with a compatible type), so this is a
 * type alias, not a second shape to keep in sync.
 */
export type CurrentVenueLookup = AdminVenueRow & CurrentVenueRow;

export interface StaleApplyResult {
  stale: boolean;
  /** Human-readable, shown to the reviewing admin when stale — absent when stale is false. */
  reason?: string;
}

/**
 * §6.10c: "before executing the mutation, the handler re-reads the current
 * `venues` row for target_venue_id and re-checks it against
 * proposed_diff.before — but scoped to what that proposal actually
 * asserts, not the whole row." The narrow per-type scope is load-bearing,
 * not a simplification — see AGENTS.md's "#235 reconciliation" note (also
 * quoted in the spec) for the concrete case a whole-row check would
 * misfire on: two independent proposals from different sources can
 * legitimately target the same venue at once (a link_health url-clear and
 * an osm remove), and a coarse "does the whole row still match" check would
 * falsely stale-out the second one after the first is approved.
 */
export function checkStaleApply(
  changeType: ProposalChangeType,
  currentRow: CurrentVenueLookup | null,
  diff: ProposedDiff,
): StaleApplyResult {
  switch (changeType) {
    case "add":
      // Only re-checks: no CONFLICTING non-archived row now exists with
      // this id. An archived row is fine — that's a restore (§6.7), not a
      // conflict; a missing row is fine — that's the common fresh-add case.
      if (currentRow && currentRow.status !== "archived") {
        return { stale: true, reason: "A venue with this id already exists and isn't removed from the map." };
      }
      return { stale: false };

    case "remove":
      // Only re-checks: the row is still non-archived — a remove proposal
      // carries no field diff to re-verify (diffEngine's buildProposal for
      // change_type "remove" always writes fields_changed: []).
      if (!currentRow) {
        return { stale: true, reason: "This venue no longer exists." };
      }
      if (currentRow.status === "archived") {
        return { stale: true, reason: "This venue is already removed from the map." };
      }
      return { stale: false };

    case "update": {
      if (!currentRow || currentRow.status === "archived") {
        return { stale: true, reason: "This venue no longer exists or was already removed from the map." };
      }
      const before = (diff.before ?? {}) as Partial<Venue>;
      for (const field of diff.fields_changed) {
        const key = field as keyof Venue;
        const beforeValue = currentFieldValue(before as unknown as CurrentVenueRow, key);
        const nowValue = currentFieldValue(currentRow, key);
        if (!valuesEqual(beforeValue, nowValue)) {
          return {
            stale: true,
            reason: `This venue's "${field}" changed since the proposal was generated.`,
          };
        }
      }
      return { stale: false };
    }
  }
}

// ─── Applying an approved proposal's field diff (spec §6.7) ────────────────

/** D1 storage form of one Venue field's value — hours_weekly is JSON text in `venues`, a parsed object in `Venue`/ProposedDiff. */
export function toColumnValue(field: keyof Venue, value: unknown): unknown {
  if (field === "hours_weekly") {
    if (value === null || value === undefined) return null;
    return JSON.stringify(value);
  }
  return value === undefined ? null : value;
}

/** Venue.accepts_snap/accepts_wic (optional boolean) -> the venues table's tri-state INTEGER column (NULL=unknown, 0=no, 1=yes). */
export function toTriState(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}
