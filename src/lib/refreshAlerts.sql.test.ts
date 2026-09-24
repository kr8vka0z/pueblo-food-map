// @vitest-environment node
/**
 * Real-SQLite proof for refreshAlerts.ts's two exported SQL strings
 * (PENDING_AGE_SQL, SOURCE_STALENESS_SQL) — the mocked-D1 unit tests in
 * refreshAlerts.test.ts can't catch a real SQL mistake (a bad column name,
 * a GROUP BY that silently drops a source). Same "run the actual exported
 * query string against a schema built from real migration files" pattern
 * src/lib/adminBoxes.sql.test.ts established.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { PENDING_AGE_SQL, SOURCE_STALENESS_SQL } from "@/lib/refreshAlerts";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0001_init_admin_schema.sql"), "utf-8"));
  return db;
}

function insertProposal(
  db: Database.Database,
  row: { source: string; status?: string; createdAt: string; targetVenueId?: string },
) {
  db.prepare(
    `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, created_at)
     VALUES (?, ?, 'update', '{}', 'hash-1', 'run-1', ?, ?)`,
  ).run(row.source, row.targetVenueId ?? "venue-1", row.status ?? "pending", row.createdAt);
}

describe("PENDING_AGE_SQL — real SQLite", () => {
  test("counts only pending rows older than the bound cutoff, and returns the oldest", () => {
    const db = buildDb();
    insertProposal(db, { source: "osm", createdAt: "2026-08-01T00:00:00.000Z" }); // old, pending
    insertProposal(db, { source: "plentiful", createdAt: "2026-08-15T00:00:00.000Z", targetVenueId: "venue-2" }); // old, pending
    insertProposal(db, { source: "osm", createdAt: "2026-09-20T00:00:00.000Z", targetVenueId: "venue-3" }); // recent -> excluded
    insertProposal(db, { source: "osm", status: "approved", createdAt: "2026-07-01T00:00:00.000Z", targetVenueId: "venue-4" }); // old but not pending -> excluded

    const row = db.prepare(PENDING_AGE_SQL).get("2026-09-10T00:00:00.000Z") as { n: number; oldest: string | null };

    expect(row.n).toBe(2);
    expect(row.oldest).toBe("2026-08-01T00:00:00.000Z");
  });

  test("no pending rows past the cutoff -> n=0, oldest=null", () => {
    const db = buildDb();
    insertProposal(db, { source: "osm", createdAt: "2026-09-20T00:00:00.000Z" });

    const row = db.prepare(PENDING_AGE_SQL).get("2026-09-10T00:00:00.000Z") as { n: number; oldest: string | null };

    expect(row).toEqual({ n: 0, oldest: null });
  });
});

describe("SOURCE_STALENESS_SQL — real SQLite", () => {
  test("returns MAX(created_at) per source, ignoring status", () => {
    const db = buildDb();
    insertProposal(db, { source: "plentiful", createdAt: "2026-07-01T00:00:00.000Z" });
    insertProposal(db, { source: "plentiful", status: "approved", createdAt: "2026-08-01T00:00:00.000Z", targetVenueId: "v2" });
    insertProposal(db, { source: "osm", status: "rejected", createdAt: "2026-06-01T00:00:00.000Z", targetVenueId: "v3" });

    const rows = db.prepare(SOURCE_STALENESS_SQL).all() as Array<{ source: string; last: string }>;
    const bySource = Object.fromEntries(rows.map((r) => [r.source, r.last]));

    expect(bySource.plentiful).toBe("2026-08-01T00:00:00.000Z");
    expect(bySource.osm).toBe("2026-06-01T00:00:00.000Z");
  });

  test("a source with no rows at all is simply absent from the result set (not a null row)", () => {
    const db = buildDb();
    insertProposal(db, { source: "plentiful", createdAt: "2026-08-01T00:00:00.000Z" });

    const rows = db.prepare(SOURCE_STALENESS_SQL).all() as Array<{ source: string; last: string }>;

    expect(rows.map((r) => r.source)).toEqual(["plentiful"]);
  });

  test("link_health / gtfs rows never leak into this source-scoped result", () => {
    const db = buildDb();
    insertProposal(db, { source: "link_health", createdAt: "2026-09-01T00:00:00.000Z" });
    insertProposal(db, { source: "gtfs", createdAt: "2026-09-01T00:00:00.000Z", targetVenueId: "v2" });

    const rows = db.prepare(SOURCE_STALENESS_SQL).all() as Array<{ source: string }>;

    expect(rows).toEqual([]);
  });
});
