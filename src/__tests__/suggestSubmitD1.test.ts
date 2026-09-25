/**
 * suggestSubmit route — unit tests (#71 + #74 Turnstile; #587 D1 rate limit)
 *
 * Supersedes the old suggestSubmit.test.ts (#587) — see reportSubmitD1.test.ts's
 * header for the full rationale (identical reasoning, mirrored route). Mocks
 * @/lib/formRateLimit's checkFormRateLimit (same convention checkins/
 * route.test.ts uses for checkAndIncrement); the real per-IP/site-wide
 * COUNTING proof lives in src/lib/formRateLimit.test.ts.
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

function makeFakeD1(opts: { failRun?: boolean } = {}) {
  const runMock = vi.fn(async () => {
    if (opts.failRun) throw new Error("D1 write failed (simulated)");
    return { success: true, results: [], meta: {} };
  });
  const bindMock = vi.fn<(...args: unknown[]) => { run: typeof runMock }>(() => ({ run: runMock }));
  const prepareMock = vi.fn<(...args: unknown[]) => { bind: typeof bindMock }>(() => ({ bind: bindMock }));
  const db = { prepare: prepareMock } as unknown as D1Database;
  return { db, prepareMock, bindMock, runMock };
}

function makeRequest(body: Record<string, unknown>, ip = "127.0.0.1") {
  return new NextRequest("http://localhost/suggest/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

function mockTurnstileSuccess() {
  return vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
}

const validBody = {
  venueName: "Test Pantry",
  address: "123 Main St, Pueblo, CO",
  category: "pantry",
  acceptsSnap: true,
  acceptsWic: false,
  notes: "Open weekdays",
  submitterEmail: "suggester@example.com",
  website: "",
  turnstileToken: "valid-test-token",
};

describe("POST /suggest/submit", () => {
  let POST: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
    mockCheckFormRateLimit.mockReset();
    mockCheckFormRateLimit.mockResolvedValue(true);
    mockGetCloudflareContext.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeD1().db } });
    const mod = await import("@/app/suggest/submit/route");
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
    const res = await POST(makeRequest({ ...validBody, venueName: "", address: "" }));
    expect(res.status).toBe(422);
  });

  test("invalid category → 422", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, category: "not_a_valid_category" }));
    expect(res.status).toBe(422);
  });

  // #232: submitterEmail is required (was optional).
  test("missing submitterEmail → 422", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, submitterEmail: "" }));
    expect(res.status).toBe(422);
  });

  test("invalid submitterEmail format → 422", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, submitterEmail: "not-an-email" }));
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
  });

  describe("D1 rate limit (#587)", () => {
    test("checkFormRateLimit is called with the D1 binding, the dedicated secret, form 'suggest', and the request IP", async () => {
      vi.stubGlobal("fetch", mockTurnstileSuccess());
      const { db } = makeFakeD1();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });

      await POST(makeRequest(validBody, "198.51.100.8"));

      expect(mockCheckFormRateLimit).toHaveBeenCalledTimes(1);
      const [passedDb, passedSecret, passedForm, passedIp] = mockCheckFormRateLimit.mock.calls[0];
      expect(passedDb).toBe(db);
      expect(passedSecret).toBe("test-rate-limit-secret");
      expect(passedForm).toBe("suggest");
      expect(passedIp).toBe("198.51.100.8");
    });

    test("checkFormRateLimit resolving false → 429 rate_limit", async () => {
      vi.stubGlobal("fetch", mockTurnstileSuccess());
      mockCheckFormRateLimit.mockResolvedValueOnce(false);

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(429);
      const data = (await res.json()) as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toBe("rate_limit");
    });

    test("rate-limit rejection performs zero public_submissions writes and never sends email", async () => {
      vi.stubGlobal("fetch", mockTurnstileSuccess());
      const { db, prepareMock } = makeFakeD1();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
      mockCheckFormRateLimit.mockResolvedValueOnce(false);

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(429);
      expect(prepareMock).not.toHaveBeenCalled();
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

  describe("public_submissions queue — #258", () => {
    function mockTurnstileAndResendSuccess() {
      return vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    }

    test("valid submission inserts exactly one public_submissions row (kind=new_venue, target_venue_id null) and still sends the email", async () => {
      const { db, prepareMock, bindMock } = makeFakeD1();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
      vi.stubGlobal("fetch", mockTurnstileAndResendSuccess());

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(200);
      expect(prepareMock).toHaveBeenCalledTimes(1);
      expect(prepareMock.mock.calls[0][0]).toBe(
        "INSERT INTO public_submissions (kind, payload, target_venue_id, submitter_email) VALUES (?, ?, ?, ?)",
      );
      const [kind, payloadJson, targetVenueId, submitterEmail] = bindMock.mock.calls[0];
      expect(kind).toBe("new_venue");
      expect(targetVenueId).toBeNull();
      expect(submitterEmail).toBe("suggester@example.com");
      const payload = JSON.parse(payloadJson as string);
      expect(payload).toMatchObject({
        venueName: "Test Pantry",
        address: "123 Main St, Pueblo, CO",
        category: "pantry",
        acceptsSnap: true,
        acceptsWic: false,
        notes: "Open weekdays",
        submitterEmail: "suggester@example.com",
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test("D1 insert failure is caught + logged (db_write_failed) and does not block the email or change the response", async () => {
      const { db, runMock } = makeFakeD1({ failRun: true });
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
      vi.stubGlobal("fetch", mockTurnstileAndResendSuccess());
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(200);
      expect(runMock).toHaveBeenCalledTimes(1);
      const loggedEntries = errorSpy.mock.calls.map(([line]) => JSON.parse(line as string));
      expect(loggedEntries).toContainEqual(
        expect.objectContaining({ event: "form_submit_failure", form: "suggest", reason: "db_write_failed" }),
      );
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      errorSpy.mockRestore();
    });

    test("Turnstile rejection performs zero D1 writes", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) }),
      );
      const res = await POST(makeRequest({ ...validBody, turnstileToken: "bad-token" }));
      expect(res.status).toBe(400);
      expect(mockGetCloudflareContext).not.toHaveBeenCalled();
    });

    test("honeypot trip performs zero D1 writes", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }),
      );
      const res = await POST(makeRequest({ ...validBody, website: "http://spam.example.com" }));
      expect(res.status).toBe(200);
      expect(mockGetCloudflareContext).not.toHaveBeenCalled();
    });

    test("validation failure performs zero public_submissions writes (D1 IS fetched for the rate-limit check, which now runs first)", async () => {
      const { db, prepareMock } = makeFakeD1();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }),
      );

      const res = await POST(makeRequest({ ...validBody, venueName: "" }));

      expect(res.status).toBe(422);
      expect(mockGetCloudflareContext).toHaveBeenCalled();
      expect(prepareMock).not.toHaveBeenCalled();
    });
  });
});
