// @vitest-environment node
/**
 * The Activity date filter covers exactly one Pueblo day on both 2026 clock
 * changes (#904): midnight's own UTC offset, not noon's, starts the day.
 * Spring-forward (Mar 8) used to pull in the previous day's 11 PM hour;
 * fall-back (Nov 1) used to drop its own first hour.
 */

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { loadActivityPage, parseActivityFilters } from "@/lib/activityLog";

// Same set as activityLog.sql.test.ts: the actions query joins the box tables.
const MIGRATIONS = [
  "0001_init_admin_schema.sql",
  "0005_blessing_boxes.sql",
  "0007_box_checkins.sql",
  "0009_box_photos.sql",
  "0010_box_adopters_alerts.sql",
  "0017_auth_events.sql",
];

// [day, records in UTC labelled by their Pueblo wall time]
const CASES: [string, Record<string, string>][] = [
  [
    "2026-03-08", // MST (-7) until 02:00, MDT (-6) after
    {
      "day before 23:30": "2026-03-08T06:30:00.000Z",
      "00:30": "2026-03-08T07:30:00.000Z",
      "23:30": "2026-03-09T05:30:00.000Z",
      "day after 00:30": "2026-03-09T06:30:00.000Z",
    },
  ],
  [
    "2026-11-01", // MDT (-6) until 02:00, MST (-7) after
    {
      "day before 23:30": "2026-11-01T05:30:00.000Z",
      "00:30": "2026-11-01T06:30:00.000Z",
      "23:30": "2026-11-02T06:30:00.000Z",
      "day after 00:30": "2026-11-02T07:30:00.000Z",
    },
  ],
];

describe("Activity date filter on clock-change days", () => {
  test.each(CASES)("%s keeps only that Pueblo day's records", async (day, records) => {
    const sqlite = new Database(":memory:");
    for (const m of MIGRATIONS) sqlite.exec(readFileSync(join(process.cwd(), "migrations", m), "utf-8"));
    const insert = sqlite.prepare(
      `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id)
       VALUES ('kysboyd@gmail.com', 'venue', ?, 'update', NULL, '{}', ?, NULL)`,
    );
    for (const [label, at] of Object.entries(records)) insert.run(label, at);

    const page = await loadActivityPage(sqliteD1(sqlite), parseActivityFilters({ from: day, to: day }));
    expect(page.actions.map((a) => a.entity_id).sort()).toEqual(["00:30", "23:30"]);
  });
});
