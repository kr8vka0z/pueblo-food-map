/**
 * feedbackSubmit route — unit tests (#116; #587 D1 rate limit)
 *
 * Supersedes the old feedbackSubmit.test.ts (#587) — see reportSubmitD1.test.ts's
 * header for the full rationale. The old file had NO @opennextjs/cloudflare
 * mock at all (feedback/submit never touched D1 before #587) — every
 * post-honeypot test there now hits a real, unmocked getCloudflareContext()
 * call and throws. This file adds that mock (same convention as report/
 * suggest) and mocks @/lib/formRateLimit's checkFormRateLimit; the real
 * per-IP/site-wide COUNTING proof lives in src/lib/formRateLimit.test.ts.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockCheckFormRateLimit = vi.fn();
vi.mock("@/lib/formRateLimit", () => ({
  checkFormRateLimit: (...args: unknown[]) => mockCheckFormRateLimit(...args),
}));

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

function makeRequest(body: Record<string, unknown>, ip = "127.0.0.1") {
  return new NextRequest("http://localhost/feedback/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

function mockTurnstileSuccess() {
  return vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
}

const validBody = {
  feedbackType: "feature",
  message: "Please add a filter for WIC-only venues.",
  contactEmail: "user@example.com",
  website: "",
  turnstileToken: "valid-test-token",
};

describe("POST /feedback/submit", () => {
  let POST: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
    mockCheckFormRateLimit.mockReset();
    mockCheckFormRateLimit.mockResolvedValue(true);
    mockGetCloudflareContext.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} as D1Database } });
    const mod = await import("@/app/feedback/submit/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("honeypot filled → returns 200 {ok:true} silently (bot trap)", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, website: "http://spam.example.com" }));
    expect(res.status).toBe(200);
    expect(mockCheckFormRateLimit).not.toHaveBeenCalled();
  });

  test("honeypot empty → proceeds to validation (real user path)", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, feedbackType: "", message: "" }));
    expect(res.status).toBe(422);
  });

  test("missing contactEmail → 422", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, contactEmail: "" }));
    expect(res.status).toBe(422);
  });

  test("invalid feedbackType → 422", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, feedbackType: "not_a_valid_type" }));
    expect(res.status).toBe(422);
  });

  test("missing message → 422", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, message: "  " }));
    expect(res.status).toBe(422);
  });

  describe("Turnstile verification", () => {
    test("missing turnstileToken → 400 turnstile_failed, never calls the rate limiter", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);
      const res = await POST(makeRequest({ ...validBody, turnstileToken: undefined }));
      expect(res.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockCheckFormRateLimit).not.toHaveBeenCalled();
    });

    test("siteverify returns success:false → 400 turnstile_failed", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) }),
      );
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(400);
    });

    test("siteverify success:true + Resend success → 200 ok:true", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
          .mockResolvedValueOnce({ ok: true, text: async () => "{}" }),
      );
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);
    });

    test("siteverify success:true + Resend failure → 502 send_failed", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
          .mockResolvedValueOnce({ ok: false, text: async () => "resend error" }),
      );
      const res = await POST(makeRequest(validBody));
      expect(res.status).toBe(502);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("send_failed");
    });
  });

  describe("D1 rate limit (#587)", () => {
    test("checkFormRateLimit is called with the D1 binding, the dedicated secret, form 'feedback', and the request IP", async () => {
      vi.stubGlobal("fetch", mockTurnstileSuccess());
      const db = {} as D1Database;
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });

      await POST(makeRequest(validBody, "198.51.100.9"));

      expect(mockCheckFormRateLimit).toHaveBeenCalledTimes(1);
      const [passedDb, passedSecret, passedForm, passedIp] = mockCheckFormRateLimit.mock.calls[0];
      expect(passedDb).toBe(db);
      expect(passedSecret).toBe("test-rate-limit-secret");
      expect(passedForm).toBe("feedback");
      expect(passedIp).toBe("198.51.100.9");
    });

    test("checkFormRateLimit resolving false → 429 rate_limit", async () => {
      vi.stubGlobal("fetch", mockTurnstileSuccess());
      mockCheckFormRateLimit.mockResolvedValueOnce(false);

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(429);
      const data = (await res.json()) as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toBe("rate_limit");
      // Rejected before the email send — only the Turnstile siteverify call happened.
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    test("no Cloudflare context available → 503 unavailable, never throws, rate limiter never called", async () => {
      vi.stubGlobal("fetch", mockTurnstileSuccess());
      mockGetCloudflareContext.mockImplementation(() => {
        throw new Error("no cloudflare context");
      });

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(503);
      const data = (await res.json()) as { ok: boolean; error: string };
      expect(data.error).toBe("unavailable");
      expect(mockCheckFormRateLimit).not.toHaveBeenCalled();
    });

    test("missing CHECKIN_RATE_LIMIT_SECRET throws (same posture as a missing TURNSTILE_SECRET_KEY)", async () => {
      vi.unstubAllEnvs();
      vi.stubEnv("RESEND_API_KEY", "test_key");
      vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
      vi.stubGlobal("fetch", mockTurnstileSuccess());

      await expect(POST(makeRequest(validBody))).rejects.toThrow("CHECKIN_RATE_LIMIT_SECRET not configured");
    });
  });
});
