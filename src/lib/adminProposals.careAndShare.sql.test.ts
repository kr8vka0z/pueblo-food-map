// @vitest-environment node
/**
 * Real-SQLite proof of the two approval paths Care and Share proposals
 * (Venue Data Rebuild step 2) need: approving an unconfirmed match records
 * the alias so it never asks again, and approving a Care and Share "add"
 * creates the venue even though venues.source_type has no
 * 'care_and_share' value (it is created as 'manual').
 */

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { applyApprovedProposal, venueSourceTypeFor, type ChangeProposalRow } from "@/lib/adminProposals";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, f), "utf-8"));
  }
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, phone, source, last_verified, status, source_type, created_by, updated_by)
     VALUES ('plentiful-x', 'X Pantry', 'pantry', 38.2, -104.6, '1 Main St, Pueblo, CO', NULL, 'plentiful', '2026-05-14', 'published', 'plentiful', 'seed', 'seed')`,
  ).run();
  return db;
}

function proposal(db: Database.Database, target: string, changeType: string, diff: Record<string, unknown>): ChangeProposalRow {
  const id = Number(
    db
      .prepare(
        `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES ('care_and_share', ?, ?, ?, 'h', 'r')`,
      )
      .run(target, changeType, JSON.stringify(diff)).lastInsertRowid,
  );
  return db.prepare("SELECT * FROM change_proposals WHERE id = ?").get(id) as ChangeProposalRow;
}

describe("Care and Share approvals", () => {
  test("approving an unconfirmed match records the alias and applies the change", async () => {
    const db = buildDb();
    const row = proposal(db, "plentiful-x", "update", {
      before: { phone: null, last_verified: "2026-05-14" },
      after: { phone: "719-555-0100", last_verified: "2026-10-26" },
      fields_changed: ["phone", "last_verified"],
      meta: { locationId: 7, match: { upstream_id: "cas-7" } },
    });
    const result = await applyApprovedProposal(sqliteD1(db), row, { email: "kyle@example.com" });
    expect(result.ok).toBe(true);
    expect(db.prepare("SELECT source, upstream_id, venue_id FROM venue_id_aliases").all()).toEqual([
      { source: "care_and_share", upstream_id: "cas-7", venue_id: "plentiful-x" },
    ]);
    expect(db.prepare("SELECT phone FROM venues WHERE id = 'plentiful-x'").get()).toEqual({ phone: "719-555-0100" });
  });

  test("approving a duplicate-listing card records every listed id as this venue", async () => {
    const db = buildDb();
    const row = proposal(db, "plentiful-x", "update", {
      before: { last_verified: "2026-05-14" },
      after: { last_verified: "2026-10-26" },
      fields_changed: ["last_verified"],
      meta: { match: { upstream_ids: ["cas-7", "cas-8"] } },
    });
    expect((await applyApprovedProposal(sqliteD1(db), row, { email: "kyle@example.com" })).ok).toBe(true);
    expect(db.prepare("SELECT upstream_id FROM venue_id_aliases ORDER BY upstream_id").all()).toEqual([
      { upstream_id: "cas-7" },
      { upstream_id: "cas-8" },
    ]);
  });

  test("approving a Care and Share add creates a 'manual' venue (venues.source_type has no care_and_share)", async () => {
    const db = buildDb();
    const after = { id: "cas-9", name: "New Pantry", category: "pantry", lat: 38.25, lng: -104.6, address: "2 Main St, Pueblo, CO 81003", source: "careandshare.org/findfood", last_verified: "2026-10-26" };
    const row = proposal(db, "cas-9", "add", { before: null, after, fields_changed: Object.keys(after) });
    const result = await applyApprovedProposal(sqliteD1(db), row, { email: "kyle@example.com" });
    expect(result.ok).toBe(true);
    expect(db.prepare("SELECT source_type, status FROM venues WHERE id = 'cas-9'").get()).toEqual({ source_type: "manual", status: "draft" });
  });

  test("venueSourceTypeFor keeps scraper sources and maps the rest to manual", () => {
    expect(venueSourceTypeFor("plentiful")).toBe("plentiful");
    expect(venueSourceTypeFor("osm")).toBe("osm");
    expect(venueSourceTypeFor("care_and_share")).toBe("manual");
  });
});
