// @vitest-environment node
/**
 * Real-SQLite proof for #265's optimistic-concurrency guard.
 *
 * The PATCH route sends its statements as one D1 batch, which runs them in a
 * single transaction, in order. Everything after the venue UPDATE is gated
 * on `WHERE EXISTS (venues.updated_at = <new value>)`, i.e. "did the UPDATE
 * actually apply?". The mocked route tests can't prove SQLite sees the
 * UPDATE's write from later statements in the same transaction; this file
 * runs the exact exported SQL against a schema built from the real
 * migrations to prove it.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  VENUE_UPDATE_SQL,
  AUDIT_INSERT_SQL,
  BOX_DELETE_SQL,
  BOX_INSERT_SQL,
  BOX_EVENT_INSERT_SQL_GUARDED,
  APPROVE_PROPOSAL_SQL,
} from "@/lib/adminVenueEditSql";

const MIGRATIONS = [
  "0001_init_admin_schema.sql",
  "0005_blessing_boxes.sql",
  "0008_box_events.sql",
];

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(readFileSync(join(process.cwd(), "migrations", m), "utf-8"));
  // Later migrations add columns the UPDATE writes; add any the listed ones lack.
  const cols = new Set(
    (db.prepare("PRAGMA table_info(venues)").all() as { name: string }[]).map((c) => c.name),
  );
  for (const c of ["accepts_snap", "accepts_wic", "hours_irregular"]) {
    if (!cols.has(c)) db.exec(`ALTER TABLE venues ADD COLUMN ${c} TEXT`);
  }
  return db;
}

const OLD_TS = "2026-09-20T00:00:00.000Z";
const NEW_TS = "2026-09-24T12:00:00.000Z";

function seedVenue(db: Database.Database, id: string, category: string) {
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, source_type, status,
       created_at, created_by, updated_at, updated_by)
     VALUES (?, 'Old Name', ?, 38.25, -104.6, 'Old Address', 'test', '2026-09-01', 'manual', 'published',
       ?, 'seed', ?, 'seed')`,
  ).run(id, category, OLD_TS, OLD_TS);
}

function updateArgs(id: string, expectedUpdatedAt: string) {
  // Same order as VENUE_UPDATE_SQL's placeholders.
  return [
    "New Name", "blessing_box", 38.25, -104.6, "New Address", null,
    null, null, null, null, null, null,
    null, "test", "2026-09-24", 0,
    "admin@example.com", NEW_TS,
    id, expectedUpdatedAt,
  ];
}

/** Runs the route's statement sequence in one transaction, like D1's batch(). */
function runEdit(db: Database.Database, id: string, expectedUpdatedAt: string) {
  let updateChanges = -1;
  db.transaction(() => {
    updateChanges = db.prepare(VENUE_UPDATE_SQL).run(...updateArgs(id, expectedUpdatedAt)).changes;
    db.prepare(BOX_DELETE_SQL).run(id, id, NEW_TS);
    db.prepare(BOX_INSERT_SQL).run(id, "Host", null, null, null, null, null, id, NEW_TS);
    db.prepare(BOX_EVENT_INSERT_SQL_GUARDED).run(id, "renamed", "Old Name → New Name", NEW_TS, id, NEW_TS);
    db.prepare(AUDIT_INSERT_SQL).run(
      "admin@example.com", "venue", id, "update", "{}", "{}", NEW_TS, id, NEW_TS,
    );
  })();
  return updateChanges;
}

const count = (db: Database.Database, sql: string, ...args: unknown[]) =>
  (db.prepare(sql).get(...args) as { n: number }).n;

describe("admin venue edit SQL — optimistic concurrency against real SQLite (#265)", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = buildDb();
  });

  test("stale precondition: nothing is written — venue, box row, box_events and audit all untouched", () => {
    seedVenue(db, "v1", "blessing_box");
    db.prepare(
      "INSERT INTO blessing_boxes (venue_id, host_name) VALUES ('v1', 'Original Host')",
    ).run();

    const changes = runEdit(db, "v1", "2026-01-01T00:00:00.000Z" /* stale */);

    expect(changes).toBe(0);
    const v = db.prepare("SELECT name, updated_at FROM venues WHERE id = 'v1'").get() as {
      name: string;
      updated_at: string;
    };
    expect(v).toEqual({ name: "Old Name", updated_at: OLD_TS });
    expect(db.prepare("SELECT host_name FROM blessing_boxes WHERE venue_id = 'v1'").get()).toEqual({
      host_name: "Original Host",
    });
    expect(count(db, "SELECT COUNT(*) n FROM box_events WHERE venue_id = 'v1'")).toBe(0);
    expect(count(db, "SELECT COUNT(*) n FROM audit_log WHERE entity_id = 'v1'")).toBe(0);
  });

  test("matching precondition: every dependent write applies", () => {
    seedVenue(db, "v1", "blessing_box");
    db.prepare("INSERT INTO blessing_boxes (venue_id, host_name, created_at, updated_at) VALUES ('v1', 'Original Host', 'x', 'x')").run();

    const changes = runEdit(db, "v1", OLD_TS);

    expect(changes).toBe(1);
    expect(db.prepare("SELECT name, updated_at FROM venues WHERE id = 'v1'").get()).toEqual({
      name: "New Name",
      updated_at: NEW_TS,
    });
    expect(db.prepare("SELECT host_name FROM blessing_boxes WHERE venue_id = 'v1'").get()).toEqual({
      host_name: "Host",
    });
    expect(count(db, "SELECT COUNT(*) n FROM box_events WHERE venue_id = 'v1'")).toBe(1);
    expect(count(db, "SELECT COUNT(*) n FROM audit_log WHERE entity_id = 'v1'")).toBe(1);
  });

  test("becoming a box for the first time: the 0-row box DELETE doesn't block the INSERT or audit", () => {
    seedVenue(db, "v2", "pantry");

    const changes = runEdit(db, "v2", OLD_TS);

    expect(changes).toBe(1);
    expect(count(db, "SELECT COUNT(*) n FROM blessing_boxes WHERE venue_id = 'v2'")).toBe(1);
    expect(count(db, "SELECT COUNT(*) n FROM audit_log WHERE entity_id = 'v2'")).toBe(1);
  });
});

describe("APPROVE_PROPOSAL_SQL — only marks a link-health proposal approved when the edit applied (#265)", () => {
  function seedProposal(db: Database.Database, venueId: string) {
    db.prepare(
      `INSERT INTO change_proposals (id, source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, anomaly, status, created_at)
       VALUES (7, 'link_health', ?, 'update', '{}', 'h', 'r1', 0, 'pending', ?)`,
    ).run(venueId, OLD_TS);
  }
  function editAndApprove(db: Database.Database, expected: string) {
    db.transaction(() => {
      db.prepare(VENUE_UPDATE_SQL).run(...updateArgs("v1", expected));
      db.prepare(APPROVE_PROPOSAL_SQL).run("admin@example.com", NEW_TS, NEW_TS, 7, "v1", "v1", NEW_TS);
    })();
    return (db.prepare("SELECT status FROM change_proposals WHERE id = 7").get() as { status: string }).status;
  }

  test("stale edit leaves the proposal pending", () => {
    const db = buildDb();
    seedVenue(db, "v1", "pantry");
    seedProposal(db, "v1");
    expect(editAndApprove(db, "2026-01-01T00:00:00.000Z")).toBe("pending");
  });

  test("applied edit marks it approved", () => {
    const db = buildDb();
    seedVenue(db, "v1", "pantry");
    seedProposal(db, "v1");
    expect(editAndApprove(db, OLD_TS)).toBe("approved");
  });
});
