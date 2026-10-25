// @vitest-environment node
/**
 * Real-SQLite proof that an approved Care and Share hours change still
 * publishes (review of PR #845): a monthly-only or weekly-only listing
 * changes only that kind of schedule, never proposes the other as "" (which
 * approve stored as invalid JSON and Publish refused), and keeps `before` as
 * stored so approve's stale check doesn't refuse a 12h-format venue.
 * Through the real path: build → write → applyApprovedProposal → validateAndMapRow.
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { buildCareAndShareProposals, type CasLocation, type CasSchedule } from "../../scripts/refresh/careAndShare";
import { buildProposalWriteStatements } from "../../scripts/refresh/proposalSql";
import type { CurrentVenueRow } from "../../scripts/refresh/diffEngine";
import { applyApprovedProposal, type ChangeProposalRow } from "@/lib/adminProposals";
import { validateAndMapRow, type VenueRow } from "@/lib/publishVenues";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const VENUE = "plentiful-praise";
const WEEKLY_12H = JSON.stringify({ mon: ["10:00 AM - 12:00 PM"] });
const MONTHLY_12H = JSON.stringify([{ recurrence: "monthly_ordinal", ordinal: 3, weekday: "sat", slots: ["9:00 AM - 11:00 AM"] }]);
const sql = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`);

const location: CasLocation = {
  locationId: 42, name: "Praise Assembly of God", address1: "2000 Troy Ave", address2: "", city: "Pueblo", state: "CO", zip: "81001",
  phone: "", website: "", lat: 38.2701, lng: -104.5807,
};
function sched(over: Partial<CasSchedule>): CasSchedule {
  return {
    locationId: 42, dayOfWeek: 3, startTime: "1900-01-01T13:00:00", endTime: "1900-01-01T15:00:00", weekDayDescr: "Tuesday",
    startTimeDescr: "1:00 PM", endTimeDescr: "3:00 PM", notes: "", weeksOfMonth: "", daysOfMonth: "", contactForHoursMessage: null,
    everyOtherWeekInd: false, ...over,
  };
}

function setup() {
  const db = new Database(":memory:");
  for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf-8"));
  db.prepare(
    "INSERT INTO venues (id, name, category, lat, lng, address, hours_weekly, hours_irregular, source, last_verified, source_type, status, created_by, updated_by) " +
      "VALUES (?, 'Praise Assembly of God', 'pantry', 38.2701, -104.5807, '2000 Troy Ave, Pueblo, CO 81001', ?, ?, 'x', '2026-10-01', 'plentiful', 'published', 'seed', 'seed')",
  ).run(VENUE, WEEKLY_12H, MONTHLY_12H);
  return db;
}

describe("an approved Care and Share hours change still publishes", () => {
  test.each([
    ["a monthly-only listing", [sched({ daysOfMonth: "2nd" })], "hours_irregular", "hours_weekly"],
    ["a weekly-only listing", [sched({})], "hours_weekly", "hours_irregular"],
  ])("%s changes only that field, leaves the other as stored, and passes Publish validation", async (_label, schedules, changed, untouched) => {
    const db = setup();
    const venueRow = db.prepare("SELECT id, name, category, lat, lng, address, hours_weekly, hours_irregular, phone, url, operator, last_verified FROM venues").get() as CurrentVenueRow;
    const before = (db.prepare(`SELECT ${untouched} AS v FROM venues`).get() as { v: string }).v;
    const built = buildCareAndShareProposals({
      locations: [location], schedules, venues: [venueRow], aliases: [{ source: "care_and_share", upstream_id: "cas-42", venue_id: VENUE }],
      runId: "r", today: "2026-10-26", fetchedAt: "2026-10-26T06:00:00Z",
    });
    const [p] = built.proposals;
    expect(p.proposedDiff.fields_changed).toEqual([changed, "last_verified"]);
    expect((p.proposedDiff.before as Record<string, unknown>)[changed]).toBe(changed === "hours_weekly" ? WEEKLY_12H : MONTHLY_12H);

    for (const st of buildProposalWriteStatements(p, "2026-10-26T06:00:00Z", sql).statements) db.exec(st);
    const row = db.prepare("SELECT * FROM change_proposals WHERE status = 'pending'").get() as ChangeProposalRow;
    const result = await applyApprovedProposal(sqliteD1(db), row, { email: "admin@example.com" });
    expect(result.ok, JSON.stringify(result)).toBe(true);

    const stored = db.prepare("SELECT * FROM venues").get() as VenueRow & Record<string, string>;
    expect(stored[untouched]).toBe(before);
    const published = validateAndMapRow(stored);
    expect(published.ok, JSON.stringify(published)).toBe(true);
  });
});
