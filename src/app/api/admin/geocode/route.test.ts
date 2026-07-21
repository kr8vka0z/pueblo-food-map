// @vitest-environment node
/**
 * Route-level tests for GET /api/admin/geocode (admin/p2-add-venue, #254
 * follow-up).
 *
 * Same auth-mock pattern as src/app/api/admin/venues/route.test.ts: mocks
 * @opennextjs/cloudflare's getCloudflareContext (this route never reads
 * ADMIN_DB itself, but getAdminDb() always resolves it as part of verifying
 * identity) and requireAdminSession() (src/lib/adminSession.ts, the sole
 * identity check post Better-Auth-sole-gate cutover —
 * auth/betterauth-sole-gate) as a controllable mock.
 * vi.stubGlobal('fetch', ...) replaces the Census Geocoder call so no real
 * network request is made.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError } from "@/lib/cfAccess";

// Vitest hoists vi.mock() above this file's own imports, so route.ts (via
// adminDb.ts) picks up the mocked @opennextjs/cloudflare with no dynamic
// import needed — same pattern as venues/route.test.ts.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

// Sole identity gate: a controllable mock, not a fixed resolved value, so
// the "no session" test below can flip it to reject for one call — same
// pattern as venues/route.test.ts.
const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { GET } from "@/app/api/admin/geocode/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

function makeRequest(opts: { q?: string } = {}): NextRequest {
  const url = new URL("https://pueblofoodmap.com/api/admin/geocode");
  if (opts.q !== undefined) url.searchParams.set("q", opts.q);
  return new NextRequest(url);
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
    mockGetCloudflareContext.mockReset();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: {} } });
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: "admin@pueblofoodmap.com" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("no Better Auth session -> 401, Census never called", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    const censusFetch = vi.fn();
    vi.stubGlobal("fetch", censusFetch);

    const res = await GET(makeRequest({ q: "123 Main St, Pueblo, CO" }));
    expect(res.status).toBe(401);
    expect(censusFetch).not.toHaveBeenCalled();
  });

  test("missing q param -> 400, Census never called", async () => {
    const censusFetch = vi.fn();
    vi.stubGlobal("fetch", censusFetch);

    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    expect(censusFetch).not.toHaveBeenCalled();
  });

  test("blank q param -> 400, Census never called", async () => {
    const censusFetch = vi.fn();
    vi.stubGlobal("fetch", censusFetch);

    const res = await GET(makeRequest({ q: "   " }));
    expect(res.status).toBe(400);
    expect(censusFetch).not.toHaveBeenCalled();
  });

  test("a single Census match -> 200 {matches: [{lat, lng, matchedAddress}]}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          censusResponse([{ x: -104.611234, y: 38.254321, matchedAddress: "123 MAIN ST, PUEBLO, CO, 81003" }]),
        ),
      ),
    );

    const res = await GET(makeRequest({ q: "123 Main St, Pueblo, CO" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { matches: Array<{ lat: number; lng: number; matchedAddress: string }> };
    expect(data.matches).toEqual([
      { lat: 38.254321, lng: -104.611234, matchedAddress: "123 MAIN ST, PUEBLO, CO, 81003" },
    ]);
  });

  test("empty Census addressMatches -> 200 {matches: []}", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(censusResponse([]))));

    const res = await GET(makeRequest({ q: "a nonsense address" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { matches: unknown[] };
    expect(data.matches).toEqual([]);
  });

  test("Census request throws (network failure/timeout) -> 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const res = await GET(makeRequest({ q: "123 Main St" }));
    expect(res.status).toBe(502);
  });

  test("Census non-2xx response -> 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "error" }, 500)));

    const res = await GET(makeRequest({ q: "123 Main St" }));
    expect(res.status).toBe(502);
  });

  test("Census response with an invalid JSON body -> 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));

    const res = await GET(makeRequest({ q: "123 Main St" }));
    expect(res.status).toBe(502);
  });

  test("caps results at 5 matches even when Census returns more", async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      x: -104.6 - i,
      y: 38.2 + i,
      matchedAddress: `Address ${i}`,
    }));
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(censusResponse(many))));

    const res = await GET(makeRequest({ q: "test" }));
    const data = (await res.json()) as { matches: unknown[] };
    expect(data.matches).toHaveLength(5);
  });
});
