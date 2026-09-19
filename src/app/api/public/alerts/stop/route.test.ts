// @vitest-environment node
/**
 * Route-level tests for POST /api/public/alerts/stop (Blessing Boxes
 * slice 6). Mocks src/lib/boxAlerts.ts's stopSubscriptionByToken — this
 * route is a thin wrapper, so the lib function's own behavior is covered
 * by boxAlerts.test.ts, not re-tested here.
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

function makeRequest(body?: unknown, contentType = "application/json"): NextRequest {
  return new NextRequest("https://pueblofoodmap.com/api/public/alerts/stop", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

  test("wrong Content-Type -> 400", async () => {
    const res = await POST(makeRequest({ token: "abc" }, "text/plain"));
    expect(res.status).toBe(400);
  });

  test("missing token -> 200 neutral invalid_token, never calls the lib function", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("invalid_token");
    expect(mockStopSubscriptionByToken).not.toHaveBeenCalled();
  });

  test("missing CHECKIN_RATE_LIMIT_SECRET -> throws", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    await expect(POST(makeRequest({ token: "abc" }))).rejects.toThrow("CHECKIN_RATE_LIMIT_SECRET not configured");
  });

  test("stopSubscriptionByToken 'stopped' -> 200 ok:true", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("stopped");
    const res = await POST(makeRequest({ token: "real-token" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockStopSubscriptionByToken).toHaveBeenCalledWith(expect.anything(), "real-token", "test-secret");
  });

  test("'not_found' -> 200 neutral invalid_token", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("not_found");
    const res = await POST(makeRequest({ token: "unknown" }));
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("'rate_limited' folds into the same neutral invalid_token response as 'not_found'", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("rate_limited");
    const res = await POST(makeRequest({ token: "spammed" }));
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("no live Cloudflare context -> 503", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no context");
    });
    const res = await POST(makeRequest({ token: "abc" }));
    expect(res.status).toBe(503);
    expect(mockStopSubscriptionByToken).not.toHaveBeenCalled();
  });
});
