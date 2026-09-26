// @vitest-environment node
/**
 * Regression test for #568 item 2 — new file because
 * src/app/api/admin/publish/route.test.ts is an existing test file
 * (write-guarded on fix/* branches); this covers ONLY the new
 * `archivedCount` field on a removals-only publish, not the rest of the
 * route (see that file for the full NB1/auth/validation coverage this
 * duplicates just enough fixture/mock setup to stand alone from).
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
    status: "published",
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
  const batch = vi.fn(async (stmts: unknown[]) => stmts.map(() => ({ success: true, results: [], meta: {} })));
  const fakeDb = {
    prepare: () => {
      const stmt = {
        bind: (...args: unknown[]) => {
          void args;
          return stmt;
        },
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

/** Minimal GitHub API mock: every call succeeds — same shape as the sibling route.test.ts. */
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
    if (url.endsWith("/graphql")) return jsonResponse({ data: { enablePullRequestAutoMerge: { clientMutationId: null } } });
    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });
}

describe("POST /api/admin/publish — archivedCount (#568 item 2)", () => {
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

  test("a removals-only publish (0 drafts, 0 edits, 1 pending removal) reports archivedCount: 1, not just publishedCount: 0", async () => {
    const { db, batch } = makeFakeDb([
      // Still-published, untouched row — makes up the snapshot but is
      // neither a new push nor a removal.
      makeRow({ id: "still-live", status: "published", published_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
      // Previously published, archived AFTER its last publish — exactly
      // what fetchPublishSnapshot's archivedIds counts as "pending removal".
      makeRow({
        id: "removed-venue",
        status: "archived",
        published_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      }),
    ]);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    vi.stubGlobal("fetch", makeGithubFetchMock());

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; publishedCount: number; archivedCount: number };
    expect(data.ok).toBe(true);
    expect(data.publishedCount).toBe(0); // no new drafts or edits — this is the pre-fix "0 places pushed" case
    expect(data.archivedCount).toBe(1); // the removal itself, now visible
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
