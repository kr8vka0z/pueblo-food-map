// @vitest-environment node
/**
 * The automatic switch's reset on an admin edit (Venue Data Rebuild step 2,
 * src/lib/sourceSwitch.ts), against real SQLite: editing a field whose
 * value came from an applied Care and Share change records a reset for
 * that (source, field), so an "approve, then fix it" never counts toward 5.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const VENUE_ID = "plentiful-x";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));
const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { PATCH } from "@/app/api/admin/venues/[id]/route";

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf-8"));
  db.prepare(
    `INSERT INTO venues (id, name, category, lat, lng, address, phone, source, last_verified, status, source_type, created_by, updated_by, updated_at)
     VALUES (?, 'X Pantry', 'pantry', 38.25, -104.6, '123 Test St, Pueblo, CO', '719-555-0100', 'plentiful', '2026-10-20', 'published', 'plentiful', 's', 's', '2026-10-20T00:00:00.000Z')`,
  ).run(VENUE_ID);
  db.prepare(
    `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, reviewed_at, applied_at)
     VALUES ('care_and_share', ?, 'update', ?, 'h', 'r', 'approved', 'kyle@example.com', '2026-10-20T00:00:00.000Z', '2026-10-20T00:00:00.000Z')`,
  ).run(VENUE_ID, JSON.stringify({ before: { phone: null }, after: { phone: "719-555-0100" }, fields_changed: ["phone", "last_verified"] }));
  return db;
}

function patch(body: Record<string, unknown>) {
  const req = new NextRequest(`https://pueblofoodmap.com/api/admin/venues/${VENUE_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: ADMIN_ORIGIN },
    body: JSON.stringify({
      name: "X Pantry",
      category: "pantry",
      lat: 38.25,
      lng: -104.6,
      address: "123 Test St, Pueblo, CO",
      source: "plentiful",
      last_verified: "2026-10-26",
      ...body,
    }),
  });
  return PATCH(req, { params: Promise.resolve({ id: VENUE_ID }) });
}

describe("PATCH resets the switch for a field the source set", () => {
  beforeEach(() => mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL }));
  afterEach(() => vi.clearAllMocks());

  test("changing the phone Care and Share set records a reset", async () => {
    const db = buildDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(db) } });
    const res = await patch({ phone: "719-555-0200" });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT source, field, venue_id, reset_by FROM source_switch_resets").all()).toEqual([
      { source: "care_and_share", field: "phone", venue_id: VENUE_ID, reset_by: ADMIN_EMAIL },
    ]);
  });

  test("an edit that leaves the phone alone records nothing", async () => {
    const db = buildDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(db) } });
    const res = await patch({ phone: "719-555-0100", name: "X Pantry Renamed" });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT COUNT(*) AS n FROM source_switch_resets").get()).toEqual({ n: 0 });
  });

  test("a database without migration 0023 still saves the edit (the reset is skipped)", async () => {
    const db = buildDb();
    db.exec("DROP TABLE source_switch_resets");
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(db) } });
    const res = await patch({ phone: "719-555-0200" });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT phone FROM venues").get()).toEqual({ phone: "719-555-0200" });
  });
});
