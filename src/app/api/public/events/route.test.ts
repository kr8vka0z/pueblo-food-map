// @vitest-environment node
/**
 * GET /api/public/events (#757). Runs the real route against real SQLite
 * (schema from migrations/0018_events.sql) so the feed filter, the privacy
 * of the response and — the production-safety requirement — the missing-table
 * fail-soft path are proved with real SQL errors, not a mock.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { GET } from "@/app/api/public/events/route";

const originalCaches = (globalThis as { caches?: unknown }).caches;
const req = () => new NextRequest("https://pueblofoodmap.com/api/public/events");

function dbWithMigration(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0018_events.sql"), "utf-8"));
  return db;
}

function addEvent(db: Database.Database, id: string, status: string, endsAt: string) {
  db.prepare(
    `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, created_by, updated_by, cancel_note)
     VALUES (?, ?, '2026-01-01T00:00:00.000Z', ?, 38.25, -104.6, '1 Main St', ?, 'secret-admin@example.com', 'secret-admin@example.com', 'internal note')`,
  ).run(id, `Event ${id}`, endsAt, status);
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

describe("GET /api/public/events", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    delete (globalThis as { caches?: unknown }).caches;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    (globalThis as { caches?: unknown }).caches = originalCaches;
    vi.restoreAllMocks();
  });

  test("serves only published events that have not ended, with no internal fields", async () => {
    const db = dbWithMigration();
    addEvent(db, "live", "published", FUTURE);
    addEvent(db, "draft", "draft", FUTURE);
    addEvent(db, "cancelled", "cancelled", FUTURE);
    addEvent(db, "archived", "archived", FUTURE);
    addEvent(db, "ended", "published", PAST);
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(db) }, ctx: { waitUntil: vi.fn() } });

    const res = await GET(req());
    const body = await res.text();

    expect(res.status).toBe(200);
    expect((JSON.parse(body) as { events: { id: string }[] }).events.map((e) => e.id)).toEqual(["live"]);
    expect(body).not.toContain("secret-admin@example.com");
    expect(body).not.toContain("internal note");
  });

  test("FAIL SOFT: the events table does not exist yet -> 200 with an empty list, not a 500", async () => {
    const noTable = new Database(":memory:");
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(noTable) }, ctx: { waitUntil: vi.fn() } });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [] });
  });

  test("FAIL SOFT: the failure answer is never stored in the edge cache (a late migration shows up at once)", async () => {
    const put = vi.fn();
    (globalThis as { caches?: unknown }).caches = {
      default: { match: vi.fn().mockResolvedValue(undefined), put },
    };
    const noTable = new Database(":memory:");
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(noTable) }, ctx: { waitUntil: vi.fn() } });

    await GET(req());

    expect(put).not.toHaveBeenCalled();
  });

  test("a healthy answer is cached for at most 60 seconds", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    (globalThis as { caches?: unknown }).caches = {
      default: { match: vi.fn().mockResolvedValue(undefined), put },
    };
    mockGetCloudflareContext.mockReturnValue({
      env: { ADMIN_DB: sqliteD1(dbWithMigration()) },
      ctx: { waitUntil: (p: Promise<unknown>) => p },
    });

    const res = await GET(req());

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(put).toHaveBeenCalledTimes(1);
  });
});
