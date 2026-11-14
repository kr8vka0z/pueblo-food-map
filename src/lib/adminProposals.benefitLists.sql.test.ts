// @vitest-environment node
/**
 * Real-SQLite proof that a SNAP/WIC list card (Venue Data Rebuild step 4,
 * scripts/refresh/benefitLists.ts) does what its approval promises: built
 * by the real builder, written by the real proposalSql statements, then
 * approved through applyApprovedProposal. A "listed" card ticks the box; a
 * "not on the list" card leaves the tick alone.
 */

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { applyApprovedProposal, type ChangeProposalRow } from "@/lib/adminProposals";
import { buildBenefitListProposals, SNAP_SOURCE, WIC_SOURCE, type BenefitSource, type BenefitVenueRow } from "../../scripts/refresh/benefitLists";
import { buildProposalWriteStatements } from "../../scripts/refresh/proposalSql";
import { sqlText } from "../../scripts/refresh/sql";

function buildDb(snap: number | null, wic: number | null): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf-8"));
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, accepts_snap, accepts_wic, source, last_verified, status, source_type, created_by, updated_by)
     VALUES ('osm-1', 'Save-A-Lot', 'grocery', 38.288387, -104.594668, '1110 Bonforte Boulevard, Pueblo, CO 81001', ?, ?, 'osm', '2026-05-14', 'published', 'osm', 'seed', 'seed')`,
  ).run(snap, wic);
  return db;
}

/** Runs the real builder against the stored row and writes its card the way refresh-ingest.ts does; returns the pending row. */
function writeCard(db: Database.Database, source: BenefitSource, onList: boolean): ChangeProposalRow {
  const venue = db.prepare("SELECT * FROM venues WHERE id = 'osm-1'").get() as BenefitVenueRow;
  const entries = onList
    ? [{ upstreamId: "x-1", name: "Save-A-Lot #43406", street: "1110 Bonforte Blvd.", city: "Pueblo", zip: "81001", lat: source === SNAP_SOURCE ? 38.2884 : null, lng: source === SNAP_SOURCE ? -104.5947 : null }]
    : [{ upstreamId: "x-2", name: "Elsewhere", street: "1 Far Rd", city: "Pueblo", zip: "81001", lat: null, lng: null }];
  const { proposals } = buildBenefitListProposals({ source, entries, venues: [venue], runId: "r1", today: "2026-11-13", fetchedAt: "2026-11-13T07:00:00.000Z" });
  expect(proposals).toHaveLength(1);
  const built = buildProposalWriteStatements(proposals[0], "2026-11-13T07:00:00.000Z", sqlText, { observationsReady: true });
  expect(built.autoApplied).toBe(false);
  for (const s of built.statements) db.exec(s);
  return db.prepare("SELECT * FROM change_proposals WHERE status = 'pending'").get() as ChangeProposalRow;
}

describe("approving SNAP/WIC list cards", () => {
  test.each([
    [SNAP_SOURCE, "accepts_snap", null, null],
    [WIC_SOURCE, "accepts_wic", 1, 0],
  ] as const)("%s 'listed' card -> %s becomes 1", async (source, column, snap, wic) => {
    const db = buildDb(snap, wic);
    const row = writeCard(db, source, true);
    const result = await applyApprovedProposal(sqliteD1(db), row, { email: "kyle@example.com" });
    expect(result.ok).toBe(true);
    expect((db.prepare(`SELECT ${column} AS v FROM venues WHERE id = 'osm-1'`).get() as { v: number }).v).toBe(1);
  });

  test("approving a 'maybe' card records the list record as this venue, so next month reads it as known", async () => {
    const db = buildDb(null, null);
    const venue = db.prepare("SELECT * FROM venues WHERE id = 'osm-1'").get() as BenefitVenueRow;
    // Same street number, different name: an uncertain match.
    const entries = [{ upstreamId: "wic-x", name: "Corner Grocer", street: "1110 Bonforte Blvd.", city: "Pueblo", zip: "81001", lat: null, lng: null }];
    const [maybe] = buildBenefitListProposals({ source: WIC_SOURCE, entries, venues: [venue], runId: "r1", today: "2026-11-13", fetchedAt: "2026-11-13T07:00:00.000Z" }).proposals;
    for (const s of buildProposalWriteStatements(maybe, "2026-11-13T07:00:00.000Z", sqlText, { observationsReady: true }).statements) db.exec(s);
    const row = db.prepare("SELECT * FROM change_proposals WHERE status = 'pending'").get() as ChangeProposalRow;
    expect((await applyApprovedProposal(sqliteD1(db), row, { email: "kyle@example.com" })).ok).toBe(true);
    const aliases = db.prepare("SELECT source, upstream_id, venue_id FROM venue_id_aliases").all() as { source: string; upstream_id: string; venue_id: string }[];
    expect(aliases).toEqual([{ source: "cdphe_wic", upstream_id: "wic-x", venue_id: "osm-1" }]);
    const ticked = db.prepare("SELECT * FROM venues WHERE id = 'osm-1'").get() as BenefitVenueRow;
    const next = buildBenefitListProposals({ source: WIC_SOURCE, entries, venues: [ticked], runId: "r2", today: "2026-12-15", fetchedAt: "2026-12-15T07:00:00.000Z", aliases });
    expect(next.proposals.filter((p) => p.proposedDiff.meta?.needs_review)).toEqual([]);
  });

  test("approving a 'not on the list' card leaves the tick at yes", async () => {
    const db = buildDb(1, null);
    const row = writeCard(db, SNAP_SOURCE, false);
    expect((await applyApprovedProposal(sqliteD1(db), row, { email: "kyle@example.com" })).ok).toBe(true);
    expect(db.prepare("SELECT accepts_snap FROM venues WHERE id = 'osm-1'").get()).toEqual({ accepts_snap: 1 });
  });
});
