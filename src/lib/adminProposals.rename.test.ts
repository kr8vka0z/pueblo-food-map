// @vitest-environment node
// adminProposals.rename.test.ts — approving a rename proposal (#543) + the review-lane helpers.
import { describe, expect, test } from "vitest";
import type { AdminVenueRow } from "@/types/venue";
import {
  applyApprovedProposal,
  isDateOnlyUpdateProposal,
  reviewLaneOf,
  type ChangeProposalRow,
  type ProposedDiff,
} from "@/lib/adminProposals";

interface Stmt {
  sql: string;
  args: unknown[];
}

/** Minimal D1 fake: `first()` returns `venue`, `batch()` records statements and reports 1 change each. */
function fakeDb(venue: AdminVenueRow) {
  const batches: Stmt[][] = [];
  const db = {
    prepare(sql: string) {
      const stmt = {
        sql,
        args: [] as unknown[],
        bind(...args: unknown[]) {
          stmt.args = args;
          return stmt;
        },
        first: async () => venue,
        run: async () => ({ meta: { changes: 1 } }),
      };
      return stmt;
    },
    batch: async (stmts: Stmt[]) => {
      batches.push(stmts.map((s) => ({ sql: s.sql, args: s.args })));
      return stmts.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return { db: db as unknown as D1Database, batches };
}

function venue(): AdminVenueRow {
  return {
    id: "plentiful-old-name",
    name: "Old Name Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: "719-555-0100",
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Plentiful",
    last_verified: "2026-08-01",
    status: "published",
    source_type: "plentiful",
    outside_county: 0,
    created_at: "2026-05-01T00:00:00.000Z",
    created_by: "seed",
    updated_at: "2026-05-01T00:00:00.000Z",
    updated_by: "seed",
    published_at: "2026-05-01T00:00:00.000Z",
    published_by: "seed",
  };
}

const renameDiff: ProposedDiff = {
  before: { name: "Old Name Pantry", last_verified: "2026-08-01" },
  after: { name: "New Name Pantry", last_verified: "2026-09-28" },
  fields_changed: ["name", "last_verified"],
  meta: { rename: { from_id: "plentiful-old-name", to_id: "plentiful-new-name", matched_by: "coordinates", distance_m: 12 } },
};

function proposalRow(diff: ProposedDiff): ChangeProposalRow {
  return {
    id: 7,
    source: "plentiful",
    target_venue_id: "plentiful-old-name",
    change_type: "update",
    proposed_diff: JSON.stringify(diff),
    diff_hash: "h",
    run_id: "run-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-28T06:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
  };
}

describe("applyApprovedProposal — rename", () => {
  test("updates the OLD id in place and records the new upstream id as an alias, in the same batch", async () => {
    const { db, batches } = fakeDb(venue());
    const result = await applyApprovedProposal(db, proposalRow(renameDiff), { email: "admin@example.com" });
    expect(result).toMatchObject({ ok: true, targetVenueId: "plentiful-old-name" });
    const [batch] = batches;
    expect(batch[0].sql).toMatch(/^UPDATE venues SET name = \?, last_verified = \?/);
    expect(batch[0].args.at(-1)).toBe("plentiful-old-name");
    expect(batch[3].sql).toContain("INSERT OR REPLACE INTO venue_id_aliases");
    expect(batch[3].args.slice(0, 3)).toEqual(["plentiful", "plentiful-new-name", "plentiful-old-name"]);
    expect(batch[3].args[4]).toBe("admin@example.com");
  });

  test("a plain update writes no alias", async () => {
    const { db, batches } = fakeDb(venue());
    const plain = { ...renameDiff, meta: undefined };
    await applyApprovedProposal(db, proposalRow(plain), { email: "admin@example.com" });
    expect(batches[0]).toHaveLength(3);
  });
});

describe("isDateOnlyUpdateProposal", () => {
  test("a rename with no field change beyond last_verified is NOT date-only (never auto/bulk-applied)", () => {
    const idOnly: ProposedDiff = { ...renameDiff, before: { last_verified: "x" }, after: { last_verified: "y" }, fields_changed: ["last_verified"] };
    expect(isDateOnlyUpdateProposal({ change_type: "update", source: "plentiful" }, idOnly)).toBe(false);
  });
});

describe("reviewLaneOf", () => {
  const plain: ProposedDiff = { before: {}, after: {}, fields_changed: ["phone"] };
  test("untriaged (NULL) reads as needs a human", () => {
    expect(reviewLaneOf({ triage_lane: null }, plain)).toBe("needs_human");
    expect(reviewLaneOf({}, null)).toBe("needs_human");
  });
  test("an unapplied auto_apply_candidate reads as likely noise", () => {
    expect(reviewLaneOf({ triage_lane: "auto_apply_candidate" }, plain)).toBe("likely_noise");
    expect(reviewLaneOf({ triage_lane: "likely_noise" }, plain)).toBe("likely_noise");
  });
  test("a rename proposal is likely rename even untriaged", () => {
    expect(reviewLaneOf({ triage_lane: null }, renameDiff)).toBe("likely_rename");
  });
});
