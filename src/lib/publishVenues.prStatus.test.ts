// @vitest-environment node
/**
 * Tests for fetchPublishBotPrStatus (#598) — new file because
 * src/lib/publishVenues.test.ts is an existing test file (write-guarded on
 * fix/* branches); this covers ONLY the new read-only PR-status function,
 * not the rest of the module (see that file for the mutation-path
 * commitPublishedVenues coverage this mirrors the mocked-fetch style of).
 *
 * Pulls API only (review finding, 2026-09-24 — see fetchPublishBotPrStatus's
 * own header): the fine-grained `GITHUB_PUBLISH_TOKEN` PAT can't read check
 * runs at all, so the original Checks-API version of this function could
 * never actually report a failure. `mergeable_state` + `created_at` from
 * `GET /pulls/{number}` drive the three states instead.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchPublishBotPrStatus, GitHubApiError } from "@/lib/publishVenues";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const PR_LIST_URL_FRAGMENT = "/pulls?head=";
const PR_URL = "https://github.com/kr8vka0z/pueblo-food-map/pull/42";

/** A PR created well past the 20-minute "stuck" age bar. */
const OLD_CREATED_AT = new Date(Date.now() - 30 * 60_000).toISOString();
/** A PR just opened — inside the 20-minute grace window. */
const FRESH_CREATED_AT = new Date().toISOString();

function listResponse(overrides: { created_at?: string } = {}) {
  return jsonResponse([
    { number: 42, html_url: PR_URL, created_at: overrides.created_at ?? OLD_CREATED_AT },
  ]);
}

/** `/pulls/{number}` single-PR detail endpoint — the only place `mergeable_state` is exposed. */
function isDetailUrl(url: string): boolean {
  return /\/pulls\/\d+$/.test(url);
}

describe("fetchPublishBotPrStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("no open publish-bot PR -> null, never calls the single-PR detail endpoint", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return jsonResponse([]);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("PR-list call fails -> throws (caller's job to catch/degrade, same as commitPublishedVenues' own GitHub calls)", async () => {
    const mockFetch = vi.fn(async () => jsonResponse({ message: "rate limited" }, 500));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchPublishBotPrStatus("test-token")).rejects.toThrow(GitHubApiError);
  });

  test("mergeable_state 'dirty' -> state 'stuck_conflict', regardless of PR age", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: FRESH_CREATED_AT });
      if (isDetailUrl(url)) return jsonResponse({ mergeable_state: "dirty" });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status).toEqual({ number: 42, htmlUrl: PR_URL, state: "stuck_conflict" });
  });

  test("mergeable_state 'blocked' and PR older than 20 minutes -> state 'stuck_checks'", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: OLD_CREATED_AT });
      if (isDetailUrl(url)) return jsonResponse({ mergeable_state: "blocked" });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status?.state).toBe("stuck_checks");
  });

  test.each(["unstable", "behind"])(
    "mergeable_state '%s' and PR older than 20 minutes -> state 'stuck_checks'",
    async (mergeableState) => {
      const mockFetch = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: OLD_CREATED_AT });
        if (isDetailUrl(url)) return jsonResponse({ mergeable_state: mergeableState });
        throw new Error(`Unexpected fetch: ${url}`);
      });
      vi.stubGlobal("fetch", mockFetch);

      const status = await fetchPublishBotPrStatus("test-token");
      expect(status?.state).toBe("stuck_checks");
    },
  );

  test("mergeable_state 'blocked' but PR still within the 20-minute grace window -> state 'in_progress'", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: FRESH_CREATED_AT });
      if (isDetailUrl(url)) return jsonResponse({ mergeable_state: "blocked" });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status?.state).toBe("in_progress");
  });

  test("mergeable_state 'clean' -> state 'in_progress' (still open, not yet merged)", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: OLD_CREATED_AT });
      if (isDetailUrl(url)) return jsonResponse({ mergeable_state: "clean" });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status?.state).toBe("in_progress");
  });

  test("mergeable_state still 'unknown' (GitHub hasn't computed it yet) -> state 'in_progress', not stuck", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: OLD_CREATED_AT });
      if (isDetailUrl(url)) return jsonResponse({ mergeable_state: "unknown" });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status?.state).toBe("in_progress");
  });

  test("single-PR detail call 403s (permissions gap) -> state 'in_progress', PR presence still returned, no throw", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: OLD_CREATED_AT });
      if (isDetailUrl(url)) return jsonResponse({ message: "Resource not accessible" }, 403);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status).toEqual({ number: 42, htmlUrl: PR_URL, state: "in_progress" });
  });

  test("single-PR detail call throws (network/timeout) -> state 'in_progress', PR presence still returned, no throw", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) return listResponse({ created_at: OLD_CREATED_AT });
      if (isDetailUrl(url)) throw new Error("network down");
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status).toEqual({ number: 42, htmlUrl: PR_URL, state: "in_progress" });
  });
});
