// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/box-photos/[id]/approve (Blessing
 * Boxes slice 5). Same full-stack mock pattern as
 * box-checkins/[id]/visibility/route.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/adminOrigin";
import type { BoxPhotoRow } from "@/lib/boxPhotos";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const PHOTO_ID = 42;

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/box-photos/[id]/approve/route";

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeExistingRow(overrides: Partial<BoxPhotoRow> = {}): BoxPhotoRow {
  return {
    id: PHOTO_ID,
    venue_id: "plentiful-blessing-box-216-w-routt-plentiful-1454",
    checkin_id: null,
    r2_key: "box-photos/a/x.jpg",
    status: "pending",
    width: 800,
    height: 600,
    bytes: 12345,
    flag_count: 0,
    reviewed_by: null,
    reviewed_at: null,
    review_reason: null,
    created_at: "2026-09-17T12:00:00.000Z",
    ...overrides,
  };
}

function makeFakeDb(existingRow: BoxPhotoRow | null) {
  const batch = vi.fn(async (stmts: BoundStatement[]) =>
    stmts.map(() => ({ success: true, results: [], meta: {} })),
  );
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      sql,
      args,
      first: async <T,>(): Promise<T | null> => existingRow as unknown as T | null,
    }),
  });
  return { db: { prepare, batch } as unknown as D1Database, batch };
}

function makeRequest(opts: { origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/box-photos/${PHOTO_ID}/approve`, {
    method: "POST",
    headers,
  });
}

function callApprove(req: NextRequest, id: string = String(PHOTO_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/box-photos/[id]/approve", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("no Better Auth session -> 401, D1 never touched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("wrong/missing Origin -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: "https://evil.example.com" }));
    expect(res.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  test("non-integer id -> 404, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }), "not-a-number");
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("unknown photo id -> 404, D1 batch never called", async () => {
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("pending -> approved: 200, db.batch() writes the UPDATE + audit_log row", async () => {
    const existing = makeExistingRow({ status: "pending" });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: number; status: string };
    expect(data.ok).toBe(true);
    expect(data.status).toBe("approved");

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);

    const [updateStmt, auditStmt] = stmts;
    expect(updateStmt.sql).toContain("UPDATE box_photos SET");
    expect(updateStmt.sql).toContain("'approved'");
    expect(updateStmt.args).toContain(ADMIN_EMAIL);
    expect(updateStmt.args).toContain(PHOTO_ID);

    expect(auditStmt.sql).toContain("INSERT INTO audit_log");
    expect(auditStmt.args[1]).toBe("box_photo");
    expect(auditStmt.args[2]).toBe(String(PHOTO_ID));
    expect(auditStmt.args[3]).toBe("update");

    const beforeJson = JSON.parse(auditStmt.args[4] as string);
    expect(beforeJson.status).toBe("pending");
    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.status).toBe("approved");
    expect(afterJson.reviewed_by).toBe(ADMIN_EMAIL);
    expect(afterJson.reviewed_at).not.toBeNull();
  });

  test("flagged -> approved (making a previously-flagged photo public again), flag_count untouched", async () => {
    const existing = makeExistingRow({ status: "flagged", flag_count: 3 });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt, auditStmt] = stmts;
    // flag_count is never in the UPDATE's column list — history preserved.
    expect(updateStmt.sql).not.toContain("flag_count");
    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.flag_count).toBe(3);
  });
});
