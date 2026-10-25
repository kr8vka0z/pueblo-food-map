// @vitest-environment node
/**
 * Real-SQLite proof for migration 0025 (Venue Data Rebuild step 3): the
 * seeded rejection keeps Friendly Harbor's known-stale website value ("last
 * Friday, 1-3 PM") out of Kyle's queue for good, while any OTHER new value
 * from its site still reaches review, pinned. Every migration is applied in
 * order, the same way `wrangler d1 migrations apply` does, and the rejected
 * rows are read back through the same SQL the refresh job uses.
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { buildProposalWriteStatements, type PinRow } from "../../scripts/refresh/proposalSql";
import { buildWebsiteProposals, REJECTED_WEBSITE_SQL, rejectedFieldValues, verifyPlace } from "../../scripts/refresh/website";
import type { CurrentVenueRow } from "../../scripts/refresh/diffEngine";
import { SWITCH_HISTORY_SQL } from "@/lib/sourceSwitch";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const ALL = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const FH = "manual-f3d3712c-caf1-40a0-a3cd-b3dc38e14c00";
const LAST_WEDNESDAY = JSON.stringify([{ recurrence: "monthly_ordinal", ordinal: "last", weekday: "wed", slots: ["1:00 PM - 3:00 PM"] }]);

function setup() {
  const db = new Database(":memory:");
  const apply = (f: string) => db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf-8"));
  // Friendly Harbor exists before 0021 (which pins its hours) and 0025 (which seeds the rejection).
  for (const f of ALL.filter((f) => f < "0021")) apply(f);
  db.prepare(
    "INSERT INTO venues (id, name, category, lat, lng, address, hours_irregular, url, source, last_verified, source_type, status, created_by, updated_by) " +
      "VALUES (?, 'Friendly Harbor Community Center', 'pantry', 38.29, -104.61, '2713 N Grand Ave, Pueblo, CO 81003', ?, 'https://friendlyharborpueblo.org/', 'Feedback', '2026-10-12', 'manual', 'published', 'seed', 'seed')",
  ).run(FH, LAST_WEDNESDAY);
  for (const f of ALL.filter((f) => f >= "0021")) apply(f);
  return { db, apply };
}

function fhRow(db: Database.Database): CurrentVenueRow {
  return db.prepare("SELECT id, name, category, lat, lng, address, hours_weekly, hours_irregular, phone, url, operator, last_verified FROM venues WHERE id = ?").get(FH) as CurrentVenueRow;
}

/** What the reader would build from a page saying `quote`, with Gemini reading it as `entries`. */
function readerProposals(db: Database.Database, quote: string, entries: object[]) {
  const text = `Friendly Harbor Community Center 2713 North Grand Ave. ${quote}.`;
  const verified = verifyPlace({ hours: { about: "food_service", quote, entries } }, text);
  const rejected = rejectedFieldValues(db.prepare(REJECTED_WEBSITE_SQL).all() as { target_venue_id: string; proposed_diff: string }[]);
  return buildWebsiteProposals({ venue: fhRow(db), verified, pageUrl: "https://friendlyharborpueblo.org/", fetchedAt: "2026-10-26T08:00:00Z", runId: "r", today: "2026-10-26", rejected });
}

const FRIDAY = [{ weekday: "fri", ordinal: "last", opens: "13:00", closes: "15:00" }];

describe("0025 Friendly Harbor seeded rejection", () => {
  test("the website's 'last Friday' is never proposed, alone or bundled with another change", () => {
    const { db } = setup();
    const alone = readerProposals(db, "Food Pantry: open to the public the last Friday of the month, 1-3 PM", FRIDAY);
    expect(alone.map((p) => p.proposedDiff.fields_changed)).toEqual([["last_verified"]]);
    expect(alone[0].proposedDiff.meta?.needs_review).toBeUndefined();

    // Same Friday plus a weekly slot: the Friday half still never shows.
    const bundled = readerProposals(db, "Food Pantry: Tuesdays 10am-12pm and the last Friday of the month 1-3 PM", [
      { weekday: "tue", ordinal: "every", opens: "10:00", closes: "12:00" },
      ...FRIDAY,
    ]);
    expect(bundled[0].proposedDiff.fields_changed).toEqual(["hours_weekly", "last_verified"]);
  });

  test("the seed's diff_hash is exactly what the reader produces for that value (whole-proposal rejection memory agrees)", () => {
    const { db } = setup();
    db.prepare("DELETE FROM change_proposals WHERE run_id = 'venue-pin-seeds-0025'").run();
    const [p] = readerProposals(db, "Food Pantry: open to the public the last Friday of the month, 1-3 PM", FRIDAY);
    const { db: seeded } = setup();
    const seed = seeded.prepare("SELECT diff_hash, status, proposed_diff FROM change_proposals WHERE run_id = 'venue-pin-seeds-0025'").get() as { diff_hash: string; status: string; proposed_diff: string };
    expect(seed.status).toBe("rejected");
    expect(seed.diff_hash).toBe(p.diffHash);
    expect(JSON.parse(seed.proposed_diff).after.hours_irregular).toBe(p.proposedDiff.after!.hours_irregular);
  });

  test("a different new value from its site still goes to review, with the venue's pin beside it", () => {
    const { db } = setup();
    const [p] = readerProposals(db, "Food Pantry: the 2nd Tuesday of the month, 1-3 PM", [{ weekday: "tue", ordinal: 2, opens: "13:00", closes: "15:00" }].map((e) => ({ ...e, ordinal: "2" })));
    expect(p.proposedDiff.fields_changed).toEqual(["hours_irregular", "last_verified"]);
    const pins = db.prepare("SELECT venue_id, field, fetched_at, pinned_by, pin_note FROM venue_observations WHERE is_pin = 1").all() as PinRow[];
    const built = buildProposalWriteStatements(p, "2026-10-26T08:00:00Z", (v) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`), { pins });
    expect(built.autoApplied).toBe(false);
    expect(built.statements.join("\n")).toMatch(/"pins":\[\{"field":"hours_irregular"/);
  });

  test("re-applying 0025 adds nothing, and the seed never counts toward the automatic switch", () => {
    const { db, apply } = setup();
    apply("0025_website_reader.sql");
    expect((db.prepare("SELECT COUNT(*) AS n FROM change_proposals WHERE run_id = 'venue-pin-seeds-0025'").get() as { n: number }).n).toBe(1);
    expect(db.prepare(SWITCH_HISTORY_SQL).all()).toEqual([]);
  });
});
