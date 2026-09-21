// @vitest-environment node
/**
 * Real-SQLite proof for SELECT_LATEST_CHECKIN_PER_BOX_SQL and
 * SELECT_RECENT_CHECKINS_ALL_BOXES_SQL (admin dashboard build — "Boxes that
 * need help" / "Box reports, last 8 weeks").
 *
 * WHY a separate file, `node` environment, better-sqlite3, same reasoning
 * as blessingBoxesNeededFromVisitors.sql.test.ts's own header: these two
 * queries are the one place this slice adds real SQL complexity (a
 * window-function subquery, a join on `venues.category`) that a
 * text-matching fake-D1 mock can't catch a syntax or column mistake in.
 * Runs the ACTUAL exported query strings from blessingBoxes.ts against a
 * schema built from the real migration files, so a future edit to either
 * the SQL or the schema breaks this test rather than shipping unnoticed.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  SELECT_LATEST_CHECKIN_PER_BOX_SQL,
  SELECT_RECENT_CHECKINS_ALL_BOXES_SQL,
  type AdminLatestCheckinRow,
  type AdminRecentCheckinRow,
} from "@/lib/blessingBoxes";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  // Same migration sequence a real dev/staging D1 applies: 0001 creates
  // `venues` (no blessing_box category yet), 0005 widens the CHECK and adds
  // `blessing_boxes`, 0007 adds `box_checkins`.
  db.exec(readFileSync(join(process.cwd(), "migrations", "0001_init_admin_schema.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0005_blessing_boxes.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0007_box_checkins.sql"), "utf-8"));
  return db;
}

function insertBoxVenue(db: Database.Database, row: { id: string; status?: string }) {
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
     VALUES (?, ?, 'blessing_box', 38.25, -104.6, '123 Test St', 'manual', '2026-01-01', ?, 'manual', 'test@example.com', 'test@example.com')`,
  ).run(row.id, `Box ${row.id}`, row.status ?? "draft");
  db.prepare(`INSERT INTO blessing_boxes (venue_id) VALUES (?)`).run(row.id);
}

// A non-box venue (pantry) — proves the join filters by category, not just
// by "has a box_checkins row."
function insertPantryVenue(db: Database.Database, id: string) {
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
     VALUES (?, 'A Pantry', 'pantry', 38.25, -104.6, '123 Test St', 'manual', '2026-01-01', 'published', 'manual', 'test@example.com', 'test@example.com')`,
  ).run(id);
}

function insertCheckin(
  db: Database.Database,
  row: { venueId: string; kind: string; visibility?: string; note?: string | null; createdAt: string },
) {
  db.prepare(
    "INSERT INTO box_checkins (venue_id, kind, note, visibility, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(row.venueId, row.kind, row.note ?? null, row.visibility ?? "visible", row.createdAt);
}

describe("SELECT_LATEST_CHECKIN_PER_BOX_SQL — real SQLite", () => {
  test("returns exactly one row per box — the most recent VISIBLE check-in, any kind", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-a" });
    insertCheckin(db, { venueId: "box-a", kind: "filled", createdAt: "2026-09-01T00:00:00.000Z" });
    insertCheckin(db, { venueId: "box-a", kind: "problem", note: "hinge broken", createdAt: "2026-09-05T00:00:00.000Z" });

    const rows = db.prepare(SELECT_LATEST_CHECKIN_PER_BOX_SQL).all() as AdminLatestCheckinRow[];

    expect(rows).toEqual([{ venue_id: "box-a", kind: "problem", note: "hinge broken", created_at: "2026-09-05T00:00:00.000Z" }]);
  });

  test("includes 'problem' rows (unlike the public check-ins query) and ignores hidden rows", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-a" });
    insertCheckin(db, { venueId: "box-a", kind: "empty", visibility: "hidden", createdAt: "2026-09-10T00:00:00.000Z" });
    insertCheckin(db, { venueId: "box-a", kind: "low", createdAt: "2026-09-05T00:00:00.000Z" });

    const rows = db.prepare(SELECT_LATEST_CHECKIN_PER_BOX_SQL).all() as AdminLatestCheckinRow[];

    expect(rows).toEqual([{ venue_id: "box-a", kind: "low", note: null, created_at: "2026-09-05T00:00:00.000Z" }]);
  });

  test("excludes non-blessing-box venues and archived boxes", () => {
    const db = buildDb();
    insertPantryVenue(db, "pantry-a");
    insertCheckin(db, { venueId: "pantry-a", kind: "filled", createdAt: "2026-09-01T00:00:00.000Z" });
    insertBoxVenue(db, { id: "box-archived", status: "archived" });
    insertCheckin(db, { venueId: "box-archived", kind: "filled", createdAt: "2026-09-01T00:00:00.000Z" });

    const rows = db.prepare(SELECT_LATEST_CHECKIN_PER_BOX_SQL).all() as AdminLatestCheckinRow[];

    expect(rows).toEqual([]);
  });

  test("a box with zero check-ins produces no row (caller treats a missing venue_id as 'quiet')", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-never-checked" });

    const rows = db.prepare(SELECT_LATEST_CHECKIN_PER_BOX_SQL).all() as AdminLatestCheckinRow[];

    expect(rows).toEqual([]);
  });
});

describe("SELECT_RECENT_CHECKINS_ALL_BOXES_SQL — real SQLite", () => {
  test("returns every visible check-in across every box within the window, including 'problem'", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-a" });
    insertBoxVenue(db, { id: "box-b" });
    insertCheckin(db, { venueId: "box-a", kind: "filled", createdAt: "2026-09-15T00:00:00.000Z" });
    insertCheckin(db, { venueId: "box-b", kind: "problem", createdAt: "2026-09-16T00:00:00.000Z" });
    insertCheckin(db, { venueId: "box-a", kind: "filled", createdAt: "2026-08-01T00:00:00.000Z" }); // outside window

    const rows = db.prepare(SELECT_RECENT_CHECKINS_ALL_BOXES_SQL).all("2026-09-01T00:00:00.000Z") as AdminRecentCheckinRow[];

    expect(rows).toEqual(
      expect.arrayContaining([
        { venue_id: "box-a", kind: "filled", created_at: "2026-09-15T00:00:00.000Z" },
        { venue_id: "box-b", kind: "problem", created_at: "2026-09-16T00:00:00.000Z" },
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  test("ignores hidden rows and non-box venues", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-a" });
    insertPantryVenue(db, "pantry-a");
    insertCheckin(db, { venueId: "box-a", kind: "low", visibility: "hidden", createdAt: "2026-09-15T00:00:00.000Z" });
    insertCheckin(db, { venueId: "pantry-a", kind: "filled", createdAt: "2026-09-15T00:00:00.000Z" });

    const rows = db.prepare(SELECT_RECENT_CHECKINS_ALL_BOXES_SQL).all("2026-09-01T00:00:00.000Z") as AdminRecentCheckinRow[];

    expect(rows).toEqual([]);
  });
});
