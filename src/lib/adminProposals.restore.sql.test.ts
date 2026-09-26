// @vitest-environment node
/**
 * Real-SQLite proof of applyApprovedProposal's RESTORE path (an approved
 * refresh "add" for an archived venue id) for hours_irregular (#400):
 * a restore whose incoming record carries no hours_irregular keeps the
 * stored schedule, and one that does carry it overwrites it. Schema built
 * from every real migration file, same pattern as refreshAlerts.sql.test.ts;
 * a thin D1 shim over better-sqlite3 stands in for the binding.
 */

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { applyApprovedProposal, type ChangeProposalRow } from "@/lib/adminProposals";

const MONTHLY = '[{"ordinal":4,"recurrence":"monthly_ordinal","slots":["11:00 AM - 12:00 PM"],"weekday":"tue"}]';

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, f), "utf-8"));
  }
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, hours_irregular, source, last_verified, status, source_type, created_by, updated_by)
     VALUES ('plentiful-x', 'X Pantry', 'pantry', 38.2, -104.6, '1 Main St, Pueblo, CO', ?, 'plentiful', '2026-05-14', 'archived', 'plentiful', 'seed', 'seed')`,
  ).run(MONTHLY);
  return db;
}

/** Just enough of D1Database for applyApprovedProposal: prepare/bind/first/run + batch. */
function d1(db: Database.Database): D1Database {
  const stmt = (sql: string, params: unknown[] = []) => ({
    bind: (...p: unknown[]) => stmt(sql, p),
    first: async () => db.prepare(sql).get(...params) ?? null,
    run: async () => ({ meta: { changes: db.prepare(sql).run(...params).changes } }),
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const out: unknown[] = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as D1Database;
}

function addProposal(db: Database.Database, after: Record<string, unknown>): ChangeProposalRow {
  const diff = JSON.stringify({ before: null, after, fields_changed: Object.keys(after) });
  const id = Number(
    db
      .prepare(
        `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES ('plentiful', 'plentiful-x', 'add', ?, 'h', 'r')`,
      )
      .run(diff).lastInsertRowid,
  );
  return db.prepare("SELECT * FROM change_proposals WHERE id = ?").get(id) as ChangeProposalRow;
}

const BASE_AFTER = {
  id: "plentiful-x",
  name: "X Pantry",
  category: "pantry",
  lat: 38.2,
  lng: -104.6,
  address: "1 Main St, Pueblo, CO",
  source: "directory.plentiful.org/colorado/pueblo",
  last_verified: "2026-09-24",
};

describe("applyApprovedProposal restore path — hours_irregular (#400)", () => {
  test("incoming record without hours_irregular keeps the stored schedule", async () => {
    const db = buildDb();
    const result = await applyApprovedProposal(d1(db), addProposal(db, BASE_AFTER), { email: "a@b.c" });
    expect(result.ok).toBe(true);
    const row = db.prepare("SELECT status, hours_irregular FROM venues WHERE id = 'plentiful-x'").get();
    expect(row).toEqual({ status: "draft", hours_irregular: MONTHLY });
  });

  test("incoming record with hours_irregular overwrites it", async () => {
    const db = buildDb();
    const next = [{ recurrence: "monthly_ordinal", ordinal: 2, weekday: "thu", slots: ["11:00 AM - 12:45 PM"] }];
    const result = await applyApprovedProposal(d1(db), addProposal(db, { ...BASE_AFTER, hours_irregular: next }), {
      email: "a@b.c",
    });
    expect(result.ok).toBe(true);
    const row = db.prepare("SELECT hours_irregular FROM venues WHERE id = 'plentiful-x'").get() as { hours_irregular: string };
    expect(JSON.parse(row.hours_irregular)).toEqual(next);
  });
});
