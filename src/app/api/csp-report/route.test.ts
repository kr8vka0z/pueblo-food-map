// @vitest-environment node
/**
 * Route-level tests for POST /api/csp-report (#593 CI-review follow-up —
 * Content-Security-Policy-Report-Only has no observer without somewhere to
 * POST to). Mocks the rate limiter and @opennextjs/cloudflare — same
 * layered-mock convention as the box-photos flag route's own test file.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCheckAndIncrement = vi.fn();
vi.mock("@/lib/checkinRateLimit", () => ({
  checkAndIncrement: (...args: unknown[]) => mockCheckAndIncrement(...args),
}));

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { POST } from "@/app/api/csp-report/route";

function postReport(body: unknown, contentType = "application/csp-report"): NextRequest {
  return new NextRequest("http://localhost:3000/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": contentType, "cf-connecting-ip": "203.0.113.9" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/csp-report", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const originalRateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.CHECKIN_RATE_LIMIT_SECRET = "test-secret";
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} as D1Database } });
    // Default: under every cap. Individual tests override for the
    // rate-limited cases.
    mockCheckAndIncrement.mockResolvedValue(true);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env.CHECKIN_RATE_LIMIT_SECRET = originalRateLimitSecret;
    mockCheckAndIncrement.mockReset();
    mockGetCloudflareContext.mockReset();
  });

  test("logs a legacy report-uri ({ csp-report }) payload and returns 204", async () => {
    const res = await POST(
      postReport({
        "csp-report": {
          "violated-directive": "script-src-elem",
          "blocked-uri": "https://evil.example.com/x.js",
          "document-uri": "https://pueblofoodmap.com/venue/some-id",
        },
      }),
    );

    expect(res.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged).toEqual({
      event: "csp_violation_report",
      violatedDirective: "script-src-elem",
      blockedUri: "https://evil.example.com/x.js",
      documentUri: "https://pueblofoodmap.com/venue/some-id",
    });
  });

  test("strips the query string off document-uri before logging (alerts subscription token)", async () => {
    await POST(
      postReport({
        "csp-report": {
          "violated-directive": "connect-src",
          "blocked-uri": "https://tracker.example.com",
          "document-uri": "https://pueblofoodmap.com/alerts/confirm?t=super-secret-token",
        },
      }),
    );

    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged.documentUri).toBe("https://pueblofoodmap.com/alerts/confirm");
    expect(JSON.stringify(logged)).not.toContain("super-secret-token");
  });

  test("returns 204 and logs nothing for a malformed body, never 500s", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/csp-report", {
        method: "POST",
        headers: { "Content-Type": "application/csp-report" },
        body: "not json",
      }),
    );

    expect(res.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("returns 204 and logs nothing for an empty/unrecognized JSON body", async () => {
    const res = await POST(postReport({ unexpected: "shape" }));
    expect(res.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("caps each logged field at 500 chars — an unauthenticated endpoint must not let one POST bloat Workers Logs", async () => {
    const huge = "x".repeat(10_000);
    await POST(
      postReport({
        "csp-report": {
          "violated-directive": huge,
          "blocked-uri": huge,
          "document-uri": `https://pueblofoodmap.com/${huge}`,
        },
      }),
    );

    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged.violatedDirective.length).toBe(500);
    expect(logged.blockedUri.length).toBe(500);
    expect(logged.documentUri.length).toBeLessThanOrEqual(500);
  });

  test("reads the Reporting API v1 field name (effectiveDirective) on the defensive report-to branch", async () => {
    await POST(
      postReport(
        [
          {
            type: "csp-violation",
            body: {
              effectiveDirective: "style-src-attr",
              blockedURL: "inline",
              documentURL: "https://pueblofoodmap.com/venues",
            },
          },
        ],
        "application/reports+json",
      ),
    );

    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged.violatedDirective).toBe("style-src-attr");
    expect(logged.blockedUri).toBe("inline");
    expect(logged.documentUri).toBe("https://pueblofoodmap.com/venues");
  });

  test("checks the per-IP cap before the site-wide cap, keyed off cf-connecting-ip", async () => {
    await POST(postReport({ "csp-report": { "violated-directive": "script-src" } }));

    expect(mockCheckAndIncrement).toHaveBeenNthCalledWith(
      1,
      {},
      "test-secret",
      { scope: "csp-report-ip", id: "203.0.113.9" },
      expect.any(Number),
    );
  });

  test("returns 204 but logs nothing once the per-IP cap is exceeded (still 204 — the browser gets no signal either way)", async () => {
    mockCheckAndIncrement.mockResolvedValueOnce(false); // per-IP cap exceeded
    const res = await POST(postReport({ "csp-report": { "violated-directive": "script-src" } }));

    expect(res.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
    // Site-wide cap must never be touched once the per-IP cap already failed
    // — same "don't let one over-cap IP burn the shared budget" ordering
    // src/lib/formRateLimit.ts documents for the public forms.
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(1);
  });

  test("returns 204 but logs nothing once the site-wide cap is exceeded", async () => {
    mockCheckAndIncrement.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await POST(postReport({ "csp-report": { "violated-directive": "script-src" } }));

    expect(res.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("fails closed (never logs) when the Cloudflare D1 context can't be resolved, without 500ing the response", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no live Worker context");
    });
    const res = await POST(postReport({ "csp-report": { "violated-directive": "script-src" } }));

    expect(res.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
