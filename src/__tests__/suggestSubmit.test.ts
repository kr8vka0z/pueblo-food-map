/**
 * suggestSubmit route — unit tests (#71)
 *
 * Tests the pure logic functions exported from the route handler:
 *   - checkRateLimit: sliding window, max 5/hr per IP
 *
 * POST handler integration is covered by SuggestForm.test.tsx via mocked fetch.
 * Full end-to-end email send is not tested here (would need a live Resend key).
 *
 * Note: checkRateLimit uses a module-level Map. We re-import the module
 * fresh for each describe block by using vi.resetModules() so the in-process
 * store doesn't bleed between tests.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("checkRateLimit — sliding window", () => {
  let checkRateLimit: (ip: string) => boolean;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    // Dynamic import after resetModules so the internal Map starts fresh
    const mod = await import("@/app/suggest/submit/route");
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
    expect(checkRateLimit("10.0.0.4")).toBe(true);
  });

  test("resets after the 1-hour window expires", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("10.0.0.5");
    }
    expect(checkRateLimit("10.0.0.5")).toBe(false);
    vi.advanceTimersByTime(3_600_001);
    expect(checkRateLimit("10.0.0.5")).toBe(true);
  });
});

describe("Honeypot logic — integration with POST handler", () => {
  let POST: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    const mod = await import("@/app/suggest/submit/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeRequest(body: Record<string, unknown>, ip = "127.0.0.1") {
    return new NextRequest("http://localhost/suggest/submit", {
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
      venueName: "Test Pantry",
      address: "123 Main St, Pueblo, CO",
      category: "pantry",
      acceptsSnap: false,
      acceptsWic: false,
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
      venueName: "", // invalid
      address: "",   // invalid
      category: "pantry",
      acceptsSnap: false,
      acceptsWic: false,
      website: "", // honeypot empty
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  test("invalid category → 422", async () => {
    const req = makeRequest({
      venueName: "Test Pantry",
      address: "123 Main St",
      category: "not_a_valid_category",
      acceptsSnap: false,
      acceptsWic: false,
      website: "",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  test("rate limit returns 429 after 5 submissions", async () => {
    vi.useFakeTimers();
    const ip = "192.168.1.200";

    const validBody = {
      venueName: "Test Pantry",
      address: "123 Main St, Pueblo, CO",
      category: "pantry",
      acceptsSnap: false,
      acceptsWic: false,
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
