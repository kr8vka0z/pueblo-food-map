/**
 * reportSubmit route — unit tests (#70)
 *
 * Tests the pure logic functions exported from the route handler:
 *   - checkRateLimit: sliding window, max 5/hr per IP
 *
 * POST handler integration is covered by ReportForm.test.tsx via mocked fetch.
 * Full end-to-end email send is not tested here (would need a live Resend key).
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

  let POST: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>;

  beforeEach(async () => {
    vi.resetModules();
    // Set RESEND_API_KEY so the handler doesn't throw on missing env
    vi.stubEnv("RESEND_API_KEY", "test_key");
    const mod = await import("@/app/report/submit/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  test("honeypot filled → returns 200 {ok:true} silently (bot trap)", async () => {
    const req = makeRequest({
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "hours",
      description: "A long enough description here.",
      website: "http://spam.example.com", // honeypot filled
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  test("honeypot empty → proceeds to validation (real user path)", async () => {
    // Missing required fields — should fail validation (422), not silently succeed
    const req = makeRequest({
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "", // invalid
      description: "short", // too short
      website: "", // honeypot empty
    });

    const res = await POST(req);
    // Should be 422 (validation error), not 200 (honeypot trap)
    expect(res.status).toBe(422);
  });

  test("rate limit returns 429 after 5 submissions", async () => {
    vi.useFakeTimers();
    const ip = "192.168.1.100";

    // Submit 5 valid-ish requests (will fail at email send step since Resend key is fake)
    // We need valid bodies to pass honeypot + validation; Resend call will fail
    const validBody = {
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "hours",
      description: "This is a sufficiently long description.",
      website: "",
    };

    // Mock fetch (Resend call) to fail so we don't actually make HTTP calls
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: async () => "error" }));

    for (let i = 0; i < 5; i++) {
      const req = makeRequest(validBody, ip);
      await POST(req);
    }

    // 6th request should be rate-limited
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
