// @vitest-environment node
/**
 * Real-SQLite proof for the Venue Data Rebuild step 0 + 1 migrations
 * (0020-0022) and the SQL they feed: the change_proposals rebuild keeps every
 * row, the refresh job's "still listed" write never moves last_verified, a
 * stale admin edit records no pin, and the step-0 load is idempotent with
 * hashes rejection memory will recognise. Every migration is applied in
 * order, the same way `wrangler d1 migrations apply` does.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { computeDiffHash, type ProposalDraft } from "../../scripts/refresh/diffEngine";
import { buildProposalWriteStatements } from "../../scripts/refresh/proposalSql";
import { PIN_INSERT_SQL } from "@/lib/adminVenueEditSql";
import { applyApprovedProposal, type ChangeProposalRow } from "@/lib/adminProposals";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const ALL = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const FH = "manual-f3d3712c-caf1-40a0-a3cd-b3dc38e14c00";

function apply(db: Database.Database, file: string) {
  db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf-8"));
}
function migrateThrough(db: Database.Database, lastPrefix: string) {
  for (const f of ALL) if (f.slice(0, 4) <= lastPrefix) apply(db, f);
}

function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function seedVenue(db: Database.Database, id: string, extra: Record<string, unknown> = {}) {
  const row = {
    id, name: `Venue ${id}`, category: "pantry", lat: 38.25, lng: -104.6, address: "1 Main St",
    source: "test", last_verified: "2026-10-12", source_type: "plentiful", status: "published",
    created_by: "seed", updated_by: "seed", updated_at: "2026-10-12T00:00:00.000Z", ...extra,
  };
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO venues (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...Object.values(row));
}

function insertProposal(db: Database.Database, values: Record<string, unknown>) {
  const cols = Object.keys(values);
  db.prepare(`INSERT INTO change_proposals (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...Object.values(values));
}

describe("0020 change_proposals rebuild", () => {
  test("keeps every existing row byte-for-byte, its indexes and its id counter, and accepts the new sources", () => {
    const db = new Database(":memory:");
    migrateThrough(db, "0019");
    const base = { target_venue_id: "v1", change_type: "update", proposed_diff: "{}", diff_hash: "h", run_id: "r1" };
    insertProposal(db, { ...base, source: "osm" });
    insertProposal(db, { ...base, source: "plentiful", status: "rejected", reviewed_by: "a", reviewed_at: "t" });
    insertProposal(db, { ...base, source: "link_health", status: "approved", applied_at: "t", triage_lane: "needs_human", triage_json: "{}", triage_model: "jev-1", triage_at: "t" });
    db.prepare("DELETE FROM change_proposals WHERE id = 1").run(); // a gap, like a real table's
    const before = db.prepare("SELECT * FROM change_proposals ORDER BY id").all();

    apply(db, "0020_proposal_sources.sql");

    expect(db.prepare("SELECT * FROM change_proposals ORDER BY id").all()).toEqual(before);
    const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'change_proposals'").all() as { name: string }[]).map((r) => r.name);
    expect(indexes.sort()).toEqual(["idx_change_proposals_dedup", "idx_change_proposals_run", "idx_change_proposals_status", "idx_change_proposals_target"]);
    insertProposal(db, { ...base, source: "website" });
    expect((db.prepare("SELECT MAX(id) AS m FROM change_proposals").get() as { m: number }).m).toBe(4);
    for (const s of ["care_and_share", "usda_snap", "cdphe_wic"]) insertProposal(db, { ...base, source: s });
    expect(() => insertProposal(db, { ...base, source: "google" })).toThrow(/CHECK/);
    expect(() => insertProposal(db, { ...base, source: "osm", triage_lane: "bogus" })).toThrow(/CHECK/);
  });
});

describe("refresh job's date-only write against real SQLite", () => {
  test("records a fetch observation and leaves venues.last_verified, updated_at and audit_log alone", () => {
    const db = new Database(":memory:");
    migrateThrough(db, "9999");
    seedVenue(db, "plentiful-x");
    const proposal: ProposalDraft = {
      source: "plentiful",
      targetVenueId: "plentiful-x",
      changeType: "update",
      proposedDiff: { before: { last_verified: "2026-10-12" }, after: { last_verified: "2026-10-26" }, fields_changed: ["last_verified"] },
      diffHash: "h",
      runId: "run-1",
    };
    const { statements } = buildProposalWriteStatements(proposal, "2026-10-26T06:00:00.000Z", sqlText);
    db.exec(statements.join("\n"));

    expect(db.prepare("SELECT last_verified, updated_at FROM venues WHERE id = 'plentiful-x'").get()).toEqual({
      last_verified: "2026-10-12",
      updated_at: "2026-10-12T00:00:00.000Z",
    });
    expect((db.prepare("SELECT COUNT(*) AS n FROM audit_log").get() as { n: number }).n).toBe(0);
    expect(db.prepare("SELECT venue_id, field, source, is_pin, accepted_at FROM venue_observations").all()).toEqual([
      { venue_id: "plentiful-x", field: "listed", source: "plentiful", is_pin: 0, accepted_at: null },
    ]);
    expect(db.prepare("SELECT status, applied_at FROM change_proposals").get()).toEqual({ status: "approved", applied_at: null });
  });
});

describe("0021 Friendly Harbor pin + the edit form's pin INSERT", () => {
  test("the seed pins Friendly Harbor's current hours_irregular once, even if re-run", () => {
    const db = new Database(":memory:");
    migrateThrough(db, "0020");
    const hours = JSON.stringify([{ recurrence: "monthly_ordinal", ordinal: "last", weekday: "wed", slots: ["1:00 PM - 3:00 PM"] }]);
    seedVenue(db, FH, { source_type: "manual", hours_irregular: hours });
    apply(db, "0021_venue_observations.sql");
    apply(db, "0021_venue_observations.sql");

    expect(db.prepare("SELECT venue_id, field, source, value, is_pin, pin_note FROM venue_observations").all()).toEqual([
      { venue_id: FH, field: "hours_irregular", source: "venue_direct", value: hours, is_pin: 1, pin_note: "Heather, admin assistant, via feedback form 2026-10-12" },
    ]);
  });

  test("a stale edit (its venue UPDATE matched nothing) writes no pin; a saved one does", () => {
    const db = new Database(":memory:");
    migrateThrough(db, "9999");
    seedVenue(db, "v1");
    const pinArgs = (updatedAt: string) => ["v1", "phone", '"719-555-0199"', updatedAt, "admin", "note", updatedAt, "admin", "v1", updatedAt];

    db.prepare(PIN_INSERT_SQL).run(...pinArgs("2026-10-26T00:00:00.000Z")); // the venue still has the OLD updated_at
    expect((db.prepare("SELECT COUNT(*) AS n FROM venue_observations").get() as { n: number }).n).toBe(0);

    db.prepare(PIN_INSERT_SQL).run(...pinArgs("2026-10-12T00:00:00.000Z"));
    expect(db.prepare("SELECT field, source, is_pin FROM venue_observations").all()).toEqual([{ field: "phone", source: "venue_direct", is_pin: 1 }]);
  });
});

describe("0022 step-0 website fixes", () => {
  const TARGETS = [
    "plentiful-care-and-share-food-bank-for-southern-colorado-main-location-4a362e63",
    "plentiful-the-pueblo-shelter-safeside-recovery-plentiful-4265",
    "plentiful-eva-r-baca-elementary-school-52dc3901",
    "plentiful-center-toward-self-reliance-1c29edf8",
    "plentiful-pueblo-united-3d8ce244",
    "plentiful-agape-fellowship-church-925bb133",
    "plentiful-new-heights-baptist-church-35755919",
    "plentiful-lynn-gardens-baptist-church-21831a26",
    "plentiful-mt-carmel-veteran-center-of-pueblo-76b970d4",
  ];

  function freshDb() {
    const db = new Database(":memory:");
    migrateThrough(db, "0021");
    return db;
  }

  test("writes one pending 'website' proposal per existing venue, with current values as `before` and a hash diffEngine agrees with", () => {
    const db = freshDb();
    for (const id of TARGETS) seedVenue(db, id, { hours_weekly: JSON.stringify({ mon: ["8:00 AM - 4:30 PM"] }), phone: null });
    apply(db, "0022_website_fixes_2026_10_25.sql");

    const rows = db.prepare("SELECT * FROM change_proposals ORDER BY id").all() as Array<Record<string, string>>;
    expect(rows.map((r) => r.target_venue_id)).toEqual(TARGETS);
    expect(rows.map((r) => r.change_type).filter((t) => t === "remove")).toHaveLength(2);
    for (const r of rows) {
      expect(r.source).toBe("website");
      expect(r.status).toBe("pending");
      const diff = JSON.parse(r.proposed_diff);
      expect(r.diff_hash).toBe(computeDiffHash(diff.after, diff.fields_changed));
      expect(typeof diff.meta.source_url).toBe("string");
      expect(diff.meta.summary.length).toBeGreaterThan(10);
      if (diff.fields_changed.includes("hours_weekly")) expect(diff.before.hours_weekly).toEqual({ mon: ["8:00 AM - 4:30 PM"] });
    }
    // No venue row is touched by loading proposals.
    expect((db.prepare("SELECT COUNT(*) AS n FROM venues WHERE updated_by != 'seed'").get() as { n: number }).n).toBe(0);
  });

  test("is idempotent, and skips venues that are gone, archived or blessing boxes", () => {
    const db = freshDb();
    seedVenue(db, TARGETS[5]); // Agape: live
    seedVenue(db, TARGETS[6], { status: "archived" }); // New Heights: archived
    seedVenue(db, TARGETS[7], { category: "blessing_box" }); // a box must never be touched
    apply(db, "0022_website_fixes_2026_10_25.sql");
    apply(db, "0022_website_fixes_2026_10_25.sql");

    expect(db.prepare("SELECT target_venue_id FROM change_proposals").all()).toEqual([{ target_venue_id: TARGETS[5] }]);
  });

  test("approving them through the real approve path lands every field, notes included, and archives the removals", async () => {
    const db = freshDb();
    for (const id of TARGETS) seedVenue(db, id);
    apply(db, "0022_website_fixes_2026_10_25.sql");
    const rows = db.prepare("SELECT * FROM change_proposals ORDER BY id").all() as ChangeProposalRow[];

    for (const row of rows) {
      const result = await applyApprovedProposal(sqliteD1(db), row, { email: "admin@example.com" });
      expect(result.ok, `${row.target_venue_id}: ${JSON.stringify(result)}`).toBe(true);
    }

    const venue = (id: string) => db.prepare("SELECT * FROM venues WHERE id = ?").get(id) as Record<string, unknown>;
    expect(venue(TARGETS[0]).status).toBe("archived");
    expect(venue(TARGETS[2]).status).toBe("archived");
    expect(venue(TARGETS[1])).toMatchObject({ category: "meal_site", last_verified: "2026-10-25" });
    expect(JSON.parse(venue(TARGETS[1]).hours_weekly as string).fri).toEqual(["4:30 PM - 5:00 PM"]);
    expect(venue(TARGETS[4])).toMatchObject({ address: "623 E 4th St, Pueblo, CO 81001", notes: "Closed the 1st and 3rd Monday of each month." });
    expect(venue(TARGETS[7]).notes).toMatch(/Bring ID/);
    expect(venue(TARGETS[5]).phone).toBe("(719) 542-1411");
  });
});
