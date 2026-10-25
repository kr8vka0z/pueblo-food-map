/**
 * proposalSql.ts — builds the SQL statement(s) refresh-ingest.ts writes for
 * ONE proposal (extracted so it's unit-testable: refresh-ingest.ts calls
 * main() at import time, so nothing in that file can be tested directly —
 * same reasoning sqlChunks.ts's own header gives for living beside
 * diffEngine.ts here instead).
 *
 * A "date-only" proposal (change_type 'update', fields_changed exactly
 * ["last_verified"], ~86 of ~104 in a real run) means "the source still
 * lists this venue and nothing it owns changed". Since Kyle's 2026-09-15 call
 * it never needed a click. Until the Venue Data Rebuild (atlas-kb "PFM Venue
 * Data Rebuild Plan 2026-10-25", step 1) it also bumped
 * `venues.last_verified` — which made "we downloaded it" read as "someone
 * confirmed it" on the public site. It now writes NO venues row and NO
 * audit_log row: just a 'listed' fetch observation (venue_observations,
 * migration 0021) plus the already-'approved' change_proposals row with
 * applied_at NULL (nothing was applied). That row is kept because
 * src/lib/refreshAlerts.ts's staleness check reads MAX(created_at) per
 * source from change_proposals as "this source's last good run".
 * Reuses `isDateOnlyUpdateProposal` (src/lib/adminProposals.ts) so the
 * bulk-approve button and this file agree on what "date-only" means.
 *
 * Pins (same plan, "Venue-confirmed details are pinned"): a proposal that
 * touches a field the venue itself told us (a venue_direct pin) never
 * auto-applies through ANY lane here, and carries the pin in
 * proposed_diff.meta.pins so the review card shows it beside the change.
 * Repeats of a rejected pinned-field proposal are already silenced by
 * rejection memory (diff_hash ignores meta), so there's no second mechanism.
 *
 * The automatic switch (Venue Data Rebuild step 2, src/lib/sourceSwitch.ts):
 * once a (source, field) pair has 5 unedited approvals in a row, a plain
 * update touching only switched-on pairs is applied here under
 * `refresh-pipeline-auto` (isSwitchApplicable / buildSwitchApplyStatements).
 * Order of the lanes below: pins, then the switch, then the opt-in AI lane,
 * then date-only, else pending.
 */

import { isDateOnlyUpdateProposal, reviewableDiffFields, toColumnValue } from "@/lib/adminProposals";
import { AUTO_SWITCH_ACTOR, SWITCH_SOURCES, switchIsOn, type SwitchState } from "@/lib/sourceSwitch";
import type { Venue } from "@/types/venue";
import type { ProposalDraft } from "./diffEngine";
import { computeAutoApplyEligibility, serializeTriageResult, type TriageResult } from "./triage";

export interface ProposalWriteStatements {
  /** true = this proposal auto-applied to `venues` this run (date-only); false = it was written as a normal pending row for a human to review. */
  autoApplied: boolean;
  statements: string[];
}

const AUTO_APPLY_ACTOR = "refresh-pipeline";
/** Distinct actor for the Jev-gated lane, so audit_log shows which writes the AI unlocked (#543). */
const AI_AUTO_APPLY_ACTOR = "refresh-pipeline-ai";

/** One live venue_direct pin for the proposal's venue (newest per field; refresh-ingest.ts loads them). */
export interface PinRow {
  venue_id: string;
  field: string;
  fetched_at: string;
  pinned_by: string | null;
  pin_note: string | null;
}

/** Shape of each entry in proposed_diff.meta.pins — read by ProposalCard.tsx's pin note. */
export interface PinMeta {
  field: string;
  pinned_at: string;
  pinned_by: string | null;
  note: string | null;
  age_days: number;
  /** Over 12 months old: the plan says an old pin no longer outranks a source; shown so Kyle can renew or release it. */
  stale: boolean;
}

const PIN_STALE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The pins this proposal touches: the venue's pins on any field it changes,
 * or every pin on the venue for a remove (a removal contradicts all of them).
 * `last_verified` is never pinnable, so date-only proposals never match.
 */
export function pinsTouchedBy(proposal: ProposalDraft, pins: PinRow[], now: string): PinMeta[] {
  const mine = pins.filter((p) => p.venue_id === proposal.targetVenueId);
  const touched =
    proposal.changeType === "remove" ? mine : mine.filter((p) => proposal.proposedDiff.fields_changed.includes(p.field));
  return touched.map((p) => {
    const ageDays = Math.max(0, Math.floor((new Date(now).getTime() - new Date(p.fetched_at).getTime()) / MS_PER_DAY));
    return { field: p.field, pinned_at: p.fetched_at, pinned_by: p.pinned_by, note: p.pin_note, age_days: ageDays, stale: ageDays > PIN_STALE_DAYS };
  });
}

export interface ProposalWriteOptions {
  /**
   * Live venue_direct pins (any venue — filtered here). Absent/empty = no
   * pins, e.g. a database without migration 0021, where none can exist.
   */
  pins?: PinRow[];
  /**
   * false = venue_observations (0021) is missing on the target database:
   * the date-only branch skips its observation INSERT instead of failing the
   * whole batch. Defaults to true.
   */
  observationsReady?: boolean;
  /** Jev's verdict for this proposal (scripts/refresh/triage.ts); absent = written untriaged, triage_* columns left NULL. */
  triage?: TriageResult | null;
  /**
   * REFRESH_AI_AUTO_APPLY (default OFF). When on, an `auto_apply_candidate`
   * that ALSO re-passes the deterministic formatting-only check is applied
   * like a date-only bump, under AI_AUTO_APPLY_ACTOR. Off → it is written
   * as a normal pending row with its lane stored.
   */
  aiAutoApply?: boolean;
  /**
   * The automatic switch's state per (source, field) (src/lib/sourceSwitch.ts).
   * Absent/empty = every pair is proposal-only.
   */
  switchStates?: SwitchState[];
}

type SqlText = (value: string | null | undefined) => string;

/** Column list + values for the four triage columns (migration 0016), or empty when untriaged. */
function triageColumns(triage: TriageResult | null | undefined, now: string, sqlText: SqlText) {
  if (!triage) return { cols: "", vals: [] as string[] };
  return {
    cols: ", triage_lane, triage_json, triage_model, triage_at",
    vals: [sqlText(triage.lane), sqlText(serializeTriageResult(triage)), sqlText(triage.model), sqlText(now)],
  };
}

/**
 * `sqlText` is passed in rather than imported — matches refresh-ingest.ts's
 * own deliberate non-import of seed-admin-db.ts's identical helper (see
 * that file's "SQL literal helpers" header): the caller already owns the
 * one canonical `sqlText`, and passing it keeps this module free of any
 * import that could pull in a stale data-module cache.
 */
export function buildProposalWriteStatements(
  proposal: ProposalDraft,
  now: string,
  sqlText: SqlText,
  options: ProposalWriteOptions = {},
): ProposalWriteStatements {
  const tri = triageColumns(options.triage, now, sqlText);
  const pinned = pinsTouchedBy(proposal, options.pins ?? [], now);
  if (pinned.length > 0) {
    // Checked BEFORE every auto-apply lane below, so no current or future
    // lane can write a pinned field without a human.
    return { autoApplied: false, statements: [pendingInsert({ ...proposal, proposedDiff: { ...proposal.proposedDiff, meta: { ...proposal.proposedDiff.meta, pins: pinned } } }, sqlText, tri)] };
  }
  if (isSwitchApplicable(proposal, options.switchStates ?? [])) {
    return { autoApplied: true, statements: buildSwitchApplyStatements(proposal, now, sqlText, tri) };
  }
  if (options.aiAutoApply && options.triage?.lane === "auto_apply_candidate" && computeAutoApplyEligibility(proposal)) {
    return { autoApplied: true, statements: buildAiAutoApplyStatements(proposal, now, sqlText, tri) };
  }

  const dateOnly = isDateOnlyUpdateProposal(
    { change_type: proposal.changeType, source: proposal.source },
    proposal.proposedDiff,
  );

  if (!dateOnly) {
    return { autoApplied: false, statements: [pendingInsert(proposal, sqlText, tri)] };
  }

  const statements: string[] = [];
  if (options.observationsReady !== false) {
    statements.push(
      "INSERT INTO venue_observations (venue_id, field, source, value, fetched_at) VALUES (" +
        [sqlText(proposal.targetVenueId), sqlText("listed"), sqlText(proposal.source), sqlText("true"), sqlText(now)].join(", ") +
        ");",
    );
  }
  // Already-'approved' with applied_at NULL: a complete who/when trail for
  // the run (refreshAlerts.ts's staleness check reads it), while saying
  // plainly that nothing was applied to `venues`.
  statements.push(
    "INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, reviewed_at) VALUES (" +
      [
        sqlText(proposal.source),
        sqlText(proposal.targetVenueId),
        sqlText(proposal.changeType),
        sqlText(JSON.stringify(proposal.proposedDiff)),
        sqlText(proposal.diffHash),
        sqlText(proposal.runId),
        sqlText("approved"),
        sqlText(AUTO_APPLY_ACTOR),
        sqlText(now),
      ].join(", ") +
      ");",
  );

  return { autoApplied: true, statements };
}

/** A plain pending row for a human to review (status from the table's DEFAULT 'pending'). */
function pendingInsert(proposal: ProposalDraft, sqlText: SqlText, tri: { cols: string; vals: string[] }): string {
  return (
    `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id${tri.cols}) VALUES (` +
    [
      sqlText(proposal.source),
      sqlText(proposal.targetVenueId),
      sqlText(proposal.changeType),
      sqlText(JSON.stringify(proposal.proposedDiff)),
      sqlText(proposal.diffHash),
      sqlText(proposal.runId),
      ...tri.vals,
    ].join(", ") +
    ");"
  );
}

/**
 * The Jev-gated lane's write (only with REFRESH_AI_AUTO_APPLY on): same
 * three-statement shape as the date-only branch — venues UPDATE, audit_log,
 * an already-approved proposal row carrying Jev's verdict — so it stays
 * reversible through audit_log exactly like a human Approve. The caller
 * re-checked computeAutoApplyEligibility, so the one field is phone or url:
 * a plain TEXT column, no hours JSON handling needed.
 */
function buildAiAutoApplyStatements(
  proposal: ProposalDraft,
  now: string,
  sqlText: SqlText,
  tri: { cols: string; vals: string[] },
): string[] {
  const field = reviewableDiffFields(proposal.proposedDiff)[0] as "phone" | "url";
  const before = (proposal.proposedDiff.before ?? {}) as Partial<Venue>;
  const after = (proposal.proposedDiff.after ?? {}) as Partial<Venue>;
  const newValue = (after[field] ?? null) as string | null;
  const newLastVerified = after.last_verified ?? null;
  return [
    `UPDATE venues SET ${field} = ${sqlText(newValue)}, last_verified = ${sqlText(newLastVerified)}, updated_by = ${sqlText(AI_AUTO_APPLY_ACTOR)}, updated_at = ${sqlText(now)} WHERE id = ${sqlText(proposal.targetVenueId)};`,
    "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (" +
      [
        sqlText(AI_AUTO_APPLY_ACTOR),
        sqlText("venue"),
        sqlText(proposal.targetVenueId),
        sqlText("update"),
        sqlText(JSON.stringify({ [field]: before[field] ?? null, last_verified: before.last_verified ?? null })),
        sqlText(JSON.stringify({ [field]: newValue, last_verified: newLastVerified })),
        sqlText(now),
      ].join(", ") +
      ");",
    `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, reviewed_at, applied_at${tri.cols}) VALUES (` +
      [
        sqlText(proposal.source),
        sqlText(proposal.targetVenueId),
        sqlText(proposal.changeType),
        sqlText(JSON.stringify(proposal.proposedDiff)),
        sqlText(proposal.diffHash),
        sqlText(proposal.runId),
        sqlText("approved"),
        sqlText(AI_AUTO_APPLY_ACTOR),
        sqlText(now),
        sqlText(now),
        ...tri.vals,
      ].join(", ") +
      ");",
  ];
}

// ─── The automatic switch (Venue Data Rebuild step 2) ──────────────────────

const SWITCHABLE_SOURCES: ReadonlySet<string> = new Set(SWITCH_SOURCES);

/**
 * True only for a plain update from a switchable source where EVERY field
 * it changes has its pair switched on. Never an add or remove (closures,
 * removals and new venues are always Kyle's), never a value clearing to
 * empty, never a rename, an unconfirmed match or a schedule flagged for
 * review. Pins are checked before this is ever called.
 */
export function isSwitchApplicable(proposal: ProposalDraft, states: SwitchState[]): boolean {
  if (proposal.changeType !== "update" || !SWITCHABLE_SOURCES.has(proposal.source)) return false;
  const meta = proposal.proposedDiff.meta ?? {};
  if (meta.rename || meta.match || meta.needs_review) return false;
  const fields = reviewableDiffFields(proposal.proposedDiff);
  if (fields.length === 0) return false;
  const after = (proposal.proposedDiff.after ?? {}) as Record<string, unknown>;
  return fields.every((f) => {
    const v = after[f];
    return v !== null && v !== undefined && v !== "" && switchIsOn(states, proposal.source, f);
  });
}

/**
 * venues UPDATE + audit_log + an already-approved proposal row + one
 * accepted observation per field. Unlike the older AI lane it does NOT move
 * last_verified: AGENTS.md (step 1) — last_verified moves only on a human
 * approve or edit; a source applying its own change is not a confirmation.
 * The accepted observation is what records which source backs the value.
 */
function buildSwitchApplyStatements(proposal: ProposalDraft, now: string, sqlText: SqlText, tri: { cols: string; vals: string[] }): string[] {
  const fields = reviewableDiffFields(proposal.proposedDiff) as (keyof Venue)[];
  const before = (proposal.proposedDiff.before ?? {}) as Record<string, unknown>;
  const after = (proposal.proposedDiff.after ?? {}) as Record<string, unknown>;
  const literal = (f: keyof Venue, v: unknown) => {
    const col = toColumnValue(f, v);
    return typeof col === "number" ? String(col) : sqlText(col === null || col === undefined ? null : String(col));
  };
  const sets = fields.map((f) => `${f} = ${literal(f, after[f])}`).join(", ");
  const pick = (o: Record<string, unknown>) => Object.fromEntries(fields.map((f) => [f, o[f] ?? null]));
  const observations = fields.map((f) => {
    const col = toColumnValue(f, after[f]);
    const value = (f === "hours_weekly" || f === "hours_irregular") && typeof col === "string" ? col : JSON.stringify(col ?? null);
    return (
      "INSERT INTO venue_observations (venue_id, field, source, value, fetched_at, accepted_at, accepted_by) VALUES (" +
      [sqlText(proposal.targetVenueId), sqlText(f), sqlText(proposal.source), sqlText(value), sqlText(now), sqlText(now), sqlText(AUTO_SWITCH_ACTOR)].join(", ") +
      ");"
    );
  });
  return [
    `UPDATE venues SET ${sets}, updated_by = ${sqlText(AUTO_SWITCH_ACTOR)}, updated_at = ${sqlText(now)} WHERE id = ${sqlText(proposal.targetVenueId)};`,
    "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (" +
      [
        sqlText(AUTO_SWITCH_ACTOR),
        sqlText("venue"),
        sqlText(proposal.targetVenueId),
        sqlText("update"),
        sqlText(JSON.stringify(pick(before))),
        sqlText(JSON.stringify(pick(after))),
        sqlText(now),
      ].join(", ") +
      ");",
    `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, reviewed_at, applied_at${tri.cols}) VALUES (` +
      [
        sqlText(proposal.source),
        sqlText(proposal.targetVenueId),
        sqlText(proposal.changeType),
        sqlText(JSON.stringify(proposal.proposedDiff)),
        sqlText(proposal.diffHash),
        sqlText(proposal.runId),
        sqlText("approved"),
        sqlText(AUTO_SWITCH_ACTOR),
        sqlText(now),
        sqlText(now),
        ...tri.vals,
      ].join(", ") +
      ");",
    ...observations,
  ];
}
