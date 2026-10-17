// @vitest-environment node
/**
 * Admin events write routes (#757): POST /api/admin/events, PATCH
 * /api/admin/events/[id], POST /api/admin/events/[id]/archive.
 *
 * Runs the real route handlers, real getAdminDb()/requireAdminOrigin(), and
 * real SQLite built from the migration files (0001 audit_log, 0017
 * audit_log.session_id, 0018 events). Only the Better Auth session check and
 * the Cloudflare context are mocked, same seam as venues/[id]/archive's test.
 * Covers the risky behavior: origin enforcement, the one-batch audit row,
 * the 409 precondition (and that a rejected write leaves no audit row),
 * lifecycle transitions, archive-not-delete, and the feed cache purge.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/adminOrigin";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));
const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST as createEvent } from "@/app/api/admin/events/route";
import { PATCH as patchEvent } from "@/app/api/admin/events/[id]/route";
import { POST as archiveEvent } from "@/app/api/admin/events/[id]/archive/route";

let sqlite: Database.Database;
const originalCaches = (globalThis as { caches?: unknown }).caches;
let cacheDelete: ReturnType<typeof vi.fn>;

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  for (const f of ["0001_init_admin_schema.sql", "0017_auth_events.sql", "0018_events.sql"]) {
    db.exec(readFileSync(join(process.cwd(), "migrations", f), "utf-8"));
  }
  return db;
}

function req(url: string, method: string, body?: unknown, origin: string | null = ADMIN_ORIGIN): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin !== null) headers.Origin = origin;
  return new NextRequest(`https://pueblofoodmap.com${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const payload = (over: Record<string, unknown> = {}) => ({
  action: "save_draft",
  name: "Turkey drive",
  starts_at_local: "2026-11-21T10:00",
  ends_at_local: "2026-11-21T14:00",
  address: "123 Main St, Pueblo, CO",
  lat: 38.25,
  lng: -104.6,
  ...over,
});

async function create(over: Record<string, unknown> = {}) {
  const res = await createEvent(req("/api/admin/events", "POST", payload(over)));
  return (await res.json()) as { ok: boolean; id: string; updated_at: string; status: string };
}
const patch = (id: string, body: Record<string, unknown>) =>
  patchEvent(req(`/api/admin/events/${id}`, "PATCH", body), { params: Promise.resolve({ id }) });
const archive = (id: string, body?: unknown) =>
  archiveEvent(req(`/api/admin/events/${id}/archive`, "POST", body), { params: Promise.resolve({ id }) });

const rowOf = (id: string) => sqlite.prepare("SELECT * FROM events WHERE id = ?").get(id) as Record<string, unknown>;
const auditCount = () => (sqlite.prepare("SELECT COUNT(*) AS n FROM audit_log").get() as { n: number }).n;

beforeEach(() => {
  sqlite = freshDb();
  mockGetCloudflareContext.mockReset();
  mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(sqlite) } });
  mockRequireAdminSession.mockReset();
  mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL, sessionId: "sess-1" });
  cacheDelete = vi.fn().mockResolvedValue(true);
  (globalThis as { caches?: unknown }).caches = { default: { delete: cacheDelete } };
});
afterEach(() => {
  (globalThis as { caches?: unknown }).caches = originalCaches;
});

describe("origin and session enforcement", () => {
  test.each([
    ["create", () => createEvent(req("/api/admin/events", "POST", payload(), "https://evil.example.com"))],
    ["patch", () => patchEvent(req("/api/admin/events/x", "PATCH", payload(), null), { params: Promise.resolve({ id: "x" }) })],
    ["archive", () => archiveEvent(req("/api/admin/events/x/archive", "POST", undefined, "https://evil.example.com"), { params: Promise.resolve({ id: "x" }) })],
  ])("%s with a wrong or missing Origin -> 403 and nothing is written", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(403);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM events").get()).toEqual({ n: 0 });
    expect(auditCount()).toBe(0);
  });

  test("no session -> 401, nothing written", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    const res = await createEvent(req("/api/admin/events", "POST", payload()));
    expect(res.status).toBe(401);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM events").get()).toEqual({ n: 0 });
  });
});

describe("POST /api/admin/events", () => {
  test("save draft: row stored as a draft with UTC times, one audit row with the session id, feed cache purged", async () => {
    const out = await create();

    expect(out.ok).toBe(true);
    const row = rowOf(out.id);
    expect(row).toMatchObject({
      status: "draft",
      starts_at: "2026-11-21T17:00:00.000Z",
      ends_at: "2026-11-21T21:00:00.000Z",
      published_at: null,
      created_by: ADMIN_EMAIL,
    });
    expect(sqlite.prepare("SELECT entity, entity_id, action, actor_email, session_id FROM audit_log").all()).toEqual([
      { entity: "event", entity_id: out.id, action: "create", actor_email: ADMIN_EMAIL, session_id: "sess-1" },
    ]);
    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(String((cacheDelete.mock.calls[1][0] as Request).url)).toBe("https://pueblofoodmap.com/api/public/events/" + out.id);
    expect(String((cacheDelete.mock.calls[0][0] as Request).url)).toBe("https://pueblofoodmap.com/api/public/events");
  });

  test("publish on create sets published_at", async () => {
    const out = await create({ action: "publish" });
    expect(rowOf(out.id)).toMatchObject({ status: "published" });
    expect(rowOf(out.id).published_at).toBeTruthy();
  });

  test("invalid payload -> 422 with field errors, nothing written, cache untouched", async () => {
    const res = await createEvent(req("/api/admin/events", "POST", payload({ name: "", ends_at_local: "2026-11-21T09:00", address: "", lat: undefined, lng: undefined })));
    const data = (await res.json()) as { errors: Record<string, string> };

    expect(res.status).toBe(422);
    expect(Object.keys(data.errors).sort()).toEqual(["ends_at", "name", "place"]);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM events").get()).toEqual({ n: 0 });
    expect(cacheDelete).not.toHaveBeenCalled();
  });

  test("the events table is missing -> 500 JSON, not a crash", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(new Database(":memory:")) } });
    const res = await createEvent(req("/api/admin/events", "POST", payload()));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/events/[id]", () => {
  test("edit with the right updated_at saves, writes one more audit row, and purges the feed", async () => {
    const created = await create();
    cacheDelete.mockClear();

    const res = await patch(created.id, { ...payload({ action: "save", name: "Renamed" }), expectedUpdatedAt: created.updated_at });

    expect(res.status).toBe(200);
    expect(rowOf(created.id)).toMatchObject({ name: "Renamed", status: "draft" });
    expect(auditCount()).toBe(2);
    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(String((cacheDelete.mock.calls[1][0] as Request).url)).toBe("https://pueblofoodmap.com/api/public/events/" + created.id);
  });

  test("a stale updated_at -> 409 conflict, the row is unchanged and NO audit row is written", async () => {
    const created = await create();

    const res = await patch(created.id, { ...payload({ action: "save", name: "Stale write" }), expectedUpdatedAt: "2020-01-01T00:00:00.000Z" });

    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("conflict");
    expect(rowOf(created.id).name).toBe("Turkey drive");
    expect(auditCount()).toBe(1); // only the create
  });

  test("the precondition is mandatory", async () => {
    const created = await create();
    const res = await patch(created.id, payload({ action: "save" }));
    expect(res.status).toBe(422);
  });

  test("publish a draft: becomes published with published_at; audit action 'publish'", async () => {
    const created = await create();
    const res = await patch(created.id, { ...payload({ action: "publish" }), expectedUpdatedAt: created.updated_at });

    expect(res.status).toBe(200);
    expect(rowOf(created.id).status).toBe("published");
    expect(rowOf(created.id).published_at).toBeTruthy();
    expect(sqlite.prepare("SELECT action FROM audit_log ORDER BY id DESC LIMIT 1").get()).toEqual({ action: "publish" });
  });

  test("cancel requires a note; with one a published event becomes cancelled and keeps the note", async () => {
    const created = await create({ action: "publish" });

    const noNote = await patch(created.id, { ...payload({ action: "cancel" }), expectedUpdatedAt: created.updated_at });
    expect(noNote.status).toBe(422);
    expect(rowOf(created.id).status).toBe("published");

    const ok = await patch(created.id, { ...payload({ action: "cancel", cancel_note: "Weather" }), expectedUpdatedAt: created.updated_at });
    expect(ok.status).toBe(200);
    expect(rowOf(created.id)).toMatchObject({ status: "cancelled", cancel_note: "Weather" });
  });

  test("a draft can't be cancelled, and a cancelled event can't be re-published (409 bad_state)", async () => {
    const draft = await create();
    const cancelDraft = await patch(draft.id, { ...payload({ action: "cancel", cancel_note: "x" }), expectedUpdatedAt: draft.updated_at });
    expect(cancelDraft.status).toBe(409);
    expect(((await cancelDraft.json()) as { error: string }).error).toBe("bad_state");

    const live = await create({ action: "publish" });
    const cancelled = (await (await patch(live.id, { ...payload({ action: "cancel", cancel_note: "x" }), expectedUpdatedAt: live.updated_at })).json()) as { updated_at: string };
    const republish = await patch(live.id, { ...payload({ action: "publish" }), expectedUpdatedAt: cancelled.updated_at });
    expect(republish.status).toBe(409);
  });

  test("unknown id -> 404; archived event -> 409 and read-only", async () => {
    expect((await patch("nope", { ...payload({ action: "save" }), expectedUpdatedAt: "x" })).status).toBe(404);

    const created = await create();
    const archived = (await (await archive(created.id)).json()) as { updated_at: string };
    const res = await patch(created.id, { ...payload({ action: "save" }), expectedUpdatedAt: archived.updated_at });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("archived");
  });
});

describe("POST /api/admin/events/[id]/archive", () => {
  test("archives (the row is kept, never deleted), writes an 'archive' audit row, purges the feed", async () => {
    const created = await create({ action: "publish" });
    cacheDelete.mockClear();

    const res = await archive(created.id, { expectedUpdatedAt: created.updated_at });

    expect(res.status).toBe(200);
    expect(rowOf(created.id).status).toBe("archived");
    expect(sqlite.prepare("SELECT action FROM audit_log ORDER BY id DESC LIMIT 1").get()).toEqual({ action: "archive" });
    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(String((cacheDelete.mock.calls[1][0] as Request).url)).toBe("https://pueblofoodmap.com/api/public/events/" + created.id);
  });

  test("a stale expectedUpdatedAt -> 409, not archived, no audit row", async () => {
    const created = await create({ action: "publish" });
    const res = await archive(created.id, { expectedUpdatedAt: "2020-01-01T00:00:00.000Z" });

    expect(res.status).toBe(409);
    expect(rowOf(created.id).status).toBe("published");
    expect(auditCount()).toBe(1);
  });

  test("unknown id -> 404; already archived -> 409", async () => {
    expect((await archive("nope")).status).toBe(404);
    const created = await create();
    await archive(created.id);
    expect((await archive(created.id)).status).toBe(409);
  });
});
