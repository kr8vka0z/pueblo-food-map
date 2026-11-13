// @vitest-environment node
/**
 * Rejecting a proposal saves the card's optional reason (#904), against real
 * SQLite built from every migration, so 0028's review_reason column is what's
 * proven.
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

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf-8"));
  db.prepare(
    `INSERT INTO change_proposals (id, source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES (5, 'care_and_share', 'venue-1', 'update', ?, 'h', 'r')`,
  ).run(JSON.stringify({ before: {}, after: {}, fields_changed: ["phone"] }));
  return db;
}

async function rejectWith(body: string | undefined) {
  const db = buildDb();
  mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(db) } });
  const req = new NextRequest("https://pueblofoodmap.com/api/admin/proposals/5/reject", {
    method: "POST",
    headers: { Origin: ADMIN_ORIGIN },
    body,
  });
  const res = await POST(req, { params: Promise.resolve({ id: "5" }) });
  return { status: res.status, row: db.prepare("SELECT status, review_reason FROM change_proposals WHERE id = 5").get() };
}

describe("proposal reject saves the reason", () => {
  test("a reason is trimmed and saved with the reject", async () => {
    expect(await rejectWith(JSON.stringify({ reason: "  spec-904 check  " }))).toEqual({
      status: 200,
      row: { status: "rejected", review_reason: "spec-904 check" },
    });
  });

  test("no body saves null", async () => {
    expect(await rejectWith(undefined)).toEqual({ status: 200, row: { status: "rejected", review_reason: null } });
  });
});
