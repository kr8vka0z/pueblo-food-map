// @vitest-environment node
/**
 * GET /api/public/events/[id] (#759). Real route over real SQLite (schema from
 * migrations/0018_events.sql), so the privacy rule (never a draft or archived
 * row, indistinguishable from an unknown id) and the fail-soft path are proved
 * with real SQL, not a mock.
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

import { GET } from "@/app/api/public/events/[id]/route";

const originalCaches = (globalThis as { caches?: unknown }).caches;
const call = (id: string) =>
  GET(new NextRequest(`https://pueblofoodmap.com/api/public/events/${id}`), { params: Promise.resolve({ id }) });

function dbWithMigration(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0018_events.sql"), "utf-8"));
  return db;
}

function addEvent(db: Database.Database, id: string, status: string, endsAt: string, cancelNote: string | null = null) {
  db.prepare(
    `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, created_by, updated_by, cancel_note)
     VALUES (?, ?, '2026-01-01T00:00:00.000Z', ?, 38.25, -104.6, '1 Main St', ?, 'secret-admin@example.com', 'secret-admin@example.com', ?)`,
  ).run(id, `Event ${id}`, endsAt, status, cancelNote);
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

describe("GET /api/public/events/[id]", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    delete (globalThis as { caches?: unknown }).caches;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    (globalThis as { caches?: unknown }).caches = originalCaches;
    vi.restoreAllMocks();
  });

  test("a published event is readable after it ended; a cancelled one carries its note", async () => {
    const db = dbWithMigration();
    addEvent(db, "ended", "published", PAST, "left over from an earlier cancel");
    addEvent(db, "off", "cancelled", FUTURE, "Cancelled for weather");
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(db) }, ctx: { waitUntil: vi.fn() } });

    const ended = await call("ended");
    const endedBody = await ended.json();
    expect(ended.status).toBe(200);
    expect(endedBody.event.status).toBe("published");
    // A note left on a republished event must never surface.
    expect(endedBody.event.cancel_note).toBeNull();

    const off = await call("off");
    const offBody = await off.json();
    expect(off.status).toBe(200);
    expect(offBody.event).toMatchObject({ status: "cancelled", cancel_note: "Cancelled for weather" });
  });

  test("draft, archived and unknown ids all answer the same 404, and no internal field leaks", async () => {
    const db = dbWithMigration();
    addEvent(db, "draft", "draft", FUTURE);
    addEvent(db, "archived", "archived", FUTURE);
    addEvent(db, "live", "published", FUTURE);
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(db) }, ctx: { waitUntil: vi.fn() } });

    const draft = await call("draft");
    const archived = await call("archived");
    const unknown = await call("nope");
    const bodies = await Promise.all([draft.text(), archived.text(), unknown.text()]);

    expect([draft.status, archived.status, unknown.status]).toEqual([404, 404, 404]);
    expect(new Set(bodies).size).toBe(1);

    const live = await (await call("live")).text();
    expect(live).not.toContain("secret-admin@example.com");
  });

  test("FAIL SOFT: the events table does not exist yet -> 404, not a 500", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(new Database(":memory:")) }, ctx: { waitUntil: vi.fn() } });

    const res = await call("anything");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ event: null });
  });

  test("only a 200 is stored in the edge cache", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    (globalThis as { caches?: unknown }).caches = { default: { match: vi.fn().mockResolvedValue(undefined), put, delete: vi.fn() } };
    const db = dbWithMigration();
    addEvent(db, "live", "published", FUTURE);
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(db) }, ctx: { waitUntil: (p: Promise<unknown>) => void p } });

    await call("missing");
    expect(put).not.toHaveBeenCalled();

    await call("live");
    expect(put).toHaveBeenCalledTimes(1);
  });
});
