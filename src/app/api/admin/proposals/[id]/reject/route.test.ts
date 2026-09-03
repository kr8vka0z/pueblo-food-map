// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/proposals/[id]/reject. Same
 * full-stack pattern as the sibling
 * src/app/api/admin/submissions/[id]/reject/route.test.ts — see that
 * file's own header.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/cfAccess";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const PROPOSAL_ID = 42;

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/proposals/[id]/reject/route";

interface BoundCall {
  sql: string;
  args: unknown[];
}

function makeFakeDb(changes: number) {
  let lastBound: BoundCall | null = null;
  const run = vi.fn(async () => ({ success: true, results: [], meta: { changes } }));
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => {
      lastBound = { sql, args };
      return { run };
    },
  });
  return { db: { prepare } as unknown as D1Database, run, getLastBound: () => lastBound };
}

function makeRequest(opts: { origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/proposals/${PROPOSAL_ID}/reject`, {
    method: "POST",
    headers,
  });
}

function callReject(req: NextRequest, id: string = String(PROPOSAL_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/proposals/[id]/reject", () => {
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
    const { db, run } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  test("valid session but wrong/missing Origin -> 403, D1 never touched", async () => {
    const { db, run } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    expect((await callReject(makeRequest({ origin: "https://evil.example.com" }))).status).toBe(403);
    expect((await callReject(makeRequest())).status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  test("pending row -> 200; UPDATE flips status='rejected' and binds reviewed_by/reviewed_at/id, WITHOUT touching source/target_venue_id/diff_hash", async () => {
    const { db, run, getLastBound } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);

    const bound = getLastBound();
    expect(bound?.sql).toContain("UPDATE change_proposals");
    expect(bound?.sql).toContain("status = 'rejected'");
    expect(bound?.sql).toContain("WHERE id = ?");
    expect(bound?.sql).toContain("status = 'pending'");
    expect(bound?.args).toContain(ADMIN_EMAIL);
    expect(bound?.args).toContain(PROPOSAL_ID);

    // Correctness requirement 3 (rejection memory): the UPDATE's own column
    // list must never mention source/target_venue_id/diff_hash — those are
    // exactly the three columns diffEngine.ts's rejectionKey() dedup lookup
    // reads back (`WHERE status = 'rejected'` joined against them), so a
    // reject that touched them would silently break suppression on the next
    // refresh run.
    expect(bound?.sql).not.toContain("source =");
    expect(bound?.sql).not.toContain("target_venue_id =");
    expect(bound?.sql).not.toContain("diff_hash =");
  });

  test("meta.changes === 0 (already-reviewed, superseded, or unknown row) -> 404, never a silent 200", async () => {
    const { db, run } = makeFakeDb(0);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("stale");
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("a non-numeric id -> 400, D1 never touched", async () => {
    const { db, run } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }), "not-a-number");
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});
