/**
 * Regression test for #598 — new file because src/app/admin/page.test.tsx
 * is an existing test file (write-guarded on fix/* branches); this covers
 * ONLY the new PublishBotStatusBanner wiring, not the rest of the page
 * (see that file for the auth-guard coverage this mirrors the mock setup
 * of).
 *
 * Real global fetch is stubbed per test — with no GITHUB_PUBLISH_TOKEN set
 * (the no-token test), fetchPublishBotPrStatus is never even called, so a
 * missing stub there is not an oversight.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

import DashboardPage from "@/app/admin/page";

function makeFakeDb() {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ success: true, results: [], meta: {} }),
    first: async () => ({ n: 0 }),
  };
  return { prepare: () => stmt } as unknown as object;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("DashboardPage (/admin) — publish-bot PR status banner (#598)", () => {
  const originalToken = process.env.GITHUB_PUBLISH_TOKEN;

  beforeEach(() => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (originalToken === undefined) delete process.env.GITHUB_PUBLISH_TOKEN;
    else process.env.GITHUB_PUBLISH_TOKEN = originalToken;
  });

  test("no GITHUB_PUBLISH_TOKEN (staging) -> no banner, no fetch call at all", async () => {
    delete process.env.GITHUB_PUBLISH_TOKEN;
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    render(await DashboardPage());

    expect(screen.queryByText(/publish in progress/i)).toBeNull();
    expect(screen.queryByText(/publish is stuck/i)).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("token present, an open publish-bot PR with a real merge conflict -> the stuck-publish banner renders", async () => {
    process.env.GITHUB_PUBLISH_TOKEN = "test-token";
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/pulls?head=")) {
        return jsonResponse([
          { number: 99, html_url: "https://github.com/kr8vka0z/pueblo-food-map/pull/99", created_at: new Date().toISOString() },
        ]);
      }
      if (/\/pulls\/\d+$/.test(url)) {
        return jsonResponse({ mergeable_state: "dirty" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", mockFetch);

    render(await DashboardPage());

    expect(await screen.findByText(/publish is stuck/i)).toBeDefined();
    expect(screen.getByText(/merge conflict/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /PR #99/ }).getAttribute("href")).toBe(
      "https://github.com/kr8vka0z/pueblo-food-map/pull/99",
    );
  });

  test("token present but GitHub errors -> fails soft, page still renders with no banner", async () => {
    process.env.GITHUB_PUBLISH_TOKEN = "test-token";
    const mockFetch = vi.fn(async () => jsonResponse({ message: "rate limited" }, 500));
    vi.stubGlobal("fetch", mockFetch);

    render(await DashboardPage());

    expect(await screen.findByText("admin@example.com")).toBeDefined();
    expect(screen.queryByText(/publish in progress/i)).toBeNull();
    expect(screen.queryByText(/publish is stuck/i)).toBeNull();
  });
});
