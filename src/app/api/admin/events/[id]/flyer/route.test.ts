// @vitest-environment node
/**
 * Admin flyer route (#760): POST / DELETE / GET /api/admin/events/[id]/flyer.
 *
 * Real route handlers, real getAdminDb()/requireAdminOrigin() and real SQLite
 * built from the migration files; R2 is an in-memory fake that records every
 * call, so "storage was not touched" is a checkable fact. Covers the risky
 * behavior only: access gate before storage, real-bytes type check, the size
 * cap, server-made keys, replace/remove delete the old object, the stale-write
 * 409 (and that it cleans up its upload), the audit row, and fail-soft when
 * migration 0019 has not been applied.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/adminOrigin";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { MAX_FLYER_BYTES, FLYER_FILE_RE } from "@/lib/eventFlyers";
import { htmlBytes, jpegBytes, pngBytes, svgBytes } from "@/lib/eventFlyers.testutil";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));
const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { DELETE as removeFlyer, GET as previewFlyer, POST as uploadFlyer } from "@/app/api/admin/events/[id]/flyer/route";

let sqlite: Database.Database;
let objects: Map<string, { bytes: ArrayBuffer; contentType?: string }>;
let r2Calls: string[];
let cacheDelete: ReturnType<typeof vi.fn>;
const originalCaches = (globalThis as { caches?: unknown }).caches;

function fakeR2() {
  return {
    put: vi.fn(async (key: string, bytes: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) => {
      r2Calls.push(`put ${key}`);
      objects.set(key, { bytes, contentType: opts?.httpMetadata?.contentType });
    }),
    get: vi.fn(async (key: string) => {
      r2Calls.push(`get ${key}`);
      const o = objects.get(key);
      return o ? { arrayBuffer: async () => o.bytes } : null;
    }),
    delete: vi.fn(async (key: string) => {
      r2Calls.push(`delete ${key}`);
      objects.delete(key);
    }),
  };
}

function freshDb(migrations = ["0001_init_admin_schema.sql", "0017_auth_events.sql", "0018_events.sql", "0019_event_flyer.sql"]) {
  const db = new Database(":memory:");
  for (const f of migrations) db.exec(readFileSync(join(process.cwd(), "migrations", f), "utf-8"));
  db.prepare(
    `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, created_by, updated_by, updated_at)
     VALUES (?, 'Turkey drive', '2026-11-21T17:00:00.000Z', '2026-11-21T21:00:00.000Z', 38.25, -104.6, '1 Main St', 'draft', 'a@x.com', 'a@x.com', '2026-10-01T00:00:00.000Z')`,
  ).run(EVENT_ID);
  return db;
}

function setup(db: Database.Database) {
  sqlite = db;
  objects = new Map();
  r2Calls = [];
  mockGetCloudflareContext.mockReset();
  mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: sqliteD1(db), EVENT_FLYERS: fakeR2() } });
}

beforeEach(() => {
  setup(freshDb());
  mockRequireAdminSession.mockReset();
  mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL, sessionId: "sess-1" });
  cacheDelete = vi.fn().mockResolvedValue(true);
  (globalThis as { caches?: unknown }).caches = { default: { delete: cacheDelete } };
});
afterEach(() => {
  (globalThis as { caches?: unknown }).caches = originalCaches;
});

const ctx = { params: Promise.resolve({ id: EVENT_ID }) };
const row = () => sqlite.prepare("SELECT * FROM events WHERE id = ?").get(EVENT_ID) as Record<string, unknown>;
const version = () => row().updated_at as string;
const auditRows = () => sqlite.prepare("SELECT entity, entity_id, action, session_id FROM audit_log").all();

interface UploadOpts {
  file?: { bytes: Uint8Array; name?: string; type?: string } | null;
  alt?: string;
  altEs?: string;
  expected?: string | null;
  origin?: string | null;
}

/** A multipart POST with a real Content-Length, the way a browser sends it. */
async function upload(opts: UploadOpts = {}): Promise<Response> {
  const form = new FormData();
  if (opts.file !== null) {
    const f = opts.file ?? { bytes: jpegBytes(300, 420) };
    form.set("flyer", new Blob([f.bytes as BlobPart], { type: f.type ?? "image/jpeg" }), f.name ?? "flyer.jpg");
  }
  if (opts.alt !== undefined) form.set("alt", opts.alt);
  if (opts.altEs !== undefined) form.set("alt_es", opts.altEs);
  const expected = opts.expected === undefined ? version() : opts.expected;
  if (expected !== null) form.set("expectedUpdatedAt", expected);
  const probe = new Request("https://pueblofoodmap.com/x", { method: "POST", body: form });
  const body = await probe.arrayBuffer();
  const headers: Record<string, string> = {
    "content-type": probe.headers.get("content-type") as string,
    "content-length": String(body.byteLength),
  };
  const origin = opts.origin === undefined ? ADMIN_ORIGIN : opts.origin;
  if (origin !== null) headers.Origin = origin;
  return uploadFlyer(new NextRequest(`https://pueblofoodmap.com/api/admin/events/${EVENT_ID}/flyer`, { method: "POST", headers, body }), ctx);
}

const remove = (expected: string | null = version(), origin: string | null = ADMIN_ORIGIN) =>
  removeFlyer(
    new NextRequest(`https://pueblofoodmap.com/api/admin/events/${EVENT_ID}/flyer`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(expected === null ? {} : { expectedUpdatedAt: expected }),
    }),
    ctx,
  );

describe("access gate", () => {
  test.each([
    ["wrong origin", () => upload({ origin: "https://evil.example.com" }), 403],
    ["missing origin", () => upload({ origin: null }), 403],
    ["delete with wrong origin", () => remove(version(), "https://evil.example.com"), 403],
  ])("%s -> 403, storage and database untouched", async (_n, call, status) => {
    const res = await call();
    expect(res.status).toBe(status);
    expect(r2Calls).toEqual([]);
    expect(row().flyer_key).toBeNull();
    expect(auditRows()).toEqual([]);
  });

  test("no admin session -> 401, storage untouched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    expect((await upload()).status).toBe(401);
    expect((await remove()).status).toBe(401);
    expect(r2Calls).toEqual([]);
  });
});

describe("upload", () => {
  test("stores a real image under a server-made key, records size from the bytes, audits, purges", async () => {
    const res = await upload({ alt: "Turkey drive flyer", altEs: "Volante" });
    const out = (await res.json()) as { ok: boolean; updated_at: string; flyer: { src: string; width: number; height: number } };

    expect(res.status).toBe(200);
    const key = row().flyer_key as string;
    expect(key.startsWith(`${EVENT_ID}/`)).toBe(true);
    expect(key.slice(EVENT_ID.length + 1)).toMatch(FLYER_FILE_RE);
    expect(objects.get(key)?.contentType).toBe("image/jpeg");
    expect(row()).toMatchObject({ flyer_width: 300, flyer_height: 420, flyer_alt: "Turkey drive flyer", flyer_alt_es: "Volante", updated_at: out.updated_at });
    expect(out.flyer).toMatchObject({ src: `/api/public/events/${EVENT_ID}/flyer/${key.slice(EVENT_ID.length + 1)}`, width: 300, height: 420 });
    expect(auditRows()).toEqual([{ entity: "event", entity_id: EVENT_ID, action: "update", session_id: "sess-1" }]);
    expect(cacheDelete).toHaveBeenCalledTimes(2);
  });

  test("a client-chosen file name or content type changes nothing about the key or stored type", async () => {
    await upload({ file: { bytes: pngBytes(100, 200), name: "../../evil.html", type: "text/html" } });
    const key = row().flyer_key as string;
    expect(key).toMatch(new RegExp(`^${EVENT_ID}/[0-9a-f-]{36}\\.png$`));
    expect(objects.get(key)?.contentType).toBe("image/png");
  });

  test.each([
    ["an SVG named .jpg", svgBytes(), "x.jpg", "image/jpeg"],
    ["an HTML file named .jpg", htmlBytes(), "x.jpg", "image/jpeg"],
    ["random bytes", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]), "x.png", "image/png"],
  ])("%s is rejected with an image content type, and nothing is stored", async (_n, bytes, name, type) => {
    const res = await upload({ file: { bytes, name, type } });
    const out = (await res.json()) as { errors: Record<string, string> };
    expect(res.status).toBe(422);
    expect(out.errors.flyer).toBeTruthy();
    expect(r2Calls).toEqual([]);
    expect(row().flyer_key).toBeNull();
    expect(auditRows()).toEqual([]);
  });

  test("a file over the size cap is refused (413) before storage", async () => {
    const big = new Uint8Array(MAX_FLYER_BYTES + 1);
    big.set(jpegBytes());
    const res = await upload({ file: { bytes: big } });
    expect(res.status).toBe(413);
    expect(r2Calls).toEqual([]);
    expect(row().flyer_key).toBeNull();
  });

  test("a stale expectedUpdatedAt -> 409, the upload is cleaned out of storage, no audit row", async () => {
    const res = await upload({ expected: "2020-01-01T00:00:00.000Z" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("conflict");
    expect(objects.size).toBe(0);
    expect(row().flyer_key).toBeNull();
    expect(auditRows()).toEqual([]);
  });

  test("replacing deletes the old object; the new file is the only one left", async () => {
    await upload({ file: { bytes: jpegBytes(100, 100) } });
    const oldKey = row().flyer_key as string;
    await upload({ file: { bytes: pngBytes(200, 300) } });
    const newKey = row().flyer_key as string;

    expect(newKey).not.toBe(oldKey);
    expect([...objects.keys()]).toEqual([newKey]);
    expect(r2Calls).toContain(`delete ${oldKey}`);
    expect(row()).toMatchObject({ flyer_width: 200, flyer_height: 300 });
  });

  test("alt-only change keeps the stored file and its key", async () => {
    await upload({ alt: "first" });
    const key = row().flyer_key;
    const res = await upload({ file: null, alt: "second", altEs: "segundo" });
    expect(res.status).toBe(200);
    expect(row()).toMatchObject({ flyer_key: key, flyer_alt: "second", flyer_alt_es: "segundo" });
    expect(objects.size).toBe(1);
  });

  test("no file and no flyer yet -> 422, an archived event -> 409", async () => {
    expect((await upload({ file: null })).status).toBe(422);
    sqlite.prepare("UPDATE events SET status = 'archived' WHERE id = ?").run(EVENT_ID);
    expect((await upload()).status).toBe(409);
    expect(r2Calls).toEqual([]);
  });

  test("migration 0019 not applied -> clean 503, the uploaded object is removed, nothing else breaks", async () => {
    setup(freshDb(["0001_init_admin_schema.sql", "0017_auth_events.sql", "0018_events.sql"]));
    const res = await upload();
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe("flyer_unavailable");
    expect(objects.size).toBe(0);
    expect(row().flyer_key).toBeNull();
  });
});

describe("remove", () => {
  test("clears the row, deletes the object, audits and purges", async () => {
    await upload({ alt: "x" });
    const key = row().flyer_key as string;
    cacheDelete.mockClear();

    const res = await remove();

    expect(res.status).toBe(200);
    expect(row()).toMatchObject({ flyer_key: null, flyer_width: null, flyer_alt: null });
    expect(objects.has(key)).toBe(false);
    expect(auditRows()).toHaveLength(2);
    expect(cacheDelete).toHaveBeenCalledTimes(2);
  });

  test("a stale version -> 409 and the object stays", async () => {
    await upload();
    const res = await remove("2020-01-01T00:00:00.000Z");
    expect(res.status).toBe(409);
    expect(objects.size).toBe(1);
    expect(row().flyer_key).toBeTruthy();
  });

  test("an event with no flyer -> 404", async () => {
    expect((await remove()).status).toBe(404);
  });
});

describe("admin preview", () => {
  test("needs a session, serves the stored image with nosniff and no-store", async () => {
    await upload({ file: { bytes: pngBytes(10, 10) } });
    const ok = await previewFlyer(new NextRequest("https://pueblofoodmap.com/x"), ctx);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("cache-control")).toBe("no-store");

    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    expect((await previewFlyer(new NextRequest("https://pueblofoodmap.com/x"), ctx)).status).toBe(401);
  });
});
