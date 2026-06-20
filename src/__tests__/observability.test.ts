/**
 * Observability — unit tests (#163)
 *
 * Covers:
 *   1. logFormFailure: console.warn/error routing, JSON shape, PII-free contract.
 *   2. GET /api/health: 200 response, shape, version matches package.json, no fetch.
 *   3. Wiring — all 3 form routes fire logFormFailure on Turnstile rejection.
 *
 * Turnstile tests use the CF always-fail secret key pattern: mock siteverify
 * to return { success: false } so the Turnstile guard triggers and we can
 * assert the structured log fires.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import pkg from "../../package.json";

// ─── 1. logFormFailure unit tests ─────────────────────────────────────────────

describe("logFormFailure", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("turnstile_failed → console.warn with correct JSON shape", async () => {
    const { logFormFailure } = await import("@/lib/logger");
    logFormFailure("suggest", "turnstile_failed");

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).not.toHaveBeenCalled();

    const arg = warnSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({
      event: "form_submit_failure",
      form: "suggest",
      reason: "turnstile_failed",
    });
  });

  test("send_failed → console.error with correct JSON shape including detail", async () => {
    const { logFormFailure } = await import("@/lib/logger");
    logFormFailure("report", "send_failed", { status: 429, message: "rate limited" });

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();

    const arg = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({
      event: "form_submit_failure",
      form: "report",
      reason: "send_failed",
      status: 429,
      message: "rate limited",
    });
  });

  test("send_failed without detail → no status or message keys", async () => {
    const { logFormFailure } = await import("@/lib/logger");
    logFormFailure("feedback", "send_failed");

    expect(errorSpy).toHaveBeenCalledOnce();
    const arg = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg) as Record<string, unknown>;
    expect(parsed).toMatchObject({ event: "form_submit_failure", form: "feedback" });
    expect("status" in parsed).toBe(false);
    expect("message" in parsed).toBe(false);
  });

  test("serialized object has no PII keys", async () => {
    const { logFormFailure } = await import("@/lib/logger");
    logFormFailure("suggest", "turnstile_failed");

    const arg = warnSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(arg) as Record<string, unknown>;
    const piiKeys = ["ip", "email", "name", "address", "body"];
    for (const key of piiKeys) {
      expect(key in parsed).toBe(false);
    }
  });
});

// ─── 2. GET /api/health ────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() => {
      throw new Error("fetch should not be called from health endpoint");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("returns 200 with correct shape", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as { status: string; version: string; timestamp: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe(pkg.version);
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(isNaN(new Date(body.timestamp).getTime())).toBe(false);
  });

  test("version matches package.json (robust across bumps — no hardcoded string)", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json() as { version: string };
    // pkg.version is imported directly from package.json in both the route and this test
    expect(body.version).toBe(pkg.version);
  });

  test("timestamp is a valid ISO string", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json() as { timestamp: string };
    // ISO 8601 basic check: parse succeeds and result is not NaN
    const d = new Date(body.timestamp);
    expect(isNaN(d.getTime())).toBe(false);
    // Must contain 'T' separator (ISO format, not locale string)
    expect(body.timestamp).toContain("T");
  });

  test("fetch was NOT called", async () => {
    const { GET } = await import("@/app/api/health/route");
    await GET();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── 3. Wiring — turnstile_failed fires logFormFailure in all 3 routes ────────

describe("wiring: suggest/submit fires logFormFailure on turnstile rejection", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    // Mock siteverify to return success:false (Turnstile rejection)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }));
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
  });

  function makeRequest(url: string, body: Record<string, unknown>) {
    return new NextRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "127.0.0.1",
      },
      body: JSON.stringify(body),
    });
  }

  test("suggest route: Turnstile rejection → 400 + console.warn form_submit_failure", async () => {
    const mod = await import("@/app/suggest/submit/route");
    const req = makeRequest("http://localhost/suggest/submit", {
      venueName: "Test Venue",
      address: "123 Main St, Pueblo, CO",
      category: "pantry",
      acceptsSnap: false,
      acceptsWic: false,
      website: "",
      turnstileToken: "bad-token",
    });

    const res = await mod.POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("turnstile_failed");

    expect(warnSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("form_submit_failure");
    expect(logged.reason).toBe("turnstile_failed");
    expect(logged.form).toBe("suggest");
  });
});

describe("wiring: report/submit fires logFormFailure on turnstile rejection", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }));
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
  });

  function makeRequest(url: string, body: Record<string, unknown>) {
    return new NextRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "127.0.0.1",
      },
      body: JSON.stringify(body),
    });
  }

  test("report route: Turnstile rejection → 400 + console.warn form_submit_failure", async () => {
    const mod = await import("@/app/report/submit/route");
    const req = makeRequest("http://localhost/report/submit", {
      venueId: "osm-way-535656814",
      issueType: "closed",
      description: "This place is now closed permanently.",
      website: "",
      turnstileToken: "bad-token",
    });

    const res = await mod.POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("turnstile_failed");

    expect(warnSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("form_submit_failure");
    expect(logged.reason).toBe("turnstile_failed");
    expect(logged.form).toBe("report");
  });
});

describe("wiring: feedback/submit fires logFormFailure on turnstile rejection", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }));
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
  });

  function makeRequest(url: string, body: Record<string, unknown>) {
    return new NextRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "127.0.0.1",
      },
      body: JSON.stringify(body),
    });
  }

  test("feedback route: Turnstile rejection → 400 + console.warn form_submit_failure", async () => {
    const mod = await import("@/app/feedback/submit/route");
    const req = makeRequest("http://localhost/feedback/submit", {
      feedbackType: "general",
      message: "Great resource for the community!",
      contactEmail: "test@example.com",
      website: "",
      turnstileToken: "bad-token",
    });

    const res = await mod.POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("turnstile_failed");

    expect(warnSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("form_submit_failure");
    expect(logged.reason).toBe("turnstile_failed");
    expect(logged.form).toBe("feedback");
  });
});
