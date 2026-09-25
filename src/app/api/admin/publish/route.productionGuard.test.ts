// @vitest-environment node
/**
 * Route-level tests for the #591 production-only Publish guard.
 *
 * A separate file from route.test.ts (not an addition to it) because the
 * write-guard for fix/* branches blocks edits to existing test files, and
 * because this guard's acceptance criterion — "staging refuses, no GitHub
 * call made; production proceeds as before" — is a distinct, narrow
 * assertion from that file's broader NB1/ordering coverage. Mocking setup
 * mirrors route.test.ts exactly (same seam: @opennextjs/cloudflare's
 * getCloudflareContext, the one I/O boundary reaching Cloudflare's env
 * outside a real Worker).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import type { VenueRow } from "@/lib/publishVenues";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/publish/route";

function makeRow(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    id: "venue-a",
    name: "Venue A",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "test",
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

function makeFakeDb(seedRows: VenueRow[]) {
  const batch = vi.fn(async (stmts: unknown[]) =>
    stmts.map(() => ({ success: true, results: [], meta: {} })),
  );
  const fakeDb = {
    prepare: () => {
      const stmt = {
        bind: () => stmt,
        all: async () => ({ success: true, results: seedRows, meta: {} }),
      };
      return stmt;
    },
    batch,
  };
  return { db: fakeDb as unknown as D1Database, batch };
}

function makeRequest(): NextRequest {
  return new NextRequest("https://pueblofoodmap.com/api/admin/publish", {
    method: "POST",
    headers: { Origin: ADMIN_ORIGIN },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Same minimal GitHub API mock route.test.ts uses — every call succeeds. */
function makeGithubFetchMock() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/git/ref/heads/main")) return jsonResponse({ object: { sha: "main-sha-1" } });
    if (url.endsWith("/git/ref/heads/publish-bot")) return new Response("Not Found", { status: 404 });
    if (url.endsWith("/git/refs") && method === "POST") return jsonResponse({}, 201);
    if (url.includes("/contents/") && method === "GET") return jsonResponse({ sha: "file-sha-1" });
    if (url.includes("/contents/") && method === "PUT") return jsonResponse({ commit: { sha: "commit-sha-1" } });
    if (url.endsWith("/pulls") && method === "POST") {
      return jsonResponse(
        { number: 42, node_id: "PR_new123", html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42" },
        201,
      );
    }
    if (url.endsWith("/graphql")) {
      return jsonResponse({ data: { enablePullRequestAutoMerge: { clientMutationId: null } } });
    }
    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });
}

describe("POST /api/admin/publish — #591 production-only guard", () => {
  beforeEach(() => {
    process.env.GITHUB_PUBLISH_TOKEN = "test-github-token";
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    delete process.env.GITHUB_PUBLISH_TOKEN;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("staging environment (BETTER_AUTH_RP_ID set) -> 403 publish_not_production, no GitHub call, D1 never touched", async () => {
    const { db, batch } = makeFakeDb([makeRow()]);
    mockGetCloudflareContext.mockResolvedValue({
      env: { ADMIN_DB: db, BETTER_AUTH_RP_ID: "dev.pueblofoodmap.com" },
    });
    const githubMock = makeGithubFetchMock();
    vi.stubGlobal("fetch", githubMock);

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("publish_not_production");

    expect(githubMock).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  test("production environment (no BETTER_AUTH_RP_ID) -> proceeds as before, GitHub committed, D1 promoted", async () => {
    const { db, batch } = makeFakeDb([makeRow({ id: "draft-1", status: "draft" })]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const githubMock = makeGithubFetchMock();
    vi.stubGlobal("fetch", githubMock);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; prUrl: string };
    expect(data.ok).toBe(true);
    expect(data.prUrl).toBe("https://github.com/kr8vka0z/pueblo-food-map/pull/42");

    expect(githubMock).toHaveBeenCalled();
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
