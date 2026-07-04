// @vitest-environment node
/**
 * Route-level tests for PATCH /api/admin/venues/[id] (#255).
 *
 * Same full-stack pattern as src/app/api/admin/venues/route.test.ts (the
 * #254 create route this one mirrors): mocks @opennextjs/cloudflare for a
 * fake D1 binding, signs a real Cloudflare-Access-shaped JWT via
 * cfAccess.ts's own JWKS test seam, and inspects db.batch()'s bound
 * statements directly instead of executing real SQL. Field-level validation
 * rules are proved once in adminVenueValidation.test.ts (reused verbatim
 * here, see route.ts's header) — this file proves auth -> validate -> fetch
 * existing -> atomic batch, plus the two edit-specific invariants #255
 * calls out: `status` is never touched by an edit (AC3), and before/after_json
 * on the audit row are the real pre/post rows (AC1).
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
const KID = "venues-id-route-test-key";
const ADMIN_ORIGIN = "https://admin.pueblofoodmap.com";
const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const VENUE_ID = "manual-existing-1";

// Vitest hoists vi.mock() above this file's own imports, so route.ts (via
// adminDb.ts) picks up the mocked @opennextjs/cloudflare with no dynamic
// import needed — same pattern as venues/route.test.ts.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { PATCH } from "@/app/api/admin/venues/[id]/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeExistingRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: VENUE_ID,
    name: "Old Name",
    category: "pantry",
    lat: 38.1,
    lng: -104.5,
    address: "Old Address",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Old source",
    last_verified: "2026-01-01",
    status: "draft",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: ADMIN_EMAIL,
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: ADMIN_EMAIL,
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

/** Fake D1: batch() is a spy; prepare().bind() returns an inspectable {sql, args} record that also answers .first() for the pre-edit SELECT. */
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

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    source: "Manual entry",
    last_verified: "2026-07-03",
    ...overrides,
  };
}

function makeRequest(
  opts: { token?: string; origin?: string; body?: unknown } = {},
): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token !== undefined) headers["Cf-Access-Jwt-Assertion"] = opts.token;
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://admin.pueblofoodmap.com/api/admin/venues/${VENUE_ID}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(opts.body ?? validPayload()),
  });
}

function callPatch(req: NextRequest, id: string = VENUE_ID) {
  return PATCH(req, { params: Promise.resolve({ id }) });
}

describe("PATCH /api/admin/venues/[id]", () => {
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
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid identity but wrong/missing Origin -> 403 (bad_origin), D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const wrongOrigin = await callPatch(makeRequest({ token, origin: "https://evil.example.com" }));
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await callPatch(makeRequest({ token }));
    expect(missingOrigin.status).toBe(403);

    expect(batch).not.toHaveBeenCalled();
  });

  test("invalid payload (bad category, missing name, non-numeric lat) -> 422 with per-field errors, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callPatch(
      makeRequest({
        token,
        origin: ADMIN_ORIGIN,
        body: validPayload({ name: "", category: "not-a-real-category", lat: "abc" }),
      }),
    );

    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; errors: Record<string, string> };
    expect(data.ok).toBe(false);
    expect(data.errors.name).toBeTruthy();
    expect(data.errors.category).toBeTruthy();
    expect(data.errors.lat).toBeTruthy();
    expect(batch).not.toHaveBeenCalled();
  });

  test("malformed JSON body -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const req = new NextRequest(`https://admin.pueblofoodmap.com/api/admin/venues/${VENUE_ID}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": token,
        Origin: ADMIN_ORIGIN,
      },
      body: "{not valid json",
    });

    const res = await callPatch(req);
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid payload but no venue with that id -> 404, D1 batch never called", async () => {
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callPatch(makeRequest({ token, origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid edit -> 200, db.batch() called once with an UPDATE + an audit_log INSERT (action='update')", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callPatch(makeRequest({ token, origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: string };
    expect(data.ok).toBe(true);
    expect(data.id).toBe(VENUE_ID);

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);

    const [updateStmt, auditStmt] = stmts;
    expect(updateStmt.sql).toContain("UPDATE venues SET");
    expect(updateStmt.sql).toContain("updated_at = ?");
    expect(updateStmt.sql).toContain("WHERE id = ?");
    // AC3 (structural): the edit UPDATE statement must never reference status.
    expect(updateStmt.sql).not.toContain("status");
    expect(updateStmt.args).toContain(VENUE_ID);
    expect(updateStmt.args).toContain("Eastside Pantry");
    expect(updateStmt.args).toContain(ADMIN_EMAIL); // updated_by

    expect(auditStmt.sql).toContain("INSERT INTO audit_log");
    expect(auditStmt.args[0]).toBe(ADMIN_EMAIL); // actor_email
    expect(auditStmt.args[1]).toBe("venue"); // entity
    expect(auditStmt.args[2]).toBe(VENUE_ID); // entity_id
    expect(auditStmt.args[3]).toBe("update"); // action

    const beforeJson = JSON.parse(auditStmt.args[4] as string);
    expect(beforeJson).toEqual(existing); // AC1: before_json is the row exactly as it was

    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.name).toBe("Eastside Pantry");
    expect(afterJson.category).toBe("pantry");
    expect(afterJson.lat).toBe(38.25);
    expect(afterJson.lng).toBe(-104.6);
    expect(afterJson.updated_by).toBe(ADMIN_EMAIL);
    expect(typeof afterJson.updated_at).toBe("string");
    expect(afterJson.updated_at).not.toBe(existing.updated_at); // updated_at must actually change
    // AC3: status is carried over from the pre-edit row, never flipped by an edit.
    expect(afterJson.status).toBe(existing.status);
  });

  test("editing a currently-published venue leaves status='published' (AC3)", async () => {
    const existing = makeExistingRow({ status: "published", published_at: "2026-06-01T00:00:00.000Z", published_by: ADMIN_EMAIL });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callPatch(makeRequest({ token, origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [, auditStmt] = stmts;
    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.status).toBe("published");
    expect(afterJson.published_at).toBe("2026-06-01T00:00:00.000Z");
    expect(afterJson.published_by).toBe(ADMIN_EMAIL);
  });

  test("optional fields (hours_weekly, tri-state, contact info) are bound correctly when provided", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const token = await buildValidToken();

    const res = await callPatch(
      makeRequest({
        token,
        origin: ADMIN_ORIGIN,
        body: validPayload({
          hours_weekly: { mon: ["09:00-17:00"] },
          accepts_snap: 1,
          accepts_wic: 0,
          phone: "719-555-0100",
          outside_county: true,
        }),
      }),
    );
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt] = stmts;
    expect(updateStmt.args).toContain(JSON.stringify({ mon: ["09:00-17:00"] }));
    expect(updateStmt.args).toContain(1); // accepts_snap
    expect(updateStmt.args).toContain(0); // accepts_wic
    expect(updateStmt.args).toContain("719-555-0100");
  });
});
