// @vitest-environment node
/**
 * Real-SQLite proof for SELECT_BOX_VENUES_SQL (admin dashboard build) — the
 * one query in adminBoxes.ts with real SQL complexity (a LEFT JOIN onto
 * blessing_boxes for `removed_on`) that adminBoxes.test.ts's fake-D1 mock
 * can't catch a join/column mistake in. Same "run the actual exported query
 * string against a schema built from real migration files" pattern
 * adminBoxHealthQueries.sql.test.ts already established.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { SELECT_BOX_VENUES_SQL } from "@/lib/adminBoxes";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0001_init_admin_schema.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0005_blessing_boxes.sql"), "utf-8"));
  return db;
}

function insertBoxVenue(db: Database.Database, row: { id: string; status?: string; removedOn?: string | null }) {
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
     VALUES (?, ?, 'blessing_box', 38.25, -104.6, '123 Test St', 'manual', '2026-01-01', ?, 'manual', 'test@example.com', 'test@example.com')`,
  ).run(row.id, `Box ${row.id}`, row.status ?? "draft");
  db.prepare(`INSERT INTO blessing_boxes (venue_id, removed_on) VALUES (?, ?)`).run(row.id, row.removedOn ?? null);
}

function insertPantryVenue(db: Database.Database, id: string) {
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
     VALUES (?, 'A Pantry', 'pantry', 38.25, -104.6, '123 Test St', 'manual', '2026-01-01', 'published', 'manual', 'test@example.com', 'test@example.com')`,
  ).run(id);
}

interface Row {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  removed_on: string | null;
}

describe("SELECT_BOX_VENUES_SQL — real SQLite", () => {
  test("returns an in-service box's removed_on as null", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-a" });

    const rows = db.prepare(SELECT_BOX_VENUES_SQL).all() as Row[];

    expect(rows).toEqual([
      expect.objectContaining({ id: "box-a", name: "Box box-a", removed_on: null }),
    ]);
  });

  test("carries a removed box's removed_on date through — it is NOT filtered out (matches the public map's own 'still shown, marked out of service' rule)", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-removed", removedOn: "2026-08-01" });

    const rows = db.prepare(SELECT_BOX_VENUES_SQL).all() as Row[];

    expect(rows).toEqual([expect.objectContaining({ id: "box-removed", removed_on: "2026-08-01" })]);
  });

  test("excludes archived boxes and non-blessing-box venues", () => {
    const db = buildDb();
    insertBoxVenue(db, { id: "box-archived", status: "archived" });
    insertPantryVenue(db, "pantry-a");

    const rows = db.prepare(SELECT_BOX_VENUES_SQL).all() as Row[];

    expect(rows).toEqual([]);
  });
});
