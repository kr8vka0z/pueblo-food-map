// @vitest-environment node
/**
 * Route-level tests for GET /api/admin/box-photos/[id]/preview (Blessing
 * Boxes slice 5). Same full-stack mock pattern as
 * box-checkins/[id]/visibility/route.test.ts: mocks
 * @opennextjs/cloudflare and requireAdminSession() directly.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError } from "@/lib/cfAccess";

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

import { GET } from "@/app/api/admin/box-photos/[id]/preview/route";

function makeDb(row: { r2_key: string; status: string } | null) {
  return { prepare: () => ({ bind: () => ({ first: async () => row }) }) } as unknown as D1Database;
}

function makeBucket(bytes: Uint8Array | null) {
  const get = vi.fn().mockResolvedValue(bytes ? { arrayBuffer: async () => bytes.buffer } : null);
  return { get, bucket: { get } as unknown as R2Bucket };
}

function callGet(id: string = String(PHOTO_ID)) {
  return GET(new NextRequest(`https://pueblofoodmap.com/api/admin/box-photos/${id}/preview`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/admin/box-photos/[id]/preview", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("no Better Auth session -> 401", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: makeDb(null), BOX_PHOTOS: {} } });
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  test("non-integer id -> 404", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: makeDb(null), BOX_PHOTOS: {} } });
    const res = await callGet("not-a-number");
    expect(res.status).toBe(404);
  });

  test("unknown photo id -> 404", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: makeDb(null), BOX_PHOTOS: {} } });
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  test("R2 object missing -> 404, not a crash", async () => {
    const { bucket } = makeBucket(null);
    mockGetCloudflareContext.mockResolvedValue({
      env: { ADMIN_DB: makeDb({ r2_key: "box-photos/a/x.jpg", status: "pending" }), BOX_PHOTOS: bucket },
    });
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  test("serves a PENDING photo — the whole point of this route vs. the public one", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { bucket, get } = makeBucket(bytes);
    mockGetCloudflareContext.mockResolvedValue({
      env: { ADMIN_DB: makeDb({ r2_key: "box-photos/a/x.jpg", status: "pending" }), BOX_PHOTOS: bucket },
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(get).toHaveBeenCalledWith("box-photos/a/x.jpg");
  });

  test("serves a FLAGGED photo too", async () => {
    const bytes = new Uint8Array([9]);
    const { bucket } = makeBucket(bytes);
    mockGetCloudflareContext.mockResolvedValue({
      env: { ADMIN_DB: makeDb({ r2_key: "box-photos/a/y.jpg", status: "flagged" }), BOX_PHOTOS: bucket },
    });
    const res = await callGet();
    expect(res.status).toBe(200);
  });
});
