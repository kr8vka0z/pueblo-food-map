/**
 * POST /report/submit — non-string contactEmail (#595).
 *
 * Separate file from reportSubmitD1.test.ts (existing, write-guarded on
 * fix/* branches): before #595, a JSON body with a non-string
 * `contactEmail` (e.g. a number) reached isValidEmail()'s `.slice()` call
 * and threw, producing an unhandled 500 instead of the intended 422
 * validation error. Mocking setup mirrors reportSubmitD1.test.ts.
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

function makeFakeD1() {
  const runMock = vi.fn(async () => ({ success: true, results: [], meta: {} }));
  const bindMock = vi.fn<(...args: unknown[]) => { run: typeof runMock }>(() => ({ run: runMock }));
  const prepareMock = vi.fn<(...args: unknown[]) => { bind: typeof bindMock }>(() => ({ bind: bindMock }));
  const db = { prepare: prepareMock } as unknown as D1Database;
  return { db };
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
// validate()'s server-side venue lookup passes before reaching the email check.
const validBody = {
  venueId: "garden-rmser",
  issueType: "hours",
  description: "This is a sufficiently long description.",
  website: "",
  turnstileToken: "valid-test-token",
};

describe("POST /report/submit — non-string contactEmail (#595)", () => {
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

  test("contactEmail as a number → 422 Invalid email format, not a 500", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());

    const res = await POST(makeRequest({ ...validBody, contactEmail: 12345 }));

    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Invalid email format");
  });

  test("contactEmail as an object → 422 Invalid email format, not a 500", async () => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());

    const res = await POST(makeRequest({ ...validBody, contactEmail: { foo: "bar" } }));

    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.error).toBe("Invalid email format");
  });
});
