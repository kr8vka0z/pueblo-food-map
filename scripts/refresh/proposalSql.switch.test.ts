// proposalSql.switch.test.ts — the automatic switch's write lane (Venue Data
// Rebuild step 2): applies only a switched-on pair's plain change, never a
// pinned field, a clear, an add/remove, or anything flagged for review; and
// its SQL runs against the real schema without moving last_verified.
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { buildProposalWriteStatements, type PinRow } from "./proposalSql";
import type { ProposalDraft } from "./diffEngine";
import type { SwitchState } from "@/lib/sourceSwitch";

function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

const NOW = "2026-10-26T06:00:00.000Z";

function casUpdate(after: Record<string, unknown>, before: Record<string, unknown>, overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  const fields = Object.keys(after);
  return {
    source: "care_and_share",
    targetVenueId: "venue-1",
    changeType: "update",
    proposedDiff: {
      before: { ...before, last_verified: "2026-10-01" },
      after: { ...after, last_verified: "2026-10-26" },
      fields_changed: [...fields, "last_verified"],
      meta: { locationId: 7, fetched_at: NOW },
    },
    diffHash: "h",
    runId: "run-1",
    ...overrides,
  };
}

const on = (field: string, source = "care_and_share"): SwitchState => ({ source, field, streak: 5, on: true });
const NEW_HOURS = JSON.stringify({ tue: ["10:00-12:00"] });

describe("switch lane — what auto-applies", () => {
  test("a switched-on pair's change applies, as the auto actor, with an accepted observation", () => {
    const { autoApplied, statements } = buildProposalWriteStatements(casUpdate({ phone: "719-555-0200" }, { phone: "719-555-0100" }), NOW, sqlText, {
      switchStates: [on("phone")],
    });
    expect(autoApplied).toBe(true);
    const sql = statements.join("\n");
    expect(sql).toContain("UPDATE venues SET phone = '719-555-0200'");
    expect(sql).not.toMatch(/last_verified =/);
    expect(sql).toContain("'refresh-pipeline-auto'");
    expect(sql).toContain("INSERT INTO venue_observations");
  });

  test.each<[string, ProposalDraft, SwitchState[], PinRow[]?]>([
    ["pair off", casUpdate({ phone: "719-555-0200" }, { phone: "719-555-0100" }), []],
    ["one of two fields off", casUpdate({ phone: "719-555-0200", hours_weekly: NEW_HOURS }, { phone: "1", hours_weekly: "" }), [on("phone")]],
    [
      "pinned field",
      casUpdate({ phone: "719-555-0200" }, { phone: "719-555-0100" }),
      [on("phone")],
      [{ venue_id: "venue-1", field: "phone", fetched_at: "2026-10-12T00:00:00.000Z", pinned_by: "a", pin_note: null }],
    ],
    ["clears a value", casUpdate({ hours_irregular: "" }, { hours_irregular: "[{}]" }), [on("hours_irregular")]],
    ["schedule needs review", casUpdate({ phone: "719-555-0200" }, { phone: "1" }, { proposedDiff: { ...casUpdate({ phone: "719-555-0200" }, { phone: "1" }).proposedDiff, meta: { needs_review: ["note"] } } }), [on("phone")]],
    ["unconfirmed match", casUpdate({ phone: "719-555-0200" }, { phone: "1" }, { proposedDiff: { ...casUpdate({ phone: "719-555-0200" }, { phone: "1" }).proposedDiff, meta: { match: { upstream_id: "cas-7" } } } }), [on("phone")]],
    ["an add", casUpdate({ phone: "719-555-0200" }, {}, { changeType: "add" }), [on("phone")]],
    ["a remove", { ...casUpdate({}, {}), changeType: "remove", proposedDiff: { before: { id: "venue-1" }, after: null, fields_changed: [] } }, [on("phone")]],
    ["another source, even switched on", casUpdate({ phone: "719-555-0200" }, { phone: "1" }, { source: "plentiful" }), [on("phone", "plentiful")]],
  ])("%s -> written for review, nothing applied", (_label, proposal, switchStates, pins) => {
    const { autoApplied, statements } = buildProposalWriteStatements(proposal, NOW, sqlText, { switchStates, pins });
    expect(autoApplied).toBe(false);
    expect(statements.join("\n")).not.toContain("UPDATE venues");
  });
});

describe("switch lane — real schema", () => {
  test("hours apply as JSON text; last_verified and the published flag are untouched", () => {
    const db = new Database(":memory:");
    const dir = join(process.cwd(), "migrations");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf-8"));
    db.prepare(
      `INSERT INTO venues (id, name, category, lat, lng, address, hours_weekly, source, last_verified, status, source_type, created_by, updated_by)
       VALUES ('venue-1', 'X', 'pantry', 38.2, -104.6, '1 Main St', '{"mon":["10:00-12:00"]}', 'plentiful', '2026-10-01', 'published', 'plentiful', 's', 's')`,
    ).run();
    const { statements } = buildProposalWriteStatements(casUpdate({ hours_weekly: NEW_HOURS }, { hours_weekly: '{"mon":["10:00-12:00"]}' }), NOW, sqlText, {
      switchStates: [on("hours_weekly")],
    });
    db.exec(statements.join("\n"));
    expect(db.prepare("SELECT hours_weekly, last_verified, updated_by FROM venues WHERE id = 'venue-1'").get()).toEqual({
      hours_weekly: NEW_HOURS,
      last_verified: "2026-10-01",
      updated_by: "refresh-pipeline-auto",
    });
    expect(db.prepare("SELECT status, reviewed_by, applied_at FROM change_proposals").get()).toEqual({
      status: "approved",
      reviewed_by: "refresh-pipeline-auto",
      applied_at: NOW,
    });
    expect(db.prepare("SELECT field, source, value, accepted_by FROM venue_observations").get()).toEqual({
      field: "hours_weekly",
      source: "care_and_share",
      value: NEW_HOURS,
      accepted_by: "refresh-pipeline-auto",
    });
  });
});
