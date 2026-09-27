// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/submissions/[id]/done (#675).
 *
 * Same full-stack pattern as the sibling reject route's own test file
 * (src/app/api/admin/submissions/[id]/reject/route.test.ts): mocks
 * @opennextjs/cloudflare for a fake D1 binding and requireAdminSession()
 * as a controllable mock. Unlike reject, this route reads the row first
 * (for the audit row's entity_id) then runs a db.batch() of two statements
 * (the status flip + the audit insert), so the fake DB exposes both
 * `.first()` and `.batch()`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/adminOrigin";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const SUBMISSION_ID = 42;
const VENUE_ID = "manual-existing-1";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/submissions/[id]/done/route";

interface BoundStatement {
  sql: string;
  args: unknown[];
}

/**
 * Fake D1: `.first()` resolves with `pendingRow` (or null — no matching
 * pending closure); `.batch()` records every bound statement and resolves
 * with `batchChanges[i]` as each statement's own `meta.changes`, mirroring
 * the archive route's own fake-db shape (that route's test file).
 */
function makeFakeDb(pendingRow: { target_venue_id: string } | null, batchChanges: number[] = [1, 1]) {
  const boundStatements: BoundStatement[] = [];
  const batch = vi.fn(async (stmts: BoundStatement[]) => {
    boundStatements.push(...stmts);
    return stmts.map((_, i) => ({ success: true, results: [], meta: { changes: batchChanges[i] ?? 1 } }));
  });
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      sql,
      args,
      first: async <T,>(): Promise<T | null> => pendingRow as unknown as T | null,
    }),
  });
  return { db: { prepare, batch } as unknown as D1Database, batch, boundStatements };
}

function makeRequest(opts: { origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/submissions/${SUBMISSION_ID}/done`, {
    method: "POST",
    headers,
  });
}

function callDone(req: NextRequest, id: string = String(SUBMISSION_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/submissions/[id]/done", () => {
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
    const { db, batch } = makeFakeDb({ target_venue_id: VENUE_ID });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callDone(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid session but wrong/missing Origin -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ target_venue_id: VENUE_ID });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const wrongOrigin = await callDone(makeRequest({ origin: "https://evil.example.com" }));
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await callDone(makeRequest());
    expect(missingOrigin.status).toBe(403);

    expect(batch).not.toHaveBeenCalled();
  });

  test("a non-numeric id -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ target_venue_id: VENUE_ID });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callDone(makeRequest({ origin: ADMIN_ORIGIN }), "not-a-number");
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  test("no matching pending closure row -> 404, D1 batch never runs", async () => {
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callDone(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(false);
    expect(batch).not.toHaveBeenCalled();
  });

  test("pending closure row -> 200 {ok:true}; batch writes the status flip and an audit_log row", async () => {
    const { db, boundStatements } = makeFakeDb({ target_venue_id: VENUE_ID });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callDone(makeRequest({ origin: ADMIN_ORIGIN }));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(boundStatements).toHaveLength(2);

    const [markDone, insertAudit] = boundStatements;
    expect(markDone.sql).toContain("UPDATE public_submissions");
    expect(markDone.sql).toContain("status = 'approved'");
    expect(markDone.sql).toContain("kind = 'closure'");
    expect(markDone.args).toContain(ADMIN_EMAIL);
    expect(markDone.args).toContain(SUBMISSION_ID);

    expect(insertAudit.sql).toContain("INSERT INTO audit_log");
    expect(insertAudit.sql).toContain("'venue'");
    expect(insertAudit.sql).toContain("'update'");
    expect(insertAudit.args).toContain(ADMIN_EMAIL);
    expect(insertAudit.args).toContain(VENUE_ID);
  });

  test("the status-flip statement affecting 0 rows (a true concurrent race) -> 404, not a false 200", async () => {
    const { db } = makeFakeDb({ target_venue_id: VENUE_ID }, [0, 0]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callDone(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
  });

  test("calling done twice in a row: the second call's pre-check no longer matches -> 404", async () => {
    // The first call's own success is proven by the "pending closure row"
    // test above; this proves the SECOND call — where the pre-check SELECT
    // no longer finds a pending row (status already flipped to 'approved')
    // — degrades to 404 rather than a silent repeat 200.
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callDone(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });
});
