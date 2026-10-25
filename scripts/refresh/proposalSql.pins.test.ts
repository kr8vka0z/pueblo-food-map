// proposalSql.pins.test.ts — a field the venue told us (a venue_direct pin) never auto-applies (Venue Data Rebuild step 1).
import { describe, expect, test } from "vitest";
import { buildProposalWriteStatements, type PinRow } from "./proposalSql";
import type { ProposalDraft } from "./diffEngine";
import type { TriageResult } from "./triage";

function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

const NOW = "2026-10-26T06:00:00.000Z";

// A formatting-only phone change Jev would pass: the one shape that DOES
// auto-apply with REFRESH_AI_AUTO_APPLY on — the lane a pin must still block.
function phoneReformat(): ProposalDraft {
  return {
    source: "plentiful",
    targetVenueId: "venue-1",
    changeType: "update",
    proposedDiff: {
      before: { phone: "719-555-0100", last_verified: "2026-10-12" },
      after: { phone: "(719) 555-0100", last_verified: "2026-10-26" },
      fields_changed: ["phone", "last_verified"],
    },
    diffHash: "h",
    runId: "run-1",
  };
}

const autoCandidate: TriageResult = { lane: "auto_apply_candidate", model: "jev-1.13.0", questionSet: "v1", answers: {} };

function pin(overrides: Partial<PinRow> = {}): PinRow {
  return { venue_id: "venue-1", field: "phone", fetched_at: "2026-10-12T00:00:00.000Z", pinned_by: "admin", pin_note: "Heather, by phone", ...overrides };
}

/** The proposed_diff JSON as written: the one quoted value that starts with {"before". */
function storedDiff(statement: string) {
  const literal = statement.match(/'(\{"before"(?:[^']|'')*)'/)![1];
  return JSON.parse(literal.replace(/''/g, "'"));
}

describe("pinned fields", () => {
  test("a pinned field never auto-applies, even through the AI lane with the flag on, and carries the pin for review", () => {
    const { autoApplied, statements } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, {
      triage: autoCandidate,
      aiAutoApply: true,
      pins: [pin()],
    });
    expect(autoApplied).toBe(false);
    expect(statements).toHaveLength(1);
    expect(statements[0]).not.toContain("UPDATE venues");
    expect(statements[0]).not.toContain("'approved'");
    expect(storedDiff(statements[0]).meta.pins).toEqual([
      { field: "phone", pinned_at: "2026-10-12T00:00:00.000Z", pinned_by: "admin", note: "Heather, by phone", age_days: 14, stale: false },
    ]);
  });

  test("a pin on another field or another venue doesn't block the change", () => {
    const { autoApplied } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, {
      triage: autoCandidate,
      aiAutoApply: true,
      pins: [pin({ field: "hours_irregular" }), pin({ venue_id: "venue-2" })],
    });
    expect(autoApplied).toBe(true);
  });

  test("a pin older than 12 months is marked stale (still goes to review)", () => {
    const { autoApplied, statements } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, {
      pins: [pin({ fetched_at: "2025-09-01T00:00:00.000Z" })],
    });
    expect(autoApplied).toBe(false);
    expect(storedDiff(statements[0]).meta.pins[0].stale).toBe(true);
  });

  test("the pin rides in meta only, so rejection memory's diff_hash is unchanged", () => {
    const { statements } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, { pins: [pin()] });
    expect(statements[0]).toContain("'h'");
  });
});
