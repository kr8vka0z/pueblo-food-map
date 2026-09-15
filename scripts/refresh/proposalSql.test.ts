import { describe, test, expect } from "vitest";
import { buildProposalWriteStatements } from "./proposalSql";
import type { ProposalDraft } from "./diffEngine";

// Mirrors refresh-ingest.ts's own sqlText() exactly — kept local to this
// test file rather than imported (that helper is deliberately private to
// the script, see refresh-ingest.ts's "SQL literal helpers" header).
function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function dateOnlyProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    source: "osm",
    targetVenueId: "osm-node-123",
    changeType: "update",
    proposedDiff: {
      before: { last_verified: "2026-08-01" },
      after: { last_verified: "2026-09-15" },
      fields_changed: ["last_verified"],
    },
    diffHash: "hash-date-only",
    runId: "run-1",
    ...overrides,
  };
}

describe("buildProposalWriteStatements", () => {
  test("a date-only osm/plentiful update auto-applies: venues UPDATE + audit_log INSERT + already-approved change_proposals row", () => {
    const result = buildProposalWriteStatements(dateOnlyProposal(), "2026-09-15T12:00:00.000Z", sqlText);

    expect(result.autoApplied).toBe(true);
    expect(result.statements).toHaveLength(3);
    expect(result.statements[0]).toBe(
      "UPDATE venues SET last_verified = '2026-09-15', updated_by = 'refresh-pipeline', updated_at = '2026-09-15T12:00:00.000Z' WHERE id = 'osm-node-123';",
    );
    expect(result.statements[1]).toContain("INSERT INTO audit_log");
    expect(result.statements[1]).toContain("'refresh-pipeline'");
    expect(result.statements[2]).toContain("INSERT INTO change_proposals");
    expect(result.statements[2]).toContain("'approved'");
    expect(result.statements[2]).toContain("'refresh-pipeline'");
  });

  test("a real change (fields_changed includes more than last_verified) writes only a pending change_proposals row — no venues write", () => {
    const proposal: ProposalDraft = {
      source: "osm",
      targetVenueId: "osm-node-456",
      changeType: "update",
      proposedDiff: {
        before: { phone: "555-0000", last_verified: "2026-08-01" },
        after: { phone: "555-1111", last_verified: "2026-09-15" },
        fields_changed: ["phone", "last_verified"],
      },
      diffHash: "hash-real-change",
      runId: "run-1",
    };

    const result = buildProposalWriteStatements(proposal, "2026-09-15T12:00:00.000Z", sqlText);

    expect(result.autoApplied).toBe(false);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]).toContain("INSERT INTO change_proposals");
    expect(result.statements[0]).not.toContain("UPDATE venues");
    expect(result.statements[0]).not.toContain("audit_log");
    // No status column at all — relies on the table's own DEFAULT 'pending'.
    expect(result.statements[0]).not.toContain("'approved'");
  });

  test("link_health never auto-applies even if it somehow carried only last_verified — it's excluded by source, not shape", () => {
    const proposal = dateOnlyProposal({ source: "link_health" });
    const result = buildProposalWriteStatements(proposal, "2026-09-15T12:00:00.000Z", sqlText);
    expect(result.autoApplied).toBe(false);
    expect(result.statements).toHaveLength(1);
  });

  test("an add proposal (never date-only shaped) always writes a pending row", () => {
    const proposal: ProposalDraft = {
      source: "plentiful",
      targetVenueId: "plentiful-new-place",
      changeType: "add",
      proposedDiff: {
        before: null,
        after: { name: "New Place", last_verified: "2026-09-15" },
        fields_changed: ["name", "last_verified"],
      },
      diffHash: "hash-add",
      runId: "run-1",
    };
    const result = buildProposalWriteStatements(proposal, "2026-09-15T12:00:00.000Z", sqlText);
    expect(result.autoApplied).toBe(false);
    expect(result.statements).toHaveLength(1);
  });
});
