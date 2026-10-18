// @vitest-environment node
/**
 * Real-SQLite proof for the events table (migrations/0018_events.sql) and
 * the public feed's query (PUBLIC_EVENTS_SQL, src/lib/events.ts). A fake-D1
 * mock can't catch a wrong WHERE clause, so this runs the actual exported
 * query string against a schema built from the real migration files (same
 * pattern as adminBoxes.sql.test.ts).
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { PUBLIC_EVENTS_SQL } from "@/lib/events";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0018_events.sql"), "utf-8"));
  return db;
}

function insertEvent(
  db: Database.Database,
  row: { id: string; status: string; startsAt?: string; endsAt: string },
) {
  db.prepare(
    `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, 38.25, -104.6, '123 Test St', ?, 'a@example.com', 'a@example.com')`,
  ).run(row.id, `Event ${row.id}`, row.startsAt ?? "2026-01-01T00:00:00.000Z", row.endsAt, row.status);
}

const NOW = "2026-10-10T12:00:00.000Z";

describe("PUBLIC_EVENTS_SQL — real SQLite", () => {
  test("returns only published events that have not ended — never drafts, cancelled, archived or ended", () => {
    const db = buildDb();
    insertEvent(db, { id: "live", status: "published", endsAt: "2026-10-11T00:00:00.000Z" });
    insertEvent(db, { id: "draft", status: "draft", endsAt: "2026-10-11T00:00:00.000Z" });
    insertEvent(db, { id: "cancelled", status: "cancelled", endsAt: "2026-10-11T00:00:00.000Z" });
    insertEvent(db, { id: "archived", status: "archived", endsAt: "2026-10-11T00:00:00.000Z" });
    insertEvent(db, { id: "ended", status: "published", endsAt: "2026-10-10T11:59:59.000Z" });

    const rows = db.prepare(PUBLIC_EVENTS_SQL).all(NOW) as { id: string }[];

    expect(rows.map((r) => r.id)).toEqual(["live"]);
  });

  test("an event ending exactly now is over (strictly in the future only)", () => {
    const db = buildDb();
    insertEvent(db, { id: "edge", status: "published", endsAt: NOW });

    expect(db.prepare(PUBLIC_EVENTS_SQL).all(NOW)).toEqual([]);
  });

  test("never selects internal columns", () => {
    const db = buildDb();
    insertEvent(db, { id: "live", status: "published", endsAt: "2026-10-11T00:00:00.000Z" });

    const row = db.prepare(PUBLIC_EVENTS_SQL).get(NOW) as Record<string, unknown>;

    for (const internal of ["created_by", "updated_by", "created_at", "updated_at", "status", "cancel_note", "flyer_key"]) {
      expect(row).not.toHaveProperty(internal);
    }
  });

  test("the table refuses an event that ends before it starts, and an unknown status", () => {
    const db = buildDb();
    expect(() => insertEvent(db, { id: "x", status: "published", startsAt: "2026-10-12T00:00:00.000Z", endsAt: "2026-10-11T00:00:00.000Z" })).toThrow();
    expect(() => insertEvent(db, { id: "y", status: "live", endsAt: "2026-10-11T00:00:00.000Z" })).toThrow();
  });
});
