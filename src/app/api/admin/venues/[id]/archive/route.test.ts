// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/venues/[id]/archive (#255,
 * "Remove from map").
 *
 * Same full-stack pattern as the sibling PATCH edit route's own test file
 * (src/app/api/admin/venues/[id]/route.test.ts): mocks
 * @opennextjs/cloudflare for a fake D1 binding, signs a real
 * Cloudflare-Access-shaped JWT via cfAccess.ts's own JWKS test seam, and
 * inspects db.batch()'s bound statements directly. Proves AC2: status flips
 * to 'archived', the row is retained (no DELETE statement anywhere), and one
 * audit_log row is written with action='archive'.
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
import type { AdminVenueRow } from "@/types/venue";

const TEAM_DOMAIN = "https://pfm-test.cloudflareaccess.com";
const AUD = "test-audience-tag";
const KID = "venues-archive-route-test-key";
const ADMIN_ORIGIN = "https://admin.pueblofoodmap.com";
const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const VENUE_ID = "manual-existing-1";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { POST } from "@/app/api/admin/venues/[id]/archive/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeExistingRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: VENUE_ID,
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Manual entry",
    last_verified: "2026-01-01",
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: ADMIN_EMAIL,
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: ADMIN_EMAIL,
    published_at: "2026-01-02T00:00:00.000Z",
    published_by: ADMIN_EMAIL,
    ...overrides,
  };
}

function makeFakeDb(existingRow: AdminVenueRow | null) {
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

function makeRequest(opts: { token?: string; origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.token !== undefined) headers["Cf-Access-Jwt-Assertion"] = opts.token;
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://admin.pueblofoodmap.com/api/admin/venues/${VENUE_ID}/archive`, {
    method: "POST",
    headers,
  });
}

function callArchive(req: NextRequest, id: string = VENUE_ID) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/venues/[id]/archive", () => {
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

  test("unauthenticated request -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callArchive(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid identity but wrong/missing Origin -> 403 (bad_origin), D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const wrongOrigin = await callArchive(makeRequest({ token, origin: "https://evil.example.com" }));
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await callArchive(makeRequest({ token }));
    expect(missingOrigin.status).toBe(403);

    expect(batch).not.toHaveBeenCalled();
  });

  test("no venue with that id -> 404, D1 batch never called", async () => {
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callArchive(makeRequest({ token, origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid archive -> 200, db.batch() called once with an UPDATE (status='archived') + an audit_log INSERT (action='archive')", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callArchive(makeRequest({ token, origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: string; status: string };
    expect(data.ok).toBe(true);
    expect(data.id).toBe(VENUE_ID);
    expect(data.status).toBe("archived");

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);

    const [archiveStmt, auditStmt] = stmts;
    // AC2: retain the row — an UPDATE, never a DELETE.
    expect(archiveStmt.sql).toContain("UPDATE venues SET");
    expect(archiveStmt.sql).not.toContain("DELETE");
    expect(archiveStmt.sql).toContain("status = 'archived'");
    expect(archiveStmt.args).toContain(VENUE_ID);

    expect(auditStmt.sql).toContain("INSERT INTO audit_log");
    expect(auditStmt.args[0]).toBe(ADMIN_EMAIL); // actor_email
    expect(auditStmt.args[1]).toBe("venue"); // entity
    expect(auditStmt.args[2]).toBe(VENUE_ID); // entity_id
    expect(auditStmt.args[3]).toBe("archive"); // action

    const beforeJson = JSON.parse(auditStmt.args[4] as string);
    expect(beforeJson).toEqual(existing);
    expect(beforeJson.status).toBe("published"); // it was live before archiving

    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.status).toBe("archived");
    expect(afterJson.id).toBe(VENUE_ID);
    // Every other column is retained, not wiped, by the archive action.
    expect(afterJson.name).toBe(existing.name);
    expect(afterJson.published_at).toBe(existing.published_at);
  });

  test("archiving an already-archived venue is idempotent (still 200, still writes an audit row)", async () => {
    const existing = makeExistingRow({ status: "archived" });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callArchive(makeRequest({ token, origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
  });

  test("archive with a JSON {submissionId} body -> db.batch() called once with THREE statements, the 3rd approving the submission (#259)", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const req = new NextRequest(`https://admin.pueblofoodmap.com/api/admin/venues/${VENUE_ID}/archive`, {
      method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": token, Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: 7 }),
    });

    const res = await callArchive(req);
    expect(res.status).toBe(200);

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(3);

    const [archiveStmt, auditStmt, approveStmt] = stmts;
    expect(archiveStmt.sql).toContain("UPDATE venues SET");
    expect(auditStmt.sql).toContain("INSERT INTO audit_log");

    expect(approveStmt.sql).toContain("UPDATE public_submissions");
    expect(approveStmt.sql).toContain("status = 'approved'");
    expect(approveStmt.sql).toContain("status = 'pending'");
    // A closure approval must target the very venue being archived — see
    // route.ts's APPROVE_SUBMISSION_SQL comment for why this guard exists.
    expect(approveStmt.sql).toContain("kind = 'closure'");
    expect(approveStmt.sql).toContain("target_venue_id = ?");
    expect(approveStmt.args).toContain(ADMIN_EMAIL);
    expect(approveStmt.args).toContain(7);
    expect(approveStmt.args).toContain(VENUE_ID); // bound as target_venue_id
  });

  test("archive with NO body (ArchiveVenueButton's real call shape) still works — 2 statements, no crash reading the body", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    // Identical to makeRequest(): no body, no Content-Type — proves the
    // (#259) optional-body parse can't break the pre-existing bodyless caller.
    const res = await callArchive(makeRequest({ token, origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);
  });

  test("archive with a non-JSON body doesn't crash — degrades to 2 statements", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const req = new NextRequest(`https://admin.pueblofoodmap.com/api/admin/venues/${VENUE_ID}/archive`, {
      method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": token, Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
      body: "{not valid json",
    });

    const res = await callArchive(req);
    expect(res.status).toBe(200);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);
  });

  test("submissionId is ignored when not a positive integer — still 2 statements", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const req = new NextRequest(`https://admin.pueblofoodmap.com/api/admin/venues/${VENUE_ID}/archive`, {
      method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": token, Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: "7" }),
    });

    const res = await callArchive(req);
    expect(res.status).toBe(200);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);
  });
});
