// @vitest-environment node
/**
 * Rejecting a Care and Share proposal from a first-run strong match
 * (meta.new_alias, scripts/refresh/careAndShare.ts) undoes the link the
 * pipeline wrote that run — against real SQLite with every migration, so
 * the trigger in migration 0024 is what's proven.
 */

import { describe, expect, test, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));
vi.mock("@/lib/adminSession", () => ({ requireAdminSession: async () => ({ email: "admin@pueblofoodmap.com" }) }));

import { POST } from "@/app/api/admin/proposals/[id]/reject/route";

function buildDb(meta: Record<string, unknown>): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf-8"));
  const alias = db.prepare("INSERT INTO venue_id_aliases (source, upstream_id, venue_id, created_by) VALUES (?, ?, ?, 'refresh-pipeline')");
  alias.run("care_and_share", "cas-7", "venue-1");
  alias.run("care_and_share", "cas-8", "venue-2");
  db.prepare(
    `INSERT INTO change_proposals (id, source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES (5, 'care_and_share', 'venue-1', 'update', ?, 'h', 'r')`,
  ).run(JSON.stringify({ before: {}, after: {}, fields_changed: ["phone", "last_verified"], meta }));
  return db;
}

async function reject(db: Database.Database) {
  mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(db) } });
  const req = new NextRequest("https://pueblofoodmap.com/api/admin/proposals/5/reject", { method: "POST", headers: { Origin: ADMIN_ORIGIN } });
  return POST(req, { params: Promise.resolve({ id: "5" }) });
}

const aliases = (db: Database.Database) => db.prepare("SELECT upstream_id FROM venue_id_aliases ORDER BY upstream_id").all();

describe("rejecting a first-run link undoes it", () => {
  test("meta.new_alias -> that alias row is deleted, others stay", async () => {
    const db = buildDb({ new_alias: { upstream_id: "cas-7" } });
    expect((await reject(db)).status).toBe(200);
    expect(aliases(db)).toEqual([{ upstream_id: "cas-8" }]);
  });

  test("no new_alias -> aliases untouched", async () => {
    const db = buildDb({ locationId: 7 });
    expect((await reject(db)).status).toBe(200);
    expect(aliases(db)).toEqual([{ upstream_id: "cas-7" }, { upstream_id: "cas-8" }]);
  });
});
