/**
 * reportSubmit route — unit tests (#70 + #74 Turnstile)
 *
 * Tests the pure logic functions exported from the route handler:
 *   - checkRateLimit: sliding window, max 5/hr per IP
 *   - POST handler: Turnstile token validation
 *
 * POST handler integration is covered by ReportForm.test.tsx via mocked fetch.
 * Full end-to-end email send is not tested here (would need a live Resend key).
 *
 * Turnstile tests use the CF test-mode keys:
 *   sitekey  1x00000000000000000000AA  (always passes on client)
 *   secret   1x0000000000000000000000000000000AA  (any token verifies)
 *
 * Note: checkRateLimit uses a module-level Map. We re-import the module
 * fresh for each describe block by using vi.resetModules() so the in-process
 * store doesn't bleed between tests.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("checkRateLimit — sliding window", () => {
  // We import the exported function directly, but must reset the module's
  // internal Map state. We achieve this by using vi.useFakeTimers to control
  // Date.now(), which lets us advance the clock past the 1-hour window.

  let checkRateLimit: (ip: string) => boolean;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    // Dynamic import after resetModules so the internal Map starts fresh
    const mod = await import("@/app/report/submit/route");
    checkRateLimit = mod.checkRateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("first call for a new IP returns true (allowed)", () => {
    expect(checkRateLimit("1.2.3.4")).toBe(true);
  });

  test("allows up to 5 calls per IP within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("10.0.0.1")).toBe(true);
    }
  });

  test("blocks the 6th call from the same IP within the window", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("10.0.0.2");
    }
    expect(checkRateLimit("10.0.0.2")).toBe(false);
  });

  test("does not cross-contaminate between different IPs", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("10.0.0.3");
    }
    // A different IP should still be allowed
    expect(checkRateLimit("10.0.0.4")).toBe(true);
  });

  test("resets after the 1-hour window expires", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("10.0.0.5");
    }
    // Blocked now
    expect(checkRateLimit("10.0.0.5")).toBe(false);

    // Advance time past 1 hour (3,600,001 ms)
    vi.advanceTimersByTime(3_600_001);

    // Should be allowed again in the new window
    expect(checkRateLimit("10.0.0.5")).toBe(true);
  });
});

describe("Honeypot logic — integration with POST handler", () => {
  // Honeypot is validated inside the POST handler. We test the rule:
  // "If body.website is non-empty, return 200 {ok:true} silently."
  // We verify this by calling the handler directly with a mocked Request.
  //
  // All requests include a turnstileToken; fetch is mocked to return
  // success:true from the siteverify call so the Turnstile guard passes.

  let POST: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    const mod = await import("@/app/report/submit/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function makeRequest(body: Record<string, unknown>, ip = "127.0.0.1") {
    return new NextRequest("http://localhost/report/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": ip,
      },
      body: JSON.stringify(body),
    });
  }

  // Returns a fetch mock that passes Turnstile siteverify once, then any
  // subsequent calls (e.g. Resend) can be configured separately.
  function mockTurnstileSuccess() {
    return vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
  }

  test("honeypot filled → returns 200 {ok:true} silently (bot trap)", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess()); // Turnstile passes; no Resend call (honeypot short-circuits)
    const req = makeRequest({
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "hours",
      description: "A long enough description here.",
      website: "http://spam.example.com", // honeypot filled
      turnstileToken: "valid-test-token",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  test("honeypot empty → proceeds to validation (real user path)", async () => {
    // Turnstile passes; invalid body hits validation (422)
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const req = makeRequest({
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "", // invalid
      description: "short", // too short
      website: "", // honeypot empty
      turnstileToken: "valid-test-token",
    });

    const res = await POST(req);
    // Should be 422 (validation error), not 200 (honeypot trap) or 400 (turnstile)
    expect(res.status).toBe(422);
  });

  test("rate limit returns 429 after 5 submissions", async () => {
    vi.useFakeTimers();
    const ip = "192.168.1.100";

    const validBody = {
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "hours",
      description: "This is a sufficiently long description.",
      website: "",
      turnstileToken: "valid-test-token",
    };

    // Mock fetch: Turnstile siteverify (success) + Resend (fail) for each call
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementation(() => {
        // Alternate: odd calls are siteverify, even are Resend
        // Simpler: always return success for siteverify shape; Resend error otherwise
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
          text: async () => "resend error",
        });
      }),
    );

    for (let i = 0; i < 5; i++) {
      const req = makeRequest(validBody, ip);
      await POST(req);
    }

    // 6th request should be rate-limited (Turnstile still passes, rate-limit fires)
    const req = makeRequest(validBody, ip);
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("rate_limit");

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe("Turnstile verification — /report/submit", () => {
  // We test the Turnstile guard directly against the POST handler.
  // fetch is mocked to control what the siteverify API returns.

  let POST: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    const mod = await import("@/app/report/submit/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function makeRequest(body: Record<string, unknown>, ip = "127.0.0.1") {
    return new NextRequest("http://localhost/report/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": ip,
      },
      body: JSON.stringify(body),
    });
  }

  const validBody = {
    venueId: "garden-rmser",
    venueName: "RMSER Community Garden",
    venueAddress: "330 Lake Ave",
    issueType: "hours",
    description: "This is a sufficiently long description.",
    website: "",
  };

  test("missing turnstileToken → 400 turnstile_failed", async () => {
    // No fetch mock needed — token is absent, fails before siteverify call
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest({ ...validBody }); // no turnstileToken field
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("turnstile_failed");
    // fetch should NOT have been called (null token short-circuits)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("empty turnstileToken → 400 turnstile_failed (short-circuits before siteverify)", async () => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest({ ...validBody, turnstileToken: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.error).toBe("turnstile_failed");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("siteverify returns success:false → 400 turnstile_failed", async () => {
    mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest({ ...validBody, turnstileToken: "bad-token" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.error).toBe("turnstile_failed");
  });

  test("siteverify network error → 400 turnstile_failed", async () => {
    mockFetch = vi.fn().mockRejectedValueOnce(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest({ ...validBody, turnstileToken: "any-token" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.error).toBe("turnstile_failed");
  });

  test("siteverify success:true → proceeds to honeypot/rate-limit (not 400)", async () => {
    // First fetch: siteverify succeeds; second fetch: Resend call (stub to fail gracefully)
    mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        text: async () => "resend error",
      });
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest({ ...validBody, turnstileToken: "valid-token" });
    const res = await POST(req);
    // Should NOT be 400 turnstile_failed; will be 502 (Resend failed) or 200
    expect(res.status).not.toBe(400);
    const data = await res.json() as { ok: boolean; error?: string };
    expect(data.error).not.toBe("turnstile_failed");
  });
});
