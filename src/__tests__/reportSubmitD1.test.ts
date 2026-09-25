/**
 * reportSubmit route — unit tests (#70 + #74 Turnstile; #587 D1 rate limit)
 *
 * Supersedes the old reportSubmit.test.ts (#587): that file tested the
 * route's old in-process checkRateLimit (a module-level Map export that no
 * longer exists) and asserted zero D1 activity on a rate-limited request —
 * both invalidated now that rate limiting is D1-backed. This file mocks
 * @/lib/formRateLimit's checkFormRateLimit (same convention checkins/
 * route.test.ts uses for checkAndIncrement) so these tests prove the
 * route's WIRING (order of checks, scope/ip/secret passed through,
 * fail-closed on a missing D1 context) — the actual per-IP/site-wide
 * COUNTING behavior is proven once, against a real counting fake D1, in
 * src/lib/formRateLimit.test.ts.
 *
 * Turnstile tests use the CF test-mode keys:
 *   sitekey  1x00000000000000000000AA  (always passes on client)
 *   secret   1x0000000000000000000000000000000AA  (any token verifies)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockCheckFormRateLimit = vi.fn();
vi.mock("@/lib/formRateLimit", () => ({
  checkFormRateLimit: (...args: unknown[]) => mockCheckFormRateLimit(...args),
}));

// #258/#587: route.ts reads getCloudflareContext().env.ADMIN_DB both for the
// rate-limit check and (best-effort) the public_submissions write. Vitest
// hoists vi.mock() above this file's own imports/dynamic imports, so every
// (re-)import of the route module below picks up this fake.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

/**
 * A fake D1Database whose prepare/bind calls are spies, so tests can assert
 * on the exact bound values (not string interpolation) without a real DB.
 * `failRun: true` makes the eventual .run() reject, simulating a D1 outage.
 */
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
  return new NextRequest("http://localhost/report/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

function mockTurnstileSuccess() {
  return vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
}

// garden-rmser is a real seed id (src/data/venues.ts) — required so
// validate()'s server-side venue lookup passes.
const validBody = {
  venueId: "garden-rmser",
  issueType: "hours",
  description: "This is a sufficiently long description.",
  contactEmail: "reporter@example.com",
  website: "",
  turnstileToken: "valid-test-token",
};

describe("POST /report/submit", () => {
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
    const mod = await import("@/app/report/submit/route");
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
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    // Honeypot short-circuits before the rate-limit check ever runs.
    expect(mockCheckFormRateLimit).not.toHaveBeenCalled();
  });

  test("honeypot empty → proceeds to validation (real user path)", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeRequest({ ...validBody, issueType: "", description: "short" }));
    expect(res.status).toBe(422);
  });

  describe("Turnstile verification", () => {
    test("missing turnstileToken → 400 turnstile_failed, never calls the rate limiter", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);
      const res = await POST(makeRequest({ ...validBody, turnstileToken: undefined }));
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("turnstile_failed");
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
    test("checkFormRateLimit is called with the D1 binding, the dedicated secret, form 'report', and the request IP", async () => {
      vi.stubGlobal("fetch", mockTurnstileSuccess());
      const { db } = makeFakeD1();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });

      await POST(makeRequest(validBody, "198.51.100.7"));

      expect(mockCheckFormRateLimit).toHaveBeenCalledTimes(1);
      const [passedDb, passedSecret, passedForm, passedIp] = mockCheckFormRateLimit.mock.calls[0];
      expect(passedDb).toBe(db);
      expect(passedSecret).toBe("test-rate-limit-secret");
      expect(passedForm).toBe("report");
      expect(passedIp).toBe("198.51.100.7");
    });

    test("checkFormRateLimit resolving false → 429 rate_limit (covers both the per-IP and site-wide cap, which formRateLimit.test.ts proves independently)", async () => {
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
      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // only the Turnstile siteverify call
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

    test("valid submission inserts exactly one public_submissions row (kind=closure, target_venue_id=venueId) and still sends the email", async () => {
      const { db, prepareMock, bindMock } = makeFakeD1();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
      vi.stubGlobal("fetch", mockTurnstileAndResendSuccess());

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);

      expect(prepareMock).toHaveBeenCalledTimes(1);
      expect(prepareMock.mock.calls[0][0]).toBe(
        "INSERT INTO public_submissions (kind, payload, target_venue_id, submitter_email) VALUES (?, ?, ?, ?)",
      );
      expect(bindMock).toHaveBeenCalledTimes(1);
      const [kind, payloadJson, targetVenueId, submitterEmail] = bindMock.mock.calls[0];
      expect(kind).toBe("closure");
      expect(targetVenueId).toBe("garden-rmser");
      expect(submitterEmail).toBe("reporter@example.com");
      const payload = JSON.parse(payloadJson as string);
      expect(payload).toMatchObject({
        venueId: "garden-rmser",
        issueType: "hours",
        description: "This is a sufficiently long description.",
        contactEmail: "reporter@example.com",
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test("valid submission with no contactEmail binds submitter_email as null", async () => {
      const { db, bindMock } = makeFakeD1();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
      vi.stubGlobal("fetch", mockTurnstileAndResendSuccess());

      const bodyWithoutEmail = {
        venueId: validBody.venueId,
        issueType: validBody.issueType,
        description: validBody.description,
        website: validBody.website,
        turnstileToken: validBody.turnstileToken,
      };
      const res = await POST(makeRequest(bodyWithoutEmail));

      expect(res.status).toBe(200);
      const [, , , submitterEmail] = bindMock.mock.calls[0];
      expect(submitterEmail).toBeNull();
    });

    test("D1 insert failure is caught + logged (db_write_failed) and does not block the email or change the response", async () => {
      const { db, runMock } = makeFakeD1({ failRun: true });
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
      vi.stubGlobal("fetch", mockTurnstileAndResendSuccess());
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);

      expect(runMock).toHaveBeenCalledTimes(1);
      const loggedEntries = errorSpy.mock.calls.map(([line]) => JSON.parse(line as string));
      expect(loggedEntries).toContainEqual(
        expect.objectContaining({ event: "form_submit_failure", form: "report", reason: "db_write_failed" }),
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

      const res = await POST(makeRequest({ ...validBody, description: "short" }));

      expect(res.status).toBe(422);
      expect(mockGetCloudflareContext).toHaveBeenCalled(); // rate-limit check runs before validation
      expect(prepareMock).not.toHaveBeenCalled(); // but no public_submissions row was ever prepared
    });
  });
});
