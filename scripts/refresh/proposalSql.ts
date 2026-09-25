/**
 * proposalSql.ts — builds the SQL statement(s) refresh-ingest.ts writes for
 * ONE proposal (extracted so it's unit-testable: refresh-ingest.ts calls
 * main() at import time, so nothing in that file can be tested directly —
 * same reasoning sqlChunks.ts's own header gives for living beside
 * diffEngine.ts here instead).
 *
 * WHY a "date-only" proposal auto-applies instead of writing a pending row
 * for a human to click (Kyle, 2026-09-15): "If the only proposed change is
 * just the 'last checked date' that doesn't need a manual approval." ~86 of
 * ~104 proposals in a real run were exactly this shape (change_type
 * 'update', fields_changed exactly ["last_verified"]) — a pure freshness
 * confirmation, nothing a human review actually protects against. This is
 * the ONE exception to this pipeline's "never write to venues" guarantee
 * (see refresh-ingest.ts's file header for the exact carve-out) — bounded
 * to a single column whose value the job itself computes (today's date),
 * under the SAME least-privilege D1 token as every other write this job
 * makes. Every auto-applied proposal still lands the identical
 * change_proposals + audit_log trail a human Approve click would produce
 * (status='approved', actor 'refresh-pipeline' in place of a reviewing
 * admin's email) — nothing about the review queue's audit guarantees is
 * weakened, only the "someone has to click" step for this one narrow,
 * low-risk case. Reuses `isDateOnlyUpdateProposal` (src/lib/adminProposals.ts)
 * rather than a second definition — the exact predicate the /admin/flags
 * "Approve all date-only" button already uses, so the two can never
 * silently diverge on what "date-only" means.
 */

import { isDateOnlyUpdateProposal, reviewableDiffFields } from "@/lib/adminProposals";
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

export interface ProposalWriteOptions {
  /** Jev's verdict for this proposal (scripts/refresh/triage.ts); absent = written untriaged, triage_* columns left NULL. */
  triage?: TriageResult | null;
  /**
   * REFRESH_AI_AUTO_APPLY (default OFF). When on, an `auto_apply_candidate`
   * that ALSO re-passes the deterministic formatting-only check is applied
   * like a date-only bump, under AI_AUTO_APPLY_ACTOR. Off → it is written
   * as a normal pending row with its lane stored.
   */
  aiAutoApply?: boolean;
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
  if (options.aiAutoApply && options.triage?.lane === "auto_apply_candidate" && computeAutoApplyEligibility(proposal)) {
    return { autoApplied: true, statements: buildAiAutoApplyStatements(proposal, now, sqlText, tri) };
  }

  const dateOnly = isDateOnlyUpdateProposal(
    { change_type: proposal.changeType, source: proposal.source },
    proposal.proposedDiff,
  );

  if (!dateOnly) {
    return {
      autoApplied: false,
      statements: [
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
          ");",
      ],
    };
  }

  const before = (proposal.proposedDiff.before ?? {}) as Partial<Venue>;
  const after = (proposal.proposedDiff.after ?? {}) as Partial<Venue>;
  const beforeLastVerified = before.last_verified ?? null;
  const newLastVerified = after.last_verified ?? null;

  const statements = [
    `UPDATE venues SET last_verified = ${sqlText(newLastVerified)}, updated_by = ${sqlText(AUTO_APPLY_ACTOR)}, updated_at = ${sqlText(now)} WHERE id = ${sqlText(proposal.targetVenueId)};`,
    // Mirrors applyApprovedProposal()'s AUDIT_INSERT_SQL shape exactly
    // (src/lib/adminProposals.ts) — same column order/meaning, so this
    // auto-applied row is indistinguishable in audit_log from one a human
    // reviewer's Approve click would have written.
    "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (" +
      [
        sqlText(AUTO_APPLY_ACTOR),
        sqlText("venue"),
        sqlText(proposal.targetVenueId),
        sqlText("update"),
        sqlText(JSON.stringify({ last_verified: beforeLastVerified })),
        sqlText(JSON.stringify({ last_verified: newLastVerified })),
        sqlText(now),
      ].join(", ") +
      ");",
    // Written already-'approved' (not the DEFAULT 'pending' the normal
    // INSERT above relies on) so this row still carries a complete,
    // queryable review trail — who/when — even though no human clicked it.
    "INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, reviewed_at, applied_at) VALUES (" +
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
        sqlText(now),
      ].join(", ") +
      ");",
  ];

  return { autoApplied: true, statements };
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
