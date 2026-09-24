// @vitest-environment node
/**
 * Tests for fetchPublishBotPrStatus (#598) — new file because
 * src/lib/publishVenues.test.ts is an existing test file (write-guarded on
 * fix/* branches); this covers ONLY the new read-only PR-status function,
 * not the rest of the module (see that file for the mutation-path
 * commitPublishedVenues coverage this mirrors the mocked-fetch style of).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchPublishBotPrStatus, GitHubApiError } from "@/lib/publishVenues";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const PR_LIST_URL_FRAGMENT = "/pulls?head=";
const CHECK_RUNS_URL_FRAGMENT = "/check-runs";

describe("fetchPublishBotPrStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("no open publish-bot PR -> null, never calls the checks endpoint", async () => {
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

  test("open PR, all checks completed and green -> checksState 'passing'", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) {
        return jsonResponse([{ number: 42, html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", head: { sha: "sha-1" } }]);
      }
      if (url.includes(CHECK_RUNS_URL_FRAGMENT)) {
        return jsonResponse({ check_runs: [{ status: "completed", conclusion: "success" }, { status: "completed", conclusion: "neutral" }] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status).toEqual({ number: 42, htmlUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", checksState: "passing" });
  });

  test("open PR, a check-run still in progress -> checksState 'pending'", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) {
        return jsonResponse([{ number: 42, html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", head: { sha: "sha-1" } }]);
      }
      if (url.includes(CHECK_RUNS_URL_FRAGMENT)) {
        return jsonResponse({ check_runs: [{ status: "in_progress", conclusion: null }] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status?.checksState).toBe("pending");
  });

  test("open PR, zero check-runs reported yet -> checksState 'pending', not 'unknown'", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) {
        return jsonResponse([{ number: 42, html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", head: { sha: "sha-1" } }]);
      }
      if (url.includes(CHECK_RUNS_URL_FRAGMENT)) {
        return jsonResponse({ check_runs: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status?.checksState).toBe("pending");
  });

  test("open PR, one check-run failed -> checksState 'failing' (the case #598 exists to surface)", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) {
        return jsonResponse([{ number: 42, html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", head: { sha: "sha-1" } }]);
      }
      if (url.includes(CHECK_RUNS_URL_FRAGMENT)) {
        return jsonResponse({
          check_runs: [
            { status: "completed", conclusion: "success" },
            { status: "completed", conclusion: "failure" },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status?.checksState).toBe("failing");
  });

  test("checks endpoint 403s (PAT missing Checks:read) -> checksState 'unknown', PR presence still returned, no throw", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) {
        return jsonResponse([{ number: 42, html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", head: { sha: "sha-1" } }]);
      }
      if (url.includes(CHECK_RUNS_URL_FRAGMENT)) {
        return jsonResponse({ message: "Resource not accessible" }, 403);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status).toEqual({ number: 42, htmlUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", checksState: "unknown" });
  });

  test("checks endpoint throws (network/timeout) -> checksState 'unknown', PR presence still returned, no throw", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(PR_LIST_URL_FRAGMENT)) {
        return jsonResponse([{ number: 42, html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", head: { sha: "sha-1" } }]);
      }
      if (url.includes(CHECK_RUNS_URL_FRAGMENT)) {
        throw new Error("network down");
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    const status = await fetchPublishBotPrStatus("test-token");
    expect(status).toEqual({ number: 42, htmlUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/42", checksState: "unknown" });
  });
});
