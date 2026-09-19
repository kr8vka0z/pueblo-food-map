// @vitest-environment node
/**
 * Route-level tests for POST /api/public/alerts/stop (Blessing Boxes
 * slice 6). Mocks src/lib/boxAlerts.ts's stopSubscriptionByToken — this
 * route is a thin wrapper, so the lib function's own behavior is covered
 * by boxAlerts.test.ts, not re-tested here.
 *
 * 2026-09-18 security review (item 1, BLOCKER): the old "wrong Content-Type
 * -> 400" test asserted the exact bug this fix removes — a real mail
 * client's RFC 8058 one-click unsubscribe POSTs form-urlencoded with the
 * token ONLY in the query string, and this route used to 400 that outright.
 * Replaced with tests proving the query-string + form-encoded path (the
 * mail-client shape) and the query-string + JSON path both work, and that a
 * text/html Accept header gets a static HTML page back (the <noscript>
 * fallback form's top-level navigation, item 6).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockStopSubscriptionByToken = vi.fn();
vi.mock("@/lib/boxAlerts", () => ({
  stopSubscriptionByToken: (...args: unknown[]) => mockStopSubscriptionByToken(...args),
}));

import { POST } from "@/app/api/public/alerts/stop/route";

function makeRequest(opts: {
  query?: string;
  body?: string;
  contentType?: string;
  accept?: string;
} = {}): NextRequest {
  const url = `https://pueblofoodmap.com/api/public/alerts/stop${opts.query ?? ""}`;
  const headers: Record<string, string> = {};
  if (opts.contentType) headers["Content-Type"] = opts.contentType;
  if (opts.accept) headers["Accept"] = opts.accept;
  return new NextRequest(url, { method: "POST", headers, body: opts.body });
}

describe("POST /api/public/alerts/stop", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} as D1Database } });
    mockStopSubscriptionByToken.mockReset();
    process.env.CHECKIN_RATE_LIMIT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("RFC 8058 one-click shape — form-encoded body, token ONLY in the query string -> 200, row unsubscribed", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("stopped");
    const res = await POST(
      makeRequest({
        query: "?t=real-token",
        contentType: "application/x-www-form-urlencoded",
        body: "List-Unsubscribe=One-Click",
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockStopSubscriptionByToken).toHaveBeenCalledWith(expect.anything(), "real-token", "test-secret");
  });

  test("JSON body token still works (no query string) — the human page's auto-POST shape", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("stopped");
    const res = await POST(makeRequest({ contentType: "application/json", body: JSON.stringify({ token: "real-token" }) }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockStopSubscriptionByToken).toHaveBeenCalledWith(expect.anything(), "real-token", "test-secret");
  });

  test("Accept: text/html (the <noscript> fallback form's top-level nav) -> a static HTML page, not JSON", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("stopped");
    const res = await POST(makeRequest({ query: "?t=real-token", accept: "text/html,application/xhtml+xml" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<h1>");
  });

  test("no token anywhere (query or body) -> 200 neutral invalid_token, never calls the lib function", async () => {
    const res = await POST(makeRequest({ contentType: "application/json", body: JSON.stringify({}) }));
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("invalid_token");
    expect(mockStopSubscriptionByToken).not.toHaveBeenCalled();
  });

  test("missing CHECKIN_RATE_LIMIT_SECRET -> throws", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    await expect(POST(makeRequest({ query: "?t=abc" }))).rejects.toThrow("CHECKIN_RATE_LIMIT_SECRET not configured");
  });

  test("stopSubscriptionByToken 'stopped' -> 200 ok:true", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("stopped");
    const res = await POST(makeRequest({ query: "?t=real-token" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test("'not_found' -> 200 neutral invalid_token", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("not_found");
    const res = await POST(makeRequest({ query: "?t=unknown" }));
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("'rate_limited' folds into the same neutral invalid_token response as 'not_found'", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("rate_limited");
    const res = await POST(makeRequest({ query: "?t=spammed" }));
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("no live Cloudflare context -> 503", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no context");
    });
    const res = await POST(makeRequest({ query: "?t=abc" }));
    expect(res.status).toBe(503);
    expect(mockStopSubscriptionByToken).not.toHaveBeenCalled();
  });
});
