// @vitest-environment node
/**
 * Real-SQLite proof for #866: an older update card stays approvable after the
 * venue's last_verified moves, approving sets last_verified to the approval
 * date in Denver (never the card's older stamp), and a real field change since
 * the card was made still blocks it. Same harness as
 * adminProposals.duplicates.sql.test.ts.
 */

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { applyApprovedProposal, type ChangeProposalRow } from "@/lib/adminProposals";

// 03:30 UTC on the 28th is still the 27th in Denver.
const APPROVED_AT = new Date("2026-10-28T03:30:00Z");
const HOURS = JSON.stringify([{ ordinal: 3, weekday: 6, open: "09:00", close: "11:00" }]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(APPROVED_AT);
});
afterEach(() => vi.useRealTimers());

function buildDb(lastVerified: string): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, f), "utf-8"));
  }
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
     VALUES ('v1', 'Agape', 'pantry', 38.2, -104.6, '1 Main St, Pueblo, CO', 'manual', ?, 'published', 'manual', 'seed', 'seed')`,
  ).run(lastVerified);
  return db;
}

/** A refresh card made on 2026-09-25 while the venue's last_verified was 2026-05-14. */
function card(db: Database.Database, before: Record<string, unknown>, after: Record<string, unknown>): ChangeProposalRow {
  const diff = JSON.stringify({ before, after, fields_changed: Object.keys(after) });
  const id = Number(
    db
      .prepare(
        `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES ('plentiful', 'v1', 'update', ?, 'h', 'r')`,
      )
      .run(diff).lastInsertRowid,
  );
  return db.prepare("SELECT * FROM change_proposals WHERE id = ?").get(id) as ChangeProposalRow;
}

const venue = (db: Database.Database) =>
  db.prepare("SELECT hours_irregular, last_verified FROM venues WHERE id = 'v1'").get() as { hours_irregular: string; last_verified: string };
const status = (db: Database.Database, id: number) =>
  (db.prepare("SELECT status FROM change_proposals WHERE id = ?").get(id) as { status: string }).status;

it.each([
  ["unchanged since the card was made", "2026-05-14"],
  ["moved after the card was made (the Agape case)", "2026-10-20"],
])("approving an older hours card when last_verified is %s applies it and stamps the approval date", async (_label, current) => {
  const db = buildDb(current);
  const row = card(
    db,
    { hours_irregular: null, last_verified: "2026-05-14" },
    { hours_irregular: JSON.parse(HOURS), last_verified: "2026-09-25" },
  );

  const result = await applyApprovedProposal(sqliteD1(db), row, { email: "a@b.c" });

  expect(result).toMatchObject({ ok: true });
  expect(venue(db)).toEqual({ hours_irregular: HOURS, last_verified: "2026-10-27" });
});

it("a real field that changed since the card was made still blocks it", async () => {
  const db = buildDb("2026-10-20");
  const row = card(db, { phone: null, last_verified: "2026-05-14" }, { phone: "719-555-0100", last_verified: "2026-09-25" });
  db.prepare("UPDATE venues SET phone = '719-555-0199' WHERE id = 'v1'").run();

  const result = await applyApprovedProposal(sqliteD1(db), row, { email: "a@b.c" });

  expect(result).toMatchObject({ ok: false, status: 409, message: `This venue's "phone" changed since the proposal was generated.` });
  expect(status(db, row.id)).toBe("superseded");
  expect(venue(db).last_verified).toBe("2026-10-20");
});

it("a date-only card is still superseded once the venue was verified again", async () => {
  const db = buildDb("2026-10-20");
  const row = card(db, { last_verified: "2026-05-14" }, { last_verified: "2026-09-25" });

  const result = await applyApprovedProposal(sqliteD1(db), row, { email: "a@b.c" });

  expect(result).toMatchObject({ ok: false, status: 409 });
  expect(venue(db).last_verified).toBe("2026-10-20");
});
