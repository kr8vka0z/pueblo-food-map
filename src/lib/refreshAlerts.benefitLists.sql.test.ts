// @vitest-environment node
/**
 * The monthly SNAP/WIC list checks (Venue Data Rebuild step 4) are watched by
 * the same daily staleness alert as the weekly sources: a list that stops
 * completing must alert, not go quiet. Real SQLite, real SQL.
 */

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { checkSourceStaleness } from "@/lib/refreshAlerts";

const NOW = new Date("2026-12-31T12:00:00.000Z");

describe("staleness alert for the SNAP/WIC list checks", () => {
  test.each([
    ["usda_snap", 41, true],
    ["cdphe_wic", 41, true],
    ["usda_snap", 31, false],
  ])("%s last ran %i days ago -> alert %s", async (source, days, alert) => {
    const db = new Database(":memory:");
    const dir = join(process.cwd(), "migrations");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf-8"));
    const created = new Date(NOW.getTime() - days * 86_400_000).toISOString();
    db.prepare(
      "INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, created_at) VALUES (?, 'v', 'update', '{}', 'h', 'r', 'approved', ?)",
    ).run(source, created);
    const results = await checkSourceStaleness(sqliteD1(db), NOW);
    expect(results.find((r) => r.source === source)?.shouldAlert).toBe(alert);
  });
});
