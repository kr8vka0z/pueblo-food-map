// @vitest-environment node
/**
 * Route-level tests for GET /api/admin/geocode (admin/p2-add-venue, #254
 * follow-up).
 *
 * Same auth-mock pattern as src/app/api/admin/venues/route.test.ts: mocks
 * @opennextjs/cloudflare's getCloudflareContext (this route never reads
 * ADMIN_DB itself, but getAdminDb() always resolves it as part of verifying
 * identity) and signs a real Cloudflare-Access-shaped JWT via cfAccess.ts's
 * own JWKS test seam. vi.stubGlobal('fetch', ...) replaces the Census
 * Geocoder call so no real network request is made.
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
const KID = "geocode-route-test-key";
const ADMIN_EMAIL = "admin@pueblofoodmap.com";

// Vitest hoists vi.mock() above this file's own imports, so route.ts (via
// adminDb.ts) picks up the mocked @opennextjs/cloudflare with no dynamic
// import needed — same pattern as venues/route.test.ts.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

// Phase 3 dual-auth: see src/app/api/admin/venues/route.test.ts's own
// comment on this same mock — requireAdminSession is stubbed to always
// succeed since this file tests geocode's own auth/lookup behavior, not
// Better Auth's session plumbing (covered separately by
// adminSession.test.ts).
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ email: "admin@pueblofoodmap.com" }),
}));

import { GET } from "@/app/api/admin/geocode/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

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

function makeRequest(opts: { token?: string; q?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.token !== undefined) headers["Cf-Access-Jwt-Assertion"] = opts.token;
  const url = new URL("https://admin.pueblofoodmap.com/api/admin/geocode");
  if (opts.q !== undefined) url.searchParams.set("q", opts.q);
  return new NextRequest(url, { headers });
}

/** Builds a Census onelineaddress response shape (result.addressMatches[]). */
function censusResponse(matches: Array<{ x: number; y: number; matchedAddress: string }>) {
  return {
    result: {
      input: {},
      addressMatches: matches.map((m) => ({
        coordinates: { x: m.x, y: m.y },
        matchedAddress: m.matchedAddress,
        tigerLine: { side: "L", tigerLineId: "1" },
        addressComponents: {},
      })),
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("GET /api/admin/geocode", () => {
  beforeEach(() => {
    process.env.CF_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
    process.env.CF_ACCESS_AUD = AUD;
    mockGetCloudflareContext.mockReset();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: {} } });
  });

  afterEach(() => {
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;
    _setJwksGetterForTest(null);
    vi.unstubAllGlobals();
  });

  test("unauthenticated request (no Cf-Access-Jwt-Assertion header) -> 403, Census never called", async () => {
    const censusFetch = vi.fn();
    vi.stubGlobal("fetch", censusFetch);

    const res = await GET(makeRequest({ q: "123 Main St, Pueblo, CO" }));
    expect(res.status).toBe(403);
    expect(censusFetch).not.toHaveBeenCalled();
  });

  test("missing q param -> 400, Census never called", async () => {
    const token = await buildValidToken();
    const censusFetch = vi.fn();
    vi.stubGlobal("fetch", censusFetch);

    const res = await GET(makeRequest({ token }));
    expect(res.status).toBe(400);
    expect(censusFetch).not.toHaveBeenCalled();
  });

  test("blank q param -> 400, Census never called", async () => {
    const token = await buildValidToken();
    const censusFetch = vi.fn();
    vi.stubGlobal("fetch", censusFetch);

    const res = await GET(makeRequest({ token, q: "   " }));
    expect(res.status).toBe(400);
    expect(censusFetch).not.toHaveBeenCalled();
  });

  test("a single Census match -> 200 {matches: [{lat, lng, matchedAddress}]}", async () => {
    const token = await buildValidToken();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          censusResponse([{ x: -104.611234, y: 38.254321, matchedAddress: "123 MAIN ST, PUEBLO, CO, 81003" }]),
        ),
      ),
    );

    const res = await GET(makeRequest({ token, q: "123 Main St, Pueblo, CO" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { matches: Array<{ lat: number; lng: number; matchedAddress: string }> };
    expect(data.matches).toEqual([
      { lat: 38.254321, lng: -104.611234, matchedAddress: "123 MAIN ST, PUEBLO, CO, 81003" },
    ]);
  });

  test("empty Census addressMatches -> 200 {matches: []}", async () => {
    const token = await buildValidToken();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(censusResponse([]))));

    const res = await GET(makeRequest({ token, q: "a nonsense address" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { matches: unknown[] };
    expect(data.matches).toEqual([]);
  });

  test("Census request throws (network failure/timeout) -> 502", async () => {
    const token = await buildValidToken();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const res = await GET(makeRequest({ token, q: "123 Main St" }));
    expect(res.status).toBe(502);
  });

  test("Census non-2xx response -> 502", async () => {
    const token = await buildValidToken();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "error" }, 500)));

    const res = await GET(makeRequest({ token, q: "123 Main St" }));
    expect(res.status).toBe(502);
  });

  test("Census response with an invalid JSON body -> 502", async () => {
    const token = await buildValidToken();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));

    const res = await GET(makeRequest({ token, q: "123 Main St" }));
    expect(res.status).toBe(502);
  });

  test("caps results at 5 matches even when Census returns more", async () => {
    const token = await buildValidToken();
    const many = Array.from({ length: 8 }, (_, i) => ({
      x: -104.6 - i,
      y: 38.2 + i,
      matchedAddress: `Address ${i}`,
    }));
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(censusResponse(many))));

    const res = await GET(makeRequest({ token, q: "test" }));
    const data = (await res.json()) as { matches: unknown[] };
    expect(data.matches).toHaveLength(5);
  });
});
