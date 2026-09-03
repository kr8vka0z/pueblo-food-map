// @vitest-environment node
/**
 * Unit tests for src/lib/adminProposals.ts's pure logic — parsing and the
 * §6.10c stale-apply guard. No D1, no fetch — see that file's own header
 * for why these are worth testing in isolation from the route.
 */

import { describe, expect, test } from "vitest";
import {
  checkStaleApply,
  parseProposalRow,
  toColumnValue,
  toTriState,
  type ChangeProposalRow,
  type CurrentVenueLookup,
  type ProposedDiff,
} from "./adminProposals";
import type { AdminVenueRow } from "@/types/venue";

function makeRow(overrides: Partial<ChangeProposalRow> = {}): ChangeProposalRow {
  return {
    id: 1,
    source: "osm",
    target_venue_id: "osm-node-1",
    change_type: "update",
    proposed_diff: JSON.stringify({ before: {}, after: {}, fields_changed: [] } satisfies ProposedDiff),
    diff_hash: "abc123",
    run_id: "local-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    ...overrides,
  };
}

function makeVenue(overrides: Partial<CurrentVenueLookup> = {}): CurrentVenueLookup {
  const base: AdminVenueRow = {
    id: "osm-node-1",
    name: "Eastside Grocery",
    category: "grocery",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: "719-555-0100",
    email: null,
    url: "https://example.com",
    notes: null,
    operator: null,
    source: "OpenStreetMap (node/1)",
    last_verified: "2026-08-01",
    status: "published",
    source_type: "osm",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "seed",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "seed",
    published_at: "2026-01-02T00:00:00.000Z",
    published_by: "seed",
  };
  return { ...base, ...overrides } as CurrentVenueLookup;
}

describe("parseProposalRow", () => {
  test("valid JSON -> parseError: false, diff parsed", () => {
    const diff: ProposedDiff = { before: { phone: "old" }, after: { phone: "new" }, fields_changed: ["phone"] };
    const parsed = parseProposalRow(makeRow({ proposed_diff: JSON.stringify(diff) }));
    expect(parsed.parseError).toBe(false);
    if (!parsed.parseError) expect(parsed.diff).toEqual(diff);
  });

  test("malformed JSON -> parseError: true, degrades instead of throwing", () => {
    const parsed = parseProposalRow(makeRow({ proposed_diff: "{not valid json" }));
    expect(parsed.parseError).toBe(true);
    expect(parsed.diff).toBeNull();
  });
});

describe("checkStaleApply — change_type 'add'", () => {
  const diff: ProposedDiff = { before: null, after: { name: "New Spot" }, fields_changed: ["name"] };

  test("no existing row -> not stale (the common fresh-add case)", () => {
    expect(checkStaleApply("add", null, diff)).toEqual({ stale: false });
  });

  test("existing row is archived -> not stale (this is a restore, §6.7)", () => {
    const result = checkStaleApply("add", makeVenue({ status: "archived" }), diff);
    expect(result.stale).toBe(false);
  });

  test("existing row is NOT archived -> stale (real id conflict)", () => {
    const result = checkStaleApply("add", makeVenue({ status: "published" }), diff);
    expect(result.stale).toBe(true);
    expect(result.reason).toMatch(/already exists/);
  });
});

describe("checkStaleApply — change_type 'remove'", () => {
  const diff: ProposedDiff = { before: { id: "osm-node-1", name: "X" }, after: null, fields_changed: [] };

  test("row still exists, non-archived -> not stale", () => {
    expect(checkStaleApply("remove", makeVenue({ status: "published" }), diff)).toEqual({ stale: false });
  });

  test("row no longer exists -> stale", () => {
    const result = checkStaleApply("remove", null, diff);
    expect(result.stale).toBe(true);
    expect(result.reason).toMatch(/no longer exists/);
  });

  test("row already archived -> stale (already removed)", () => {
    const result = checkStaleApply("remove", makeVenue({ status: "archived" }), diff);
    expect(result.stale).toBe(true);
    expect(result.reason).toMatch(/already removed/);
  });
});

describe("checkStaleApply — change_type 'update' (the scoped, per-field check)", () => {
  test("target archived since the proposal was written -> stale", () => {
    const diff: ProposedDiff = { before: { phone: "719-555-0100" }, after: { phone: "719-555-0199" }, fields_changed: ["phone"] };
    const result = checkStaleApply("update", makeVenue({ status: "archived" }), diff);
    expect(result.stale).toBe(true);
  });

  test("target gone entirely -> stale", () => {
    const diff: ProposedDiff = { before: { phone: "719-555-0100" }, after: { phone: "719-555-0199" }, fields_changed: ["phone"] };
    expect(checkStaleApply("update", null, diff).stale).toBe(true);
  });

  test("current row's changed field still matches `before` -> not stale, applies cleanly", () => {
    const diff: ProposedDiff = { before: { phone: "719-555-0100" }, after: { phone: "719-555-0199" }, fields_changed: ["phone"] };
    const result = checkStaleApply("update", makeVenue({ phone: "719-555-0100" }), diff);
    expect(result).toEqual({ stale: false });
  });

  test("current row's changed field DIVERGED from `before` (an admin hand-edited it since) -> stale", () => {
    const diff: ProposedDiff = { before: { phone: "719-555-0100" }, after: { phone: "719-555-0199" }, fields_changed: ["phone"] };
    // The admin already changed the phone number by hand to something else
    // entirely between when this proposal was generated and now.
    const result = checkStaleApply("update", makeVenue({ phone: "719-555-9999" }), diff);
    expect(result.stale).toBe(true);
    expect(result.reason).toMatch(/"phone"/);
  });

  test("scoped to fields_changed ONLY — an unrelated field diverging does NOT trip staleness (§6.10c's #235 reconciliation)", () => {
    // The proposal only asserts something about `phone`. The venue's `url`
    // has ALSO changed since (e.g. a separate link_health proposal already
    // applied and cleared it) — that must not make THIS proposal stale, or
    // two independently-approvable proposals for the same venue would
    // falsely conflict (see this file's own header + AGENTS.md's #235 note).
    const diff: ProposedDiff = { before: { phone: "719-555-0100" }, after: { phone: "719-555-0199" }, fields_changed: ["phone"] };
    const result = checkStaleApply("update", makeVenue({ phone: "719-555-0100", url: null }), diff);
    expect(result).toEqual({ stale: false });
  });

  test("hours_weekly comparison normalizes object vs. JSON-string form the same way diffEngine does", () => {
    const diff: ProposedDiff = {
      before: { hours_weekly: { mon: ["9:00-17:00"] } },
      after: { hours_weekly: { mon: ["8:00-18:00"] } },
      fields_changed: ["hours_weekly"],
    };
    const result = checkStaleApply(
      "update",
      makeVenue({ hours_weekly: JSON.stringify({ mon: ["9:00-17:00"] }) }),
      diff,
    );
    expect(result).toEqual({ stale: false });
  });
});

describe("toColumnValue", () => {
  test("hours_weekly object -> JSON text", () => {
    expect(toColumnValue("hours_weekly", { mon: ["9:00-17:00"] })).toBe(JSON.stringify({ mon: ["9:00-17:00"] }));
  });

  test("hours_weekly null/undefined -> null", () => {
    expect(toColumnValue("hours_weekly", null)).toBeNull();
    expect(toColumnValue("hours_weekly", undefined)).toBeNull();
  });

  test("plain field undefined -> null (D1 has no `undefined`)", () => {
    expect(toColumnValue("phone", undefined)).toBeNull();
  });

  test("plain field passes through", () => {
    expect(toColumnValue("phone", "719-555-0100")).toBe("719-555-0100");
    expect(toColumnValue("url", null)).toBeNull();
  });
});

describe("toTriState", () => {
  test("undefined -> null (unknown)", () => {
    expect(toTriState(undefined)).toBeNull();
  });
  test("true -> 1, false -> 0", () => {
    expect(toTriState(true)).toBe(1);
    expect(toTriState(false)).toBe(0);
  });
});
