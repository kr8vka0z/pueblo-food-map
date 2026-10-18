// @vitest-environment node
/**
 * Real-SQLite proof that the owner Activity log understands `entity='event'`
 * audit rows (#757): the name comes from the events table (or the audit JSON
 * when the row/table is gone), a cancel reads as a cancel, and a database
 * without the `events` table (prod before migration 0018) still loads every
 * other entity. Separate from activityLog.sql.test.ts so that file's schema
 * stays as it was.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { loadActivityPage, parseActivityFilters, summarizeAction } from "@/lib/activityLog";

const BASE = [
  "0001_init_admin_schema.sql",
  "0005_blessing_boxes.sql",
  "0007_box_checkins.sql",
  "0009_box_photos.sql",
  "0010_box_adopters_alerts.sql",
  "0017_auth_events.sql",
];

function wrapAsD1(db: Database.Database): D1Database {
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}

const NOW = new Date("2026-09-27T20:00:00.000Z");
const filters = () => parseActivityFilters({}, NOW);

function build(migrations: string[]) {
  const sqlite = new Database(":memory:");
  for (const m of migrations) sqlite.exec(readFileSync(join(process.cwd(), "migrations", m), "utf-8"));
  return sqlite;
}

function audit(sqlite: Database.Database, row: { entity: string; entityId: string; action: string; before?: object | null; after: object; at: string }) {
  sqlite
    .prepare(
      `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp)
       VALUES ('kysboyd@gmail.com', ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.entity, row.entityId, row.action, row.before ? JSON.stringify(row.before) : null, JSON.stringify(row.after), row.at);
}

function addEvent(sqlite: Database.Database, id: string, name: string) {
  sqlite
    .prepare(`INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, created_by, updated_by) VALUES (?, ?, '2026-10-01T18:00:00.000Z', '2026-10-01T20:00:00.000Z', 38.25, -104.6, '1 Main St', 'published', 'x', 'x')`)
    .run(id, name);
}

describe("event rows in the Activity log", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = build([...BASE, "0018_events.sql"]);
  });

  test("an event row shows the event's name from the events table, and a cancel is labelled as one", async () => {
    addEvent(sqlite, "e1", "Harvest Fair");
    audit(sqlite, { entity: "event", entityId: "e1", action: "create", after: { name: "Old draft name" }, at: "2026-09-27T15:00:00.000Z" });
    audit(sqlite, {
      entity: "event",
      entityId: "e1",
      action: "update",
      before: { name: "Harvest Fair", status: "published" },
      after: { name: "Harvest Fair", status: "cancelled" },
      at: "2026-09-27T16:00:00.000Z",
    });
    audit(sqlite, {
      entity: "event",
      entityId: "e1",
      action: "update",
      before: { name: "Harvest Fair", status: "published", address: "A" },
      after: { name: "Harvest Fair", status: "published", address: "B" },
      at: "2026-09-27T17:00:00.000Z",
    });

    const { actions } = await loadActivityPage(wrapAsD1(sqlite), filters());
    const byTime = [...actions].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    expect(byTime.map((a) => a.venue_name)).toEqual(["Harvest Fair", "Harvest Fair", "Harvest Fair"]);
    expect(byTime.map((a) => summarizeAction(a).tag)).toEqual(["Added", "Cancelled event", "Edited"]);
  });

  test("falls back to the name in the audit JSON when the event row is gone", async () => {
    audit(sqlite, { entity: "event", entityId: "gone", action: "archive", before: { name: "Gone Fair" }, after: { name: "Gone Fair", status: "archived" }, at: "2026-09-27T15:00:00.000Z" });

    const { actions } = await loadActivityPage(wrapAsD1(sqlite), filters());

    expect(actions[0].venue_name).toBe("Gone Fair");
  });
});

describe("Activity log before migration 0018 is applied", () => {
  test("a missing events table does not break the page for other entities", async () => {
    const sqlite = build(BASE);
    sqlite
      .prepare(
        `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
         VALUES ('v1', 'Eastside Pantry', 'pantry', 38.25, -104.6, '1 Main St', 'manual', '2026-01-01', 'published', 'manual', 'x', 'x')`,
      )
      .run();
    audit(sqlite, { entity: "venue", entityId: "v1", action: "update", before: { name: "Eastside Pantry" }, after: { name: "Eastside Pantry" }, at: "2026-09-27T15:00:00.000Z" });
    audit(sqlite, { entity: "event", entityId: "e1", action: "create", after: { name: "Harvest Fair" }, at: "2026-09-27T16:00:00.000Z" });

    const { actions } = await loadActivityPage(wrapAsD1(sqlite), filters());

    expect(actions.map((a) => a.venue_name).sort()).toEqual(["Eastside Pantry", "Harvest Fair"]);
  });
});
