// @vitest-environment node
/**
 * Tests for src/lib/publishVenues.ts (#237 checkpoint d).
 *
 * Covers: row validation/strip (fixture rows, including the tri-state
 * SNAP/WIC mapping and hours_weekly JSON parse), the serializer (including
 * a round-trip against the real 108-venue Part-1 baseline), the D1
 * snapshot/promote queries (fake D1 — captures statements rather than
 * executing real SQL, since proving MY code's call sequence is the goal,
 * not re-implementing SQLite), and the GitHub commit/PR/auto-merge
 * orchestration (mocked global fetch — no real GitHub token exists in this
 * env, per the #237 checkpoint d issue).
 *
 * NB1 ordering itself (D1 untouched when the GitHub call fails) is proved
 * at the ROUTE level, not here — see
 * src/app/api/admin/publish/route.test.ts. This file proves
 * commitPublishedVenues() itself rejects on a GitHub failure, which is the
 * piece route.ts's ordering depends on.
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import type { Venue } from "@/types/venue";
import { pfpVenues } from "@/data/pfp-venues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";
import { publishedVenues } from "@/data/published-venues";
import {
  validateAndMapRow,
  validateSnapshot,
  venuesToLiteralArray,
  serializePublishedVenuesFile,
  fetchPublishSnapshot,
  promotePublishedDrafts,
  commitPublishedVenues,
  GitHubApiError,
  type VenueRow,
} from "@/lib/publishVenues";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    id: "test-id",
    name: "Test Venue",
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
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "admin@pueblofoodmap.com",
    ...overrides,
  };
}

/** Inverse of validateAndMapRow, for building fixture rows FROM real Venue data. */
function venueToRow(venue: Venue, overrides: Partial<VenueRow> = {}): VenueRow {
  return makeRow({
    id: venue.id,
    name: venue.name,
    category: venue.category,
    lat: venue.lat,
    lng: venue.lng,
    address: venue.address,
    hours_weekly: venue.hours_weekly ? JSON.stringify(venue.hours_weekly) : null,
    accepts_snap: venue.accepts_snap === undefined ? null : venue.accepts_snap ? 1 : 0,
    accepts_wic: venue.accepts_wic === undefined ? null : venue.accepts_wic ? 1 : 0,
    phone: venue.phone ?? null,
    email: venue.email ?? null,
    url: venue.url ?? null,
    notes: venue.notes ?? null,
    operator: venue.operator ?? null,
    source: venue.source,
    last_verified: venue.last_verified,
    ...overrides,
  });
}

// ─── validateAndMapRow ──────────────────────────────────────────────────────

describe("validateAndMapRow", () => {
  test("valid full row maps to a Venue with every optional field present", () => {
    const row = makeRow({
      hours_weekly: JSON.stringify({ wed: ["16:00-19:00"] }),
      accepts_snap: 1,
      accepts_wic: 0,
      phone: "(719) 555-0100",
      email: "hi@example.com",
      url: "https://example.com",
      notes: "some notes",
      operator: "Some Org",
    });
    const result = validateAndMapRow(row);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.venue).toEqual({
      id: "test-id",
      name: "Test Venue",
      category: "pantry",
      lat: 38.25,
      lng: -104.6,
      address: "123 Test St",
      hours_weekly: { wed: ["16:00-19:00"] },
      accepts_snap: true,
      accepts_wic: false,
      phone: "(719) 555-0100",
      email: "hi@example.com",
      url: "https://example.com",
      notes: "some notes",
      operator: "Some Org",
      source: "test",
      last_verified: "2026-01-01",
    });
  });

  test("valid minimal row (all-NULL optionals) omits every optional key", () => {
    const result = validateAndMapRow(makeRow());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.venue).toEqual({
      id: "test-id",
      name: "Test Venue",
      category: "pantry",
      lat: 38.25,
      lng: -104.6,
      address: "123 Test St",
      source: "test",
      last_verified: "2026-01-01",
    });
    expect(result.venue).not.toHaveProperty("hours_weekly");
    expect(result.venue).not.toHaveProperty("accepts_snap");
    expect(result.venue).not.toHaveProperty("accepts_wic");
  });

  test.each([
    [0, false],
    [1, true],
  ] as const)("accepts_snap tri-state: %i -> %s", (raw, expected) => {
    const result = validateAndMapRow(makeRow({ accepts_snap: raw }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.venue.accepts_snap).toBe(expected);
  });

  test("accepts_snap NULL -> key omitted (undefined), not false", () => {
    const result = validateAndMapRow(makeRow({ accepts_snap: null }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.venue.accepts_snap).toBeUndefined();
  });

  test("hours_weekly valid JSON parses onto the venue", () => {
    const result = validateAndMapRow(
      makeRow({ hours_weekly: JSON.stringify({ mon: ["09:00-17:00"] }) }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.venue.hours_weekly).toEqual({ mon: ["09:00-17:00"] });
  });

  test("hours_weekly malformed JSON -> validation error naming the row id", () => {
    const result = validateAndMapRow(makeRow({ id: "bad-hours", hours_weekly: "{not json" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.id).toBe("bad-hours");
      expect(result.error.reason).toMatch(/hours_weekly/i);
    }
  });

  test("invalid category is rejected", () => {
    const result = validateAndMapRow(makeRow({ id: "bad-cat", category: "not-a-category" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe("bad-cat");
  });

  test.each(["lat", "lng"] as const)("NaN %s is rejected", (field) => {
    const result = validateAndMapRow(makeRow({ id: `bad-${field}`, [field]: NaN }));
    expect(result.ok).toBe(false);
  });

  test.each(["name", "address", "source", "last_verified"] as const)(
    "missing/empty %s is rejected",
    (field) => {
      const result = validateAndMapRow(makeRow({ id: `bad-${field}`, [field]: "" }));
      expect(result.ok).toBe(false);
    },
  );

  test.each([2, -1, 99])("accepts_snap outside {NULL,0,1} (%i) is rejected", (bad) => {
    const result = validateAndMapRow(makeRow({ id: "bad-snap", accepts_snap: bad }));
    expect(result.ok).toBe(false);
  });
});

// ─── validateSnapshot ───────────────────────────────────────────────────────

describe("validateSnapshot", () => {
  test("all-valid rows -> ok:true with every venue mapped, in order", () => {
    const rows = [makeRow({ id: "a" }), makeRow({ id: "b" }), makeRow({ id: "c" })];
    const result = validateSnapshot(rows);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.venues.map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  test("one invalid row anywhere in the batch aborts the whole publish", () => {
    const rows = [
      makeRow({ id: "a" }),
      makeRow({ id: "bad", category: "nonsense" }),
      makeRow({ id: "c" }),
    ];
    const result = validateSnapshot(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("bad");
  });

  test("empty snapshot is REFUSED (safety floor — never blank the live map)", () => {
    const result = validateSnapshot([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("empty");
  });
});

// ─── Serializer + round-trip against the real Part-1 baseline ─────────────

describe("venuesToLiteralArray / serializePublishedVenuesFile", () => {
  test("output round-trips through JSON.parse back to the input", () => {
    const venues: Venue[] = [
      { id: "x", name: "X", category: "farm", lat: 1, lng: 2, address: "addr", source: "s", last_verified: "2026-01-01" },
    ];
    expect(JSON.parse(venuesToLiteralArray(venues))).toEqual(venues);
  });

  test("full file text is valid-shaped TS source (import + export line present)", () => {
    const text = serializePublishedVenuesFile([], { publishedAt: "2026-07-01T00:00:00.000Z" });
    expect(text).toContain('import type { Venue } from "@/types/venue";');
    expect(text).toContain("export const publishedVenues: Venue[] = [];");
    expect(text).toContain("Last published: 2026-07-01T00:00:00.000Z");
  });

  test("does NOT embed a publishing admin's email anywhere in the file text", () => {
    const text = serializePublishedVenuesFile(
      [{ id: "x", name: "X", category: "farm", lat: 1, lng: 2, address: "a", source: "s", last_verified: "2026-01-01" }],
      { publishedAt: "2026-07-01T00:00:00.000Z" },
    );
    expect(text).not.toContain("@pueblofoodmap.com");
  });

  test("injection-proof: hostile venue strings survive as inert string data (regression guard for #133 user content)", () => {
    // A future user-suggested venue (#133) could carry any of these in a name,
    // address, or notes field. The serializer emits a .ts file that gets
    // committed and BUILT, so a value that broke out of its string literal
    // could break the build or inject code. JSON.stringify is what makes that
    // impossible — every char is escaped, so parsing the output back yields
    // EXACTLY the input. This test pins that property: if anyone later rewrites
    // the serializer with template-literal interpolation, this deep-equal fails.
    const hostile: Venue[] = [
      {
        id: "hostile-1",
        name: "a`+process.env.SECRET+`b", // template-literal breakout attempt
        category: "pantry",
        lat: 38.25,
        lng: -104.6,
        address: "*/ dropTable() /*", // block-comment / statement injection
        notes: "l1\nl2  \\end </script>", // newlines, JS line seps, backslash, script-close
        operator: "${danger}", // template placeholder
        source: "s",
        last_verified: "2026-01-01",
      },
    ];
    // The array-literal the file embeds parses straight back to the input —
    // every hostile char survived as escaped string data, not TS syntax.
    const literal = venuesToLiteralArray(hostile);
    expect(JSON.parse(literal)).toEqual(hostile);
    // And the FULL committed file embeds exactly that inert JSON literal, so a
    // backtick / ${ / */ in the data can't open a template or comment in the
    // generated TS.
    const fileText = serializePublishedVenuesFile(hostile, { publishedAt: "2026-07-01T00:00:00.000Z" });
    expect(fileText).toContain(literal);
  });

  test("round-trip: serializing the 108 real seeded venues deep-equals the Part-1 published-venues.ts baseline", () => {
    const allVenues = [...pfpVenues, ...groceryOsmVenues, ...plentifulPantries];
    expect(allVenues).toHaveLength(108);

    const rows = allVenues.map((v) => venueToRow(v));
    const validation = validateSnapshot(rows);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const parsedBack = JSON.parse(venuesToLiteralArray(validation.venues));
    expect(parsedBack).toEqual(JSON.parse(JSON.stringify(publishedVenues)));
  });
});

// ─── D1: fetchPublishSnapshot / promotePublishedDrafts (fake D1) ──────────

interface CapturedStatement {
  sql: string;
  args: unknown[];
}

function makeFakeDb(seedRows: VenueRow[]) {
  const boundStatements: CapturedStatement[] = [];
  const batch = vi.fn(async (stmts: unknown[]) =>
    stmts.map(() => ({ success: true, results: [], meta: {} })),
  );

  const fakeDb = {
    prepare: (sql: string) => {
      const stmt = {
        bind: (...args: unknown[]) => {
          boundStatements.push({ sql, args });
          return stmt;
        },
        all: async () => ({ success: true, results: seedRows, meta: {} }),
      };
      return stmt;
    },
    batch,
  };

  return { db: fakeDb as unknown as D1Database, boundStatements, batch };
}

describe("fetchPublishSnapshot", () => {
  test("returns every row and splits out draft ids", async () => {
    const { db } = makeFakeDb([
      makeRow({ id: "a", status: "draft" }),
      makeRow({ id: "b", status: "published" }),
      makeRow({ id: "c", status: "draft" }),
    ]);
    const snapshot = await fetchPublishSnapshot(db);
    expect(snapshot.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(snapshot.draftIds).toEqual(["a", "c"]);
  });

  test("draftIds is empty when nothing is a draft", async () => {
    const { db } = makeFakeDb([makeRow({ id: "a", status: "published" })]);
    const snapshot = await fetchPublishSnapshot(db);
    expect(snapshot.draftIds).toEqual([]);
  });
});

describe("promotePublishedDrafts", () => {
  test("issues one UPDATE per draft id plus one audit_log INSERT, in a single batch() call", async () => {
    const { db, boundStatements, batch } = makeFakeDb([]);
    await promotePublishedDrafts(db, ["a", "b"], {
      actorEmail: "admin@pueblofoodmap.com",
      publishedAt: "2026-07-01T00:00:00.000Z",
      prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/1",
      snapshotCount: 108,
    });

    expect(batch).toHaveBeenCalledTimes(1);
    expect(boundStatements).toHaveLength(3); // 2 UPDATEs + 1 audit INSERT

    const updates = boundStatements.filter((s) => s.sql.startsWith("UPDATE venues"));
    expect(updates).toHaveLength(2);
    expect(updates.map((s) => s.args[2])).toEqual(["a", "b"]); // WHERE id = ?

    const auditInsert = boundStatements.find((s) => s.sql.startsWith("INSERT INTO audit_log"));
    expect(auditInsert).toBeDefined();
    expect(auditInsert?.args[0]).toBe("admin@pueblofoodmap.com"); // actor_email
    expect(auditInsert?.args[3]).toBe("publish"); // action
    const afterJson = JSON.parse(auditInsert?.args[5] as string);
    expect(afterJson.promotedIds).toEqual(["a", "b"]);
    expect(afterJson.snapshotCount).toBe(108);
  });

  test("writes the audit row even when there are zero drafts to promote", async () => {
    const { boundStatements, batch, db } = makeFakeDb([]);
    await promotePublishedDrafts(db, [], {
      actorEmail: "admin@pueblofoodmap.com",
      publishedAt: "2026-07-01T00:00:00.000Z",
      prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/1",
      snapshotCount: 108,
    });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(boundStatements).toHaveLength(1);
    expect(boundStatements[0].sql).toContain("INSERT INTO audit_log");
  });
});

// ─── GitHub: commitPublishedVenues (mocked global fetch) ──────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface GithubMockOptions {
  botBranchExists?: boolean;
  prAlreadyExists?: boolean;
  failAt?:
    | "main-ref"
    | "bot-ref"
    | "create-ref"
    | "patch-ref"
    | "file-sha"
    | "commit"
    | "create-pr"
    | "list-pr"
    | "auto-merge";
  failStatus?: number;
}

/**
 * Routes by URL/method rather than call order — robust to the exact
 * sequence commitPublishedVenues() issues its requests in, which is an
 * implementation detail this test suite otherwise has no reason to pin down.
 */
function makeGithubFetchMock(opts: GithubMockOptions = {}) {
  const { botBranchExists = false, prAlreadyExists = false, failAt, failStatus = 500 } = opts;

  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const fail = () => jsonResponse({ message: "mocked failure" }, failStatus);

    if (url.endsWith("/git/ref/heads/main")) {
      return failAt === "main-ref" ? fail() : jsonResponse({ object: { sha: "main-sha-1" } });
    }
    if (url.endsWith("/git/ref/heads/publish-bot")) {
      if (failAt === "bot-ref") return fail();
      if (!botBranchExists) return new Response("Not Found", { status: 404 });
      return jsonResponse({ object: { sha: "bot-sha-old" } });
    }
    if (url.endsWith("/git/refs") && method === "POST") {
      return failAt === "create-ref" ? fail() : jsonResponse({ ref: "refs/heads/publish-bot" }, 201);
    }
    if (url.endsWith("/git/refs/heads/publish-bot") && method === "PATCH") {
      return failAt === "patch-ref" ? fail() : jsonResponse({ ref: "refs/heads/publish-bot" });
    }
    if (url.includes("/contents/src/data/published-venues.ts") && method === "GET") {
      return failAt === "file-sha" ? fail() : jsonResponse({ sha: "file-sha-1" });
    }
    if (url.includes("/contents/src/data/published-venues.ts") && method === "PUT") {
      return failAt === "commit" ? fail() : jsonResponse({ commit: { sha: "commit-sha-1" } });
    }
    if (url.endsWith("/pulls") && method === "POST") {
      if (failAt === "create-pr") return fail();
      if (prAlreadyExists) {
        return jsonResponse(
          {
            message: "Validation Failed",
            errors: [{ message: "A pull request already exists for kr8vka0z:publish-bot." }],
          },
          422,
        );
      }
      return jsonResponse(
        { number: 42, node_id: "PR_new123", html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42" },
        201,
      );
    }
    if (url.includes("/pulls?head=") && method === "GET") {
      return failAt === "list-pr"
        ? fail()
        : jsonResponse([
            { number: 41, node_id: "PR_existing456", html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/41" },
          ]);
    }
    if (url.endsWith("/graphql") && method === "POST") {
      return failAt === "auto-merge"
        ? fail()
        : jsonResponse({ data: { enablePullRequestAutoMerge: { clientMutationId: null } } });
    }

    throw new Error(`Unexpected fetch call in test: ${method} ${url}`);
  });
}

describe("commitPublishedVenues", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("new branch + new PR: commits, opens a PR, enables auto-merge", async () => {
    const mockFetch = makeGithubFetchMock({ botBranchExists: false, prAlreadyExists: false });
    vi.stubGlobal("fetch", mockFetch);

    const result = await commitPublishedVenues("file text", 108, "test-token");
    expect(result).toEqual({
      prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/42",
      prNumber: 42,
      reused: false,
    });

    // Branch didn't exist -> POST git/refs (create), never PATCH (reset).
    const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.endsWith("/git/refs"))).toBe(true);
    expect(calledUrls.some((u) => u.endsWith("/git/refs/heads/publish-bot"))).toBe(false);

    // Auth header present on every call.
    for (const [, init] of mockFetch.mock.calls) {
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-token");
    }
  });

  test("existing branch + already-open PR: force-resets the branch and REUSES the PR (last snapshot wins)", async () => {
    const mockFetch = makeGithubFetchMock({ botBranchExists: true, prAlreadyExists: true });
    vi.stubGlobal("fetch", mockFetch);

    const result = await commitPublishedVenues("file text", 108, "test-token");
    expect(result).toEqual({
      prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/41",
      prNumber: 41,
      reused: true,
    });

    const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
    // Branch existed -> PATCH (force reset), never POST git/refs (create).
    expect(calledUrls.some((u) => u.endsWith("/git/refs/heads/publish-bot"))).toBe(true);
    expect(calledUrls.some((u) => u.endsWith("/git/refs") && !u.includes("heads"))).toBe(false);
  });

  test("PUT contents body carries base64-encoded file text, correct branch and sha", async () => {
    const mockFetch = makeGithubFetchMock();
    vi.stubGlobal("fetch", mockFetch);

    await commitPublishedVenues("hello world file text", 3, "test-token");

    const putCall = mockFetch.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/contents/src/data/published-venues.ts") &&
        (init as RequestInit)?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall?.[1] as RequestInit).body as string);
    expect(body.branch).toBe("publish-bot");
    expect(body.sha).toBe("file-sha-1");
    expect(Buffer.from(body.content, "base64").toString("utf-8")).toBe("hello world file text");
  });

  test.each([
    "main-ref",
    "bot-ref",
    "create-ref",
    "file-sha",
    "commit",
    "create-pr",
    "auto-merge",
  ] as const)("rejects when the %s step fails", async (failAt) => {
    const mockFetch = makeGithubFetchMock({ failAt });
    vi.stubGlobal("fetch", mockFetch);

    await expect(commitPublishedVenues("file text", 108, "test-token")).rejects.toThrow();
  });

  test("a real (non-'already exists') 422 on PR creation propagates as a GitHubApiError, is NOT treated as reuse", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/git/ref/heads/main")) return jsonResponse({ object: { sha: "s" } });
      if (url.endsWith("/git/ref/heads/publish-bot")) return new Response("Not Found", { status: 404 });
      if (url.endsWith("/git/refs") && method === "POST") return jsonResponse({}, 201);
      if (url.includes("/contents/") && method === "GET") return jsonResponse({ sha: "file-sha-1" });
      if (url.includes("/contents/") && method === "PUT") return jsonResponse({ commit: { sha: "c" } });
      if (url.endsWith("/pulls") && method === "POST") {
        return jsonResponse({ message: "Validation Failed", errors: [{ message: "head field is required" }] }, 422);
      }
      throw new Error(`Unexpected call: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(commitPublishedVenues("file text", 108, "test-token")).rejects.toBeInstanceOf(GitHubApiError);
  });
});
