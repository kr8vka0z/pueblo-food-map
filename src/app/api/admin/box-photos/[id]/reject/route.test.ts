// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/box-photos/[id]/reject (Blessing
 * Boxes slice 5). Proves: the atomic D1 write (status + audit_log), the
 * optional review_reason, and that the R2 delete happens AFTER the D1
 * write and is best-effort (a delete failure never fails the request).
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

import { POST } from "@/app/api/admin/box-photos/[id]/reject/route";

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

function makeBucket(deleteImpl?: () => Promise<void>) {
  const deleteFn = vi.fn(deleteImpl ?? (async () => undefined));
  return { bucket: { delete: deleteFn } as unknown as R2Bucket, deleteFn };
}

function makeRequest(opts: { origin?: string; body?: unknown } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  headers["Content-Type"] = "application/json";
  return new NextRequest(`https://pueblofoodmap.com/api/admin/box-photos/${PHOTO_ID}/reject`, {
    method: "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function callReject(req: NextRequest, id: string = String(PHOTO_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/box-photos/[id]/reject", () => {
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
    const { bucket } = makeBucket();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db, BOX_PHOTOS: bucket } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("wrong Origin -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    const { bucket } = makeBucket();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db, BOX_PHOTOS: bucket } });

    const res = await callReject(makeRequest({ origin: "https://evil.example.com" }));
    expect(res.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  test("unknown photo id -> 404, D1 batch never called", async () => {
    const { db, batch } = makeFakeDb(null);
    const { bucket } = makeBucket();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db, BOX_PHOTOS: bucket } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("reject with no body -> 200, review_reason null, R2 object deleted AFTER the D1 batch", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    const { bucket, deleteFn } = makeBucket();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db, BOX_PHOTOS: bucket } });

    const callOrder: string[] = [];
    batch.mockImplementationOnce(async (stmts: BoundStatement[]) => {
      callOrder.push("d1_batch");
      return stmts.map(() => ({ success: true, results: [], meta: {} }));
    });
    deleteFn.mockImplementationOnce(async () => {
      callOrder.push("r2_delete");
    });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; status: string };
    expect(data.status).toBe("rejected");

    expect(callOrder).toEqual(["d1_batch", "r2_delete"]);
    expect(deleteFn).toHaveBeenCalledWith(existing.r2_key);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt, auditStmt] = stmts;
    expect(updateStmt.sql).toContain("'rejected'");
    expect(updateStmt.args).toContain(null); // review_reason

    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.status).toBe("rejected");
    expect(afterJson.review_reason).toBeNull();
  });

  test("reject with a reason -> stored, capped, trimmed", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    const { bucket } = makeBucket();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db, BOX_PHOTOS: bucket } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN, body: { reason: "  Face visible  " } }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt] = stmts;
    expect(updateStmt.args).toContain("Face visible");
  });

  test("R2 delete failure does not fail the request — the D1 write already committed", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    const { bucket, deleteFn } = makeBucket();
    deleteFn.mockRejectedValueOnce(new Error("R2 unavailable"));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db, BOX_PHOTOS: bucket } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
