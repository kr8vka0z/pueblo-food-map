// @vitest-environment node
/**
 * Real-SQLite proof that approving one update card supersedes the venue's other
 * pending cards whose change is now already on the map (duplicate cards, e.g.
 * a website card beside a hand-checked one with the same phone), and leaves a
 * card proposing a different value pending, as well as needs_review and
 * new_alias cards, which a person still has to act on. Same harness as
 * adminProposals.restore.sql.test.ts.
 */

import { test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { applyApprovedProposal, type ChangeProposalRow } from "@/lib/adminProposals";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, f), "utf-8"));
  }
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
     VALUES ('v1', 'Agape', 'pantry', 38.2, -104.6, '1 Main St, Pueblo, CO', 'manual', '2026-05-14', 'published', 'manual', 'seed', 'seed')`,
  ).run();
  return db;
}

function updateProposal(db: Database.Database, after: Record<string, unknown>, meta?: Record<string, unknown>): ChangeProposalRow {
  const fields = Object.keys(after);
  const before = Object.fromEntries(fields.map((f) => [f, f === "last_verified" ? "2026-05-14" : null]));
  const diff = JSON.stringify({ before, after, fields_changed: fields, ...(meta ? { meta } : {}) });
  const id = Number(
    db
      .prepare(
        `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES ('website', 'v1', 'update', ?, ?, 'r')`,
      )
      .run(diff, `h${Math.random()}`).lastInsertRowid,
  );
  return db.prepare("SELECT * FROM change_proposals WHERE id = ?").get(id) as ChangeProposalRow;
}

test("approving a card supersedes a pending duplicate and leaves a differing card pending", async () => {
  const db = buildDb();
  const a = updateProposal(db, { phone: "(719) 542-1411", url: "https://agape.example", last_verified: "2026-10-20" });
  const b = updateProposal(db, { phone: "(719) 542-1411", last_verified: "2026-10-19" });
  const c = updateProposal(db, { phone: "(719) 555-0000", last_verified: "2026-10-19" });
  // Same value, but each carries something a person must still act on.
  const d = updateProposal(db, { phone: "(719) 542-1411", last_verified: "2026-10-19" }, { needs_review: ["hours unclear"] });
  const e = updateProposal(db, { phone: "(719) 542-1411", last_verified: "2026-10-19" }, { new_alias: { upstream_id: "cas-1" } });

  const result = await applyApprovedProposal(sqliteD1(db), a, { email: "a@b.c" });
  expect(result.ok).toBe(true);

  const status = (id: number) => (db.prepare("SELECT status FROM change_proposals WHERE id = ?").get(id) as { status: string }).status;
  expect([status(a.id), status(b.id), status(c.id), status(d.id), status(e.id)]).toEqual([
    "approved",
    "superseded",
    "pending",
    "pending",
    "pending",
  ]);
});
