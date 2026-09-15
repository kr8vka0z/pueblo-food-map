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

import { isDateOnlyUpdateProposal } from "@/lib/adminProposals";
import type { Venue } from "@/types/venue";
import type { ProposalDraft } from "./diffEngine";

export interface ProposalWriteStatements {
  /** true = this proposal auto-applied to `venues` this run (date-only); false = it was written as a normal pending row for a human to review. */
  autoApplied: boolean;
  statements: string[];
}

const AUTO_APPLY_ACTOR = "refresh-pipeline";

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
  sqlText: (value: string | null | undefined) => string,
): ProposalWriteStatements {
  const dateOnly = isDateOnlyUpdateProposal(
    { change_type: proposal.changeType, source: proposal.source },
    proposal.proposedDiff,
  );

  if (!dateOnly) {
    return {
      autoApplied: false,
      statements: [
        "INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES (" +
          [
            sqlText(proposal.source),
            sqlText(proposal.targetVenueId),
            sqlText(proposal.changeType),
            sqlText(JSON.stringify(proposal.proposedDiff)),
            sqlText(proposal.diffHash),
            sqlText(proposal.runId),
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
