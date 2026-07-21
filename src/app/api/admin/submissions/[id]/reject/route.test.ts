// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/submissions/[id]/reject (#259).
 *
 * Same full-stack pattern as the sibling venues/archive route's own test
 * file (src/app/api/admin/venues/[id]/archive/route.test.ts): mocks
 * @opennextjs/cloudflare for a fake D1 binding, signs a real
 * Cloudflare-Access-shaped JWT via cfAccess.ts's own JWKS test seam. Unlike
 * the venue mutation routes, this one has no db.batch() to inspect — it's a
 * single UPDATE .run() call, and D1's own `meta.changes` is what
 * distinguishes "rejected a pending row" from "nothing to reject" (already
 * reviewed, or a wrong/unknown id), so the fake DB's `run()` is
 * parameterized by that count rather than always succeeding.
 *
 * WHY `node` environment: same jose/jsdom Uint8Array cross-realm issue
 * documented in cfAccess.test.ts's header.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  createLocalJWKSet,
  type JWTVerifyGetKey,
} from "jose";
import { _setJwksGetterForTest } from "@/lib/cfAccess";

const TEAM_DOMAIN = "https://pfm-test.cloudflareaccess.com";
const AUD = "test-audience-tag";
const KID = "submissions-reject-route-test-key";
const ADMIN_ORIGIN = "https://admin.pueblofoodmap.com";
const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const SUBMISSION_ID = 42;

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

// Phase 3 dual-auth: see venues/route.test.ts's own comment on this same
// mock — requireAdminSession is stubbed to always succeed since this file
// tests reject's own auth/CSRF/D1 behavior, not Better Auth's session
// plumbing (covered separately by adminSession.test.ts).
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ email: "admin@pueblofoodmap.com" }),
}));

import { POST } from "@/app/api/admin/submissions/[id]/reject/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

interface BoundCall {
  sql: string;
  args: unknown[];
}

/** Fake D1: prepare().bind() captures the last bound call; run() resolves with a fixed `changes` count. */
function makeFakeDb(changes: number) {
  let lastBound: BoundCall | null = null;
  const run = vi.fn(async () => ({ success: true, results: [], meta: { changes } }));
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => {
      lastBound = { sql, args };
      return { run };
    },
  });
  return {
    db: { prepare } as unknown as D1Database,
    run,
    getLastBound: () => lastBound,
  };
}

async function buildValidToken(): Promise<string> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = KID;
  jwk.alg = "RS256";
  jwk.use = "sig";
  _setJwksGetterForTest(() => createLocalJWKSet({ keys: [jwk] }) as JWTVerifyGetKey);

  return new SignJWT({ email: ADMIN_EMAIL })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuedAt()
    .setIssuer(TEAM_DOMAIN)
    .setAudience(AUD)
    .setExpirationTime("5m")
    .sign(privateKey);
}

function makeRequest(
  opts: { token?: string; origin?: string; body?: unknown; noBody?: boolean } = {},
): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token !== undefined) headers["Cf-Access-Jwt-Assertion"] = opts.token;
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://admin.pueblofoodmap.com/api/admin/submissions/${SUBMISSION_ID}/reject`, {
    method: "POST",
    headers,
    body: opts.noBody ? undefined : JSON.stringify(opts.body ?? { reason: "Duplicate of an existing venue." }),
  });
}

function callReject(req: NextRequest, id: string = String(SUBMISSION_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/submissions/[id]/reject", () => {
  beforeEach(() => {
    process.env.CF_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
    process.env.CF_ACCESS_AUD = AUD;
    mockGetCloudflareContext.mockReset();
  });

  afterEach(() => {
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;
    _setJwksGetterForTest(null);
  });

  test("unauthenticated request (no Cf-Access-Jwt-Assertion header) -> 403, D1 never touched", async () => {
    const { db, run } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  test("valid identity but wrong/missing Origin -> 403 (bad_origin), D1 never touched", async () => {
    const { db, run } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const wrongOrigin = await callReject(makeRequest({ token, origin: "https://evil.example.com" }));
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await callReject(makeRequest({ token }));
    expect(missingOrigin.status).toBe(403);

    expect(run).not.toHaveBeenCalled();
  });

  test("pending row -> 200 {ok:true}; UPDATE binds status='rejected', the reason, identity.email, and the id", async () => {
    const { db, run, getLastBound } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callReject(
      makeRequest({ token, origin: ADMIN_ORIGIN, body: { reason: "Duplicate of an existing venue." } }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);

    const bound = getLastBound();
    expect(bound?.sql).toContain("UPDATE public_submissions");
    expect(bound?.sql).toContain("status = 'rejected'");
    expect(bound?.sql).toContain("WHERE id = ?");
    expect(bound?.sql).toContain("status = 'pending'");
    expect(bound?.args).toContain("Duplicate of an existing venue.");
    expect(bound?.args).toContain(ADMIN_EMAIL);
    expect(bound?.args).toContain(SUBMISSION_ID);
  });

  test("reason is optional — omitted body still rejects, binding null for review_reason", async () => {
    const { db, run, getLastBound } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callReject(makeRequest({ token, origin: ADMIN_ORIGIN, body: {} }));

    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
    expect(getLastBound()?.args).toContain(null);
  });

  test("a blank/whitespace-only reason is stored as null, not an empty string", async () => {
    const { db, run, getLastBound } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callReject(makeRequest({ token, origin: ADMIN_ORIGIN, body: { reason: "   " } }));

    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
    expect(getLastBound()?.args).toContain(null);
  });

  test("a malformed JSON body doesn't crash — treated as no reason, still rejects", async () => {
    const { db, run } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const req = new NextRequest(`https://admin.pueblofoodmap.com/api/admin/submissions/${SUBMISSION_ID}/reject`, {
      method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": token, Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
      body: "{not valid json",
    });

    const res = await callReject(req);
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("a very long reason is truncated rather than stored unbounded", async () => {
    const { db, getLastBound } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();
    const longReason = "x".repeat(5000);

    const res = await callReject(makeRequest({ token, origin: ADMIN_ORIGIN, body: { reason: longReason } }));

    expect(res.status).toBe(200);
    const bound = getLastBound();
    const storedReason = bound?.args.find((a) => typeof a === "string" && a.startsWith("x"));
    expect(typeof storedReason).toBe("string");
    expect((storedReason as string).length).toBeLessThan(5000);
  });

  test("meta.changes === 0 (already-reviewed or unknown row) -> 404 {ok:false}", async () => {
    const { db, run } = makeFakeDb(0);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callReject(makeRequest({ token, origin: ADMIN_ORIGIN }));

    expect(res.status).toBe(404);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBeTruthy();
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("a non-numeric id -> 400, D1 never touched", async () => {
    const { db, run } = makeFakeDb(1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callReject(makeRequest({ token, origin: ADMIN_ORIGIN }), "not-a-number");
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});
