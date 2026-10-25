// @vitest-environment node
// GET /api/admin/source-switch against real SQLite: counts come from the
// real history query, and an unauthenticated caller gets nothing.
import { describe, expect, test, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { AccessDeniedError } from "@/lib/adminOrigin";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({ getAdminDb: (...a: unknown[]) => mockGetAdminDb(...a) }));
vi.mock("@/lib/logger", () => ({ logAdminAuthFailure: vi.fn() }));

import { GET } from "@/app/api/admin/source-switch/route";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf-8"));
  const diff = JSON.stringify({ before: {}, after: {}, fields_changed: ["phone", "last_verified"] });
  for (let i = 0; i < 2; i++) {
    db.prepare(
      `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, reviewed_at, applied_at)
       VALUES ('care_and_share', 'v', 'update', ?, 'h', 'r', 'approved', 'kyle@example.com', ?, ?)`,
    ).run(diff, `2026-10-2${i}T00:00:00.000Z`, `2026-10-2${i}T00:00:00.000Z`);
  }
  return db;
}

const req = () => new NextRequest("https://pueblofoodmap.com/api/admin/source-switch");

describe("GET /api/admin/source-switch", () => {
  test("returns each pair's count", async () => {
    mockGetAdminDb.mockResolvedValue({ db: sqliteD1(buildDb()), identity: { email: "a@b.c" } });
    const body = (await (await GET(req())).json()) as { states: { field: string; streak: number; on: boolean }[] };
    expect(body.states.find((s) => s.field === "phone")).toMatchObject({ streak: 2, on: false });
  });

  test("not signed in -> refused, no data", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("no_session"));
    const res = await GET(req());
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(await res.json())).not.toContain("states");
  });
});
