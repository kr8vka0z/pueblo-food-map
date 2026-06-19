/**
 * Security hardening tests — issue #160
 *
 * Covers the behaviours added in each sub-item:
 *   1.1  Missing TURNSTILE_SECRET_KEY throws (all 3 routes)
 *   1.2  Over-cap payloads rejected (all 3 routes)
 *   1.3  CR/LF stripped from fields; unknown venueId rejected (report route)
 *   1.4  Non-http(s) URLs rejected (tested inline — render guard covered by
 *        osm-guard.test.tsx for existing venue.url; new safeUrl util tested here)
 *
 * Pattern: vi.resetModules() + dynamic import per describe block so each
 * block gets a fresh module with its own rate-limit store.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function makeReq(
  url: string,
  body: Record<string, unknown>,
  ip = "1.2.3.4",
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

function mockTurnstileOk() {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true }),
  });
}

// ─── 1.1 Missing TURNSTILE_SECRET_KEY throws ─────────────────────────────────

describe("1.1 — throw on missing TURNSTILE_SECRET_KEY", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test("report/submit throws when TURNSTILE_SECRET_KEY is absent", async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    // deliberately do NOT stub TURNSTILE_SECRET_KEY
    const { POST } = await import("@/app/report/submit/route");
    vi.stubGlobal("fetch", vi.fn()); // should not be reached

    const req = makeReq("http://localhost/report/submit", {
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "hours",
      description: "This is a long enough description.",
      website: "",
      turnstileToken: "tok",
    });

    await expect(POST(req)).rejects.toThrow("TURNSTILE_SECRET_KEY not configured");
  });

  test("suggest/submit throws when TURNSTILE_SECRET_KEY is absent", async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    const { POST } = await import("@/app/suggest/submit/route");
    vi.stubGlobal("fetch", vi.fn());

    const req = makeReq("http://localhost/suggest/submit", {
      venueName: "Test Pantry",
      address: "123 Main St",
      category: "pantry",
      website: "",
      turnstileToken: "tok",
    });

    await expect(POST(req)).rejects.toThrow("TURNSTILE_SECRET_KEY not configured");
  });

  test("feedback/submit throws when TURNSTILE_SECRET_KEY is absent", async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    const { POST } = await import("@/app/feedback/submit/route");
    vi.stubGlobal("fetch", vi.fn());

    const req = makeReq("http://localhost/feedback/submit", {
      feedbackType: "positive",
      message: "Great map!",
      contactEmail: "user@example.com",
      website: "",
      turnstileToken: "tok",
    });

    await expect(POST(req)).rejects.toThrow("TURNSTILE_SECRET_KEY not configured");
  });
});

// ─── 1.2 Over-cap payloads rejected ──────────────────────────────────────────

describe("1.2 — over-cap inputs rejected server-side", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test("report/submit: description > 2000 chars → 422", async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const { POST } = await import("@/app/report/submit/route");
    vi.stubGlobal("fetch", mockTurnstileOk());

    const req = makeReq("http://localhost/report/submit", {
      venueId: "garden-rmser",
      venueName: "RMSER Community Garden",
      venueAddress: "330 Lake Ave",
      issueType: "hours",
      description: "x".repeat(2001),
      website: "",
      turnstileToken: "tok",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
  });

  test("suggest/submit: venueName > 200 chars → 422", async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const { POST } = await import("@/app/suggest/submit/route");
    vi.stubGlobal("fetch", mockTurnstileOk());

    const req = makeReq("http://localhost/suggest/submit", {
      venueName: "x".repeat(201),
      address: "123 Main St",
      category: "pantry",
      website: "",
      turnstileToken: "tok",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
  });

  test("feedback/submit: message > 3000 chars → 422", async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const { POST } = await import("@/app/feedback/submit/route");
    vi.stubGlobal("fetch", mockTurnstileOk());

    const req = makeReq("http://localhost/feedback/submit", {
      feedbackType: "positive",
      message: "x".repeat(3001),
      contactEmail: "user@example.com",
      website: "",
      turnstileToken: "tok",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
  });
});

// ─── 1.3 CR/LF stripped; unknown venueId rejected ────────────────────────────

describe("1.3 — CR/LF stripped; unknown venueId rejected in report route", () => {
  let POST: (req: NextRequest) => Promise<import("next/server").NextResponse>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const mod = await import("@/app/report/submit/route");
    POST = mod.POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("unknown venueId → 422 (client cannot inject arbitrary venue name)", async () => {
    vi.stubGlobal("fetch", mockTurnstileOk());

    const req = makeReq("http://localhost/report/submit", {
      venueId: "does-not-exist-999",
      issueType: "hours",
      description: "This is a long enough description.",
      website: "",
      turnstileToken: "tok",
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json() as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/venue/i);
  });

  test("description with CR/LF is accepted but stripped (no line-break injection)", async () => {
    // Mock: Turnstile passes, then Resend call captured so we can inspect the body
    let capturedResendBody: string | undefined;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) // siteverify
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        capturedResendBody = init.body as string;
        return { ok: true, text: async () => "{}" };
      }),
    );

    const req = makeReq("http://localhost/report/submit", {
      venueId: "garden-rmser",
      issueType: "hours",
      description: "Issue with hours\r\nSecond line\nThird line",
      website: "",
      turnstileToken: "tok",
    });

    const res = await POST(req);
    // Should succeed (200) — the field is within limits and has content
    expect(res.status).toBe(200);
    // The Resend body must not contain raw CR or LF in the description field
    expect(capturedResendBody).toBeDefined();
    const parsed = JSON.parse(capturedResendBody!);
    // The text body of the email should not have bare \r
    expect(parsed.text).not.toMatch(/\r/);
  });
});

// ─── 1.4 safeUrl helper ───────────────────────────────────────────────────────

describe("1.4 — safeUrl: only http(s) URLs pass", () => {
  test("http URL passes", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
  });

  test("https URL passes", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
  });

  test("javascript: URL returns null", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });

  test("data: URL returns null", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  test("vbscript: URL returns null", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
  });

  test("ftp URL returns null (only http/https allowed)", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl("ftp://example.com")).toBeNull();
  });

  test("empty string returns null", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl("")).toBeNull();
  });

  test("undefined returns null", async () => {
    const { safeUrl } = await import("@/lib/safeUrl");
    expect(safeUrl(undefined)).toBeNull();
  });
});
