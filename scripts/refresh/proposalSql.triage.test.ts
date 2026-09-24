// proposalSql.triage.test.ts — triage columns on the written row, and the REFRESH_AI_AUTO_APPLY-gated lane (#543).
import { describe, expect, test } from "vitest";
import { buildProposalWriteStatements } from "./proposalSql";
import type { ProposalDraft } from "./diffEngine";
import type { TriageResult } from "./triage";

function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

const NOW = "2026-09-28T06:00:00.000Z";

function phoneReformat(): ProposalDraft {
  return {
    source: "osm",
    targetVenueId: "osm-node-9",
    changeType: "update",
    proposedDiff: {
      before: { phone: "719-555-0100", last_verified: "2026-08-01" },
      after: { phone: "(719) 555-0100", last_verified: "2026-09-28" },
      fields_changed: ["phone", "last_verified"],
    },
    diffHash: "h",
    runId: "run-1",
  };
}

const autoCandidate: TriageResult = {
  lane: "auto_apply_candidate",
  model: "jev-1.13.0",
  questionSet: "v1",
  answers: { real_change: { noul: 0.01 } },
};

describe("buildProposalWriteStatements with triage", () => {
  test("a triaged pending row carries lane, json, model and timestamp", () => {
    const { autoApplied, statements } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, {
      triage: { ...autoCandidate, lane: "likely_noise" },
    });
    expect(autoApplied).toBe(false);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("triage_lane, triage_json, triage_model, triage_at");
    expect(statements[0]).toContain("'likely_noise'");
    expect(statements[0]).toContain("'jev-1.13.0'");
    expect(statements[0]).toContain(`'${NOW}'`);
    expect(statements[0]).toContain('"real_change":{"noul":0.01}');
  });

  test("untriaged (no key / outage) writes the exact pre-#543 INSERT", () => {
    const { statements } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, { triage: null });
    expect(statements[0]).not.toContain("triage_");
    expect(statements[0]).toMatch(/^INSERT INTO change_proposals \(source, target_venue_id, change_type, proposed_diff, diff_hash, run_id\) VALUES/);
  });

  test("auto_apply_candidate with the flag OFF (default) stays a pending row — no venues write", () => {
    const { autoApplied, statements } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, { triage: autoCandidate });
    expect(autoApplied).toBe(false);
    expect(statements.some((s) => s.startsWith("UPDATE venues"))).toBe(false);
    expect(statements[0]).toContain("'auto_apply_candidate'");
  });

  test("flag ON: applies the field + last_verified under refresh-pipeline-ai with audit_log and an approved row", () => {
    const { autoApplied, statements } = buildProposalWriteStatements(phoneReformat(), NOW, sqlText, {
      triage: autoCandidate,
      aiAutoApply: true,
    });
    expect(autoApplied).toBe(true);
    expect(statements[0]).toBe(
      `UPDATE venues SET phone = '(719) 555-0100', last_verified = '2026-09-28', updated_by = 'refresh-pipeline-ai', updated_at = '${NOW}' WHERE id = 'osm-node-9';`,
    );
    expect(statements[1]).toContain("INSERT INTO audit_log");
    expect(statements[1]).toContain('{"phone":"719-555-0100","last_verified":"2026-08-01"}');
    expect(statements[2]).toContain("'approved'");
    expect(statements[2]).toContain("'refresh-pipeline-ai'");
    expect(statements[2]).toContain("'auto_apply_candidate'");
  });

  test("flag ON never applies a lane that fails the deterministic re-check (a real phone change)", () => {
    const real = phoneReformat();
    real.proposedDiff.after = { phone: "719-555-0199", last_verified: "2026-09-28" };
    const { autoApplied } = buildProposalWriteStatements(real, NOW, sqlText, { triage: autoCandidate, aiAutoApply: true });
    expect(autoApplied).toBe(false);
  });
});
