// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/publish (#237 checkpoint d).
 *
 * Full-stack: mocks @opennextjs/cloudflare's getCloudflareContext (the one
 * true I/O boundary reaching Cloudflare's request context outside a real
 * Worker — same seam src/lib/adminDb.test.ts uses) to supply a fake D1
 * binding, mocks requireAdminSession() (src/lib/adminSession.ts, the sole
 * identity check post Better-Auth-sole-gate cutover —
 * auth/betterauth-sole-gate) as a controllable mock, and mocks global fetch
 * for the GitHub Contents/Pulls/GraphQL calls — no real GitHub token exists
 * in this env (per the #237 checkpoint d issue).
 *
 * This is the file that proves the NB1 ordering end to end (spec §8): on a
 * successful mocked GitHub commit, D1 gets promoted; on a failed one, D1's
 * batch() is never called at all. src/lib/publishVenues.test.ts proves the
 * pure/D1/GitHub pieces individually; this file proves route.ts wires them
 * together in the right order.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError } from "@/lib/cfAccess";
import type { VenueRow } from "@/lib/publishVenues";

const ADMIN_ORIGIN = "https://pueblofoodmap.com";
const ADMIN_EMAIL = "admin@pueblofoodmap.com";

// Vitest hoists vi.mock() above this file's own imports, so route.ts (via
// adminDb.ts) picks up the mocked @opennextjs/cloudflare with no dynamic
// import needed — same pattern as src/lib/adminDb.test.ts.
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

import { POST } from "@/app/api/admin/publish/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

function makeRow(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    id: "venue-a",
    name: "Venue A",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St",
    hours_weekly: null,
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

function makeRequest(opts: { origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest("https://pueblofoodmap.com/api/admin/publish", {
    method: "POST",
    headers,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Minimal GitHub API mock: every call succeeds unless `failStep` matches. */
function makeGithubFetchMock(failStep?: string) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const step =
      url.endsWith("/git/ref/heads/main") ? "main-ref" :
      url.endsWith("/git/ref/heads/publish-bot") ? "bot-ref" :
      url.endsWith("/git/refs") && method === "POST" ? "create-ref" :
      url.includes("/contents/") && method === "GET" ? "file-sha" :
      url.includes("/contents/") && method === "PUT" ? "commit" :
      url.endsWith("/pulls") && method === "POST" ? "create-pr" :
      url.endsWith("/graphql") ? "auto-merge" :
      "unknown";

    if (step === "unknown") throw new Error(`Unexpected fetch call: ${method} ${url}`);
    if (step === failStep) return jsonResponse({ message: "mocked failure" }, 500);

    switch (step) {
      case "main-ref":
        return jsonResponse({ object: { sha: "main-sha-1" } });
      case "bot-ref":
        return new Response("Not Found", { status: 404 });
      case "create-ref":
        return jsonResponse({}, 201);
      case "file-sha":
        return jsonResponse({ sha: "file-sha-1" });
      case "commit":
        return jsonResponse({ commit: { sha: "commit-sha-1" } });
      case "create-pr":
        return jsonResponse(
          { number: 42, node_id: "PR_new123", html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42" },
          201,
        );
      case "auto-merge":
        return jsonResponse({ data: { enablePullRequestAutoMerge: { clientMutationId: null } } });
      default:
        throw new Error(`unreachable step ${step}`);
    }
  });
}

describe("POST /api/admin/publish", () => {
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

  test("no Better Auth session -> 401, D1 never touched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    const { db, batch } = makeFakeDb([makeRow()]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    vi.stubGlobal("fetch", makeGithubFetchMock());

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid session but wrong/missing Origin -> 403 (bad_origin), D1 never touched", async () => {
    const { db, batch } = makeFakeDb([makeRow()]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    vi.stubGlobal("fetch", makeGithubFetchMock());

    const wrongOrigin = await POST(makeRequest({ origin: "https://evil.example.com" }));
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await POST(makeRequest());
    expect(missingOrigin.status).toBe(403);

    expect(batch).not.toHaveBeenCalled();
  });

  test("validation failure (malformed row) -> 422, GitHub is never called, D1 never touched", async () => {
    const { db, batch } = makeFakeDb([makeRow({ id: "bad", category: "not-a-real-category" })]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const githubMock = makeGithubFetchMock();
    vi.stubGlobal("fetch", githubMock);

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("bad");
    expect(githubMock).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  test("successful mocked GitHub commit -> D1 promotion + audit_log write happen (NB1, success side)", async () => {
    const { db, batch } = makeFakeDb([
      makeRow({ id: "draft-1", status: "draft" }),
      makeRow({ id: "draft-2", status: "draft" }),
      makeRow({ id: "already-published", status: "published" }),
    ]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    vi.stubGlobal("fetch", makeGithubFetchMock());

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      prUrl: string;
      publishedCount: number;
      snapshotCount: number;
    };
    expect(data.ok).toBe(true);
    expect(data.prUrl).toBe("https://github.com/kr8vka0z/pueblo-food-map/pull/42");
    expect(data.publishedCount).toBe(2); // only the two drafts, not the already-published row
    expect(data.snapshotCount).toBe(3);

    expect(batch).toHaveBeenCalledTimes(1);
  });

  test.each(["main-ref", "file-sha", "commit", "create-pr", "auto-merge"] as const)(
    "GitHub failure at the %s step -> 502, D1 batch() is NEVER called (NB1, failure side)",
    async (failStep) => {
      const { db, batch } = makeFakeDb([
        makeRow({ id: "draft-1", status: "draft" }),
        makeRow({ id: "draft-2", status: "draft" }),
      ]);
      mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
      vi.stubGlobal("fetch", makeGithubFetchMock(failStep));

      const res = await POST(makeRequest({ origin: ADMIN_ORIGIN }));
      expect(res.status).toBe(502);
      const data = (await res.json()) as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toBe("github_commit_failed");

      // The whole point of NB1: a failed GitHub commit leaves D1 untouched --
      // no venue silently promoted, no audit row written.
      expect(batch).not.toHaveBeenCalled();
    },
  );

  test("missing GITHUB_PUBLISH_TOKEN -> 503 publish_not_configured, GitHub and D1 never touched (#256 AC5)", async () => {
    delete process.env.GITHUB_PUBLISH_TOKEN;
    const { db, batch } = makeFakeDb([makeRow()]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const githubMock = makeGithubFetchMock();
    vi.stubGlobal("fetch", githubMock);

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("publish_not_configured");

    // The guard sits before the snapshot (route.ts), so neither the GitHub
    // commit sequence nor any D1 write is ever reached on this path.
    expect(githubMock).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });
});
