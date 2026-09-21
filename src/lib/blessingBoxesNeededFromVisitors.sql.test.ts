// @vitest-environment node
/**
 * Real-SQLite proof for SELECT_NEEDED_FROM_VISITORS_SQL /
 * SELECT_NEEDED_FROM_VISITORS_FOR_VENUE_SQL (migration 0012's "Most
 * needed · from people who use this box" aggregation).
 *
 * WHY a separate file, `node` environment, better-sqlite3: every other test
 * in blessingBoxes.test.ts proves D1-backed reads against a fake
 * D1Database whose `prepare()` discriminates on SQL *text* (see that
 * file's own header) — a mock like that can typo the same syntax error it
 * expects and still pass. This query is the one place in this feature with
 * real SQL complexity (json_each + a json_valid CASE guard, added by the
 * reviewer fix pass below) that a text-matching mock can't catch a mistake
 * in. better-sqlite3 is already a pinned devDependency for exactly this
 * class of proof (see auth-options.test.ts's own WHY comment) — reusing it
 * here avoids a second in-memory-DB mechanism. jsdom's vm-sandboxed realm
 * has no compatible require() path for the native addon, hence `node`.
 *
 * Runs the ACTUAL exported query strings from blessingBoxes.ts (not a
 * copy) against a schema built from the real migration files, so a future
 * edit to either the SQL or the schema breaks this test rather than
 * shipping unnoticed.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  SELECT_NEEDED_FROM_VISITORS_SQL,
  SELECT_NEEDED_FROM_VISITORS_FOR_VENUE_SQL,
  computeNeededFromVisitorsMap,
  type NeedCountRow,
} from "@/lib/blessingBoxes";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  // 0007 creates box_checkins with no `needs` column; 0012 adds it — same
  // two-file sequence a real dev/staging D1 applies (see AGENTS.md's
  // Blessing Boxes migration order).
  db.exec(readFileSync(join(process.cwd(), "migrations", "0007_box_checkins.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0012_box_checkin_needs.sql"), "utf-8"));
  return db;
}

function insertCheckin(
  db: Database.Database,
  row: {
    venueId: string;
    kind: string;
    visibility?: string;
    needs: string | null;
    createdAt: string;
  },
) {
  db.prepare(
    "INSERT INTO box_checkins (venue_id, kind, visibility, needs, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(row.venueId, row.kind, row.visibility ?? "visible", row.needs, row.createdAt);
}

const NOW = new Date("2026-09-19T00:00:00.000Z").getTime();
function daysAgo(n: number): string {
  return new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
}
const CUTOFF = daysAgo(30);

describe("SELECT_NEEDED_FROM_VISITORS_SQL — real SQLite", () => {
  test("counts visible 'took' rows within the 30-day window, grouped per venue/key", () => {
    const db = buildDb();
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food", "diapers"]), createdAt: daysAgo(1) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food"]), createdAt: daysAgo(2) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food", "diapers"]), createdAt: daysAgo(3) });
    insertCheckin(db, { venueId: "box-b", kind: "took", needs: JSON.stringify(["hygiene"]), createdAt: daysAgo(1) });

    const rows = db.prepare(SELECT_NEEDED_FROM_VISITORS_SQL).all(CUTOFF) as NeedCountRow[];

    expect(rows).toEqual(
      expect.arrayContaining([
        { venue_id: "box-a", key: "canned_food", n: 3, last_at: daysAgo(1) },
        { venue_id: "box-a", key: "diapers", n: 2, last_at: daysAgo(1) },
        { venue_id: "box-b", key: "hygiene", n: 1, last_at: daysAgo(1) },
      ]),
    );
    expect(rows).toHaveLength(3);
  });

  test("excludes rows outside the 30-day window, hidden rows, non-'took' kinds, and rows with no needs", () => {
    const db = buildDb();
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["bread"]), createdAt: daysAgo(40) }); // too old
    insertCheckin(db, { venueId: "box-a", kind: "took", visibility: "hidden", needs: JSON.stringify(["pet_food"]), createdAt: daysAgo(1) }); // hidden
    insertCheckin(db, { venueId: "box-a", kind: "filled", needs: JSON.stringify(["canned_food"]), createdAt: daysAgo(1) }); // wrong kind
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: null, createdAt: daysAgo(1) }); // no needs

    const rows = db.prepare(SELECT_NEEDED_FROM_VISITORS_SQL).all(CUTOFF) as NeedCountRow[];

    expect(rows).toEqual([]);
  });

  // Reviewer fix pass (2026-09-19) — json_valid CASE guard.
  test("a malformed needs value degrades to zero picks for that row instead of throwing, and doesn't affect other rows' counts", () => {
    const db = buildDb();
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food"]), createdAt: daysAgo(1) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food"]), createdAt: daysAgo(2) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: "{not valid json", createdAt: daysAgo(1) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: "not json at all", createdAt: daysAgo(1) });

    expect(() => db.prepare(SELECT_NEEDED_FROM_VISITORS_SQL).all(CUTOFF)).not.toThrow();
    const rows = db.prepare(SELECT_NEEDED_FROM_VISITORS_SQL).all(CUTOFF) as NeedCountRow[];
    expect(rows).toEqual([{ venue_id: "box-a", key: "canned_food", n: 2, last_at: daysAgo(1) }]);
  });

  test("the whole real pipeline: raw rows -> computeNeededFromVisitorsMap -> top-3, tie-break by most recent, display floor applied", () => {
    const db = buildDb();
    // 4 distinct keys at box-a; canned_food and diapers tie at n=2, diapers
    // picked more recently. bread also clears the display floor (n=2) so
    // this still proves the top-3 truncation; hygiene stays at a single
    // pick (n=1) and must never appear at all (the floor, reviewer fix
    // pass 2026-09-19 — see computeNeededFromVisitorsMap's own header).
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food"]), createdAt: daysAgo(5) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food"]), createdAt: daysAgo(4) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["diapers"]), createdAt: daysAgo(3) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["diapers"]), createdAt: daysAgo(1) }); // more recent than canned_food's last pick
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["bread"]), createdAt: daysAgo(2) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["bread"]), createdAt: daysAgo(2) });
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["hygiene"]), createdAt: daysAgo(2) }); // single pick — below the floor

    const rows = db.prepare(SELECT_NEEDED_FROM_VISITORS_SQL).all(CUTOFF) as NeedCountRow[];
    const map = computeNeededFromVisitorsMap(rows);

    // All three tied at count 2 — tie-break is last_at DESC: diapers'
    // last pick (1 day ago) beats bread's (2 days ago) beats canned_food's
    // (4 days ago).
    expect(map.get("box-a")).toEqual([
      { key: "diapers", count: 2 },
      { key: "bread", count: 2 },
      { key: "canned_food", count: 2 },
    ]);
    expect(map.get("box-a")?.some((r) => r.key === "hygiene")).toBe(false);
  });
});

describe("SELECT_NEEDED_FROM_VISITORS_FOR_VENUE_SQL — real SQLite", () => {
  test("scopes to exactly one venue, ignoring other boxes' picks", () => {
    const db = buildDb();
    insertCheckin(db, { venueId: "box-a", kind: "took", needs: JSON.stringify(["canned_food"]), createdAt: daysAgo(1) });
    insertCheckin(db, { venueId: "box-b", kind: "took", needs: JSON.stringify(["hygiene"]), createdAt: daysAgo(1) });

    const rows = db.prepare(SELECT_NEEDED_FROM_VISITORS_FOR_VENUE_SQL).all(CUTOFF, "box-a") as NeedCountRow[];

    expect(rows).toEqual([{ venue_id: "box-a", key: "canned_food", n: 1, last_at: daysAgo(1) }]);
  });
});
