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
  // Venue Data Rebuild step 1: "Stop the automatic 'last checked' bump from
  // counting a download as a confirmation." A date-only run records a fetch
  // observation; venues and audit_log are not written.
  test("a date-only osm/plentiful update records a fetch observation and never touches venues.last_verified", () => {
    const result = buildProposalWriteStatements(dateOnlyProposal(), "2026-09-15T12:00:00.000Z", sqlText);

    expect(result.autoApplied).toBe(true);
    expect(result.statements).toHaveLength(2);
    expect(result.statements.join("\n")).not.toContain("UPDATE venues");
    expect(result.statements.join("\n")).not.toContain("audit_log");
    expect(result.statements[0]).toBe(
      "INSERT INTO venue_observations (venue_id, field, source, value, fetched_at) VALUES ('osm-node-123', 'listed', 'osm', 'true', '2026-09-15T12:00:00.000Z');",
    );
    // Kept for refreshAlerts.ts's per-source staleness check; applied_at
    // stays NULL because nothing was applied.
    expect(result.statements[1]).toContain("INSERT INTO change_proposals");
    expect(result.statements[1]).toContain("'approved'");
    expect(result.statements[1]).not.toContain("applied_at");
  });

  test("without migration 0021 the date-only path skips the observation instead of failing the batch", () => {
    const result = buildProposalWriteStatements(dateOnlyProposal(), "2026-09-15T12:00:00.000Z", sqlText, { observationsReady: false });
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]).toContain("INSERT INTO change_proposals");
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
