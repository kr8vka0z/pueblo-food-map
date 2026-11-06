/**
 * requestIp(), and parsePublicPost() — the anti-spam preamble seven public
 * routes share. Each
 * rejection must keep the exact status and body the routes returned before
 * the helper existed, on both Turnstile lanes; the routes' own tests cover
 * what happens after it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockVerifyTurnstile = vi.fn();
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: (...a: unknown[]) => mockVerifyTurnstile(...a) }));
const mockVerifyBox = vi.fn();
vi.mock("@/lib/boxTurnstile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/boxTurnstile")>()),
  verifyBoxTurnstile: (...a: unknown[]) => mockVerifyBox(...a),
}));
const mockContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({ getCloudflareContext: () => mockContext() }));
const mockLog = vi.fn();
vi.mock("@/lib/logger", () => ({ logFormFailure: (...a: unknown[]) => mockLog(...a) }));

import { parsePublicPost, requestIp } from "@/lib/publicRequest";

const DB = { fake: "d1" };
const GOOD = { turnstileToken: "tok", website: "" };

function post(body: string, contentType = "application/json") {
  return new Request("https://x.test/submit", { method: "POST", headers: { "content-type": contentType }, body });
}

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "managed-secret");
  vi.stubEnv("TURNSTILE_BOX_SECRET_KEY", "box-secret");
  vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "rl-secret");
  mockVerifyTurnstile.mockResolvedValue(true);
  mockVerifyBox.mockResolvedValue(true);
  mockContext.mockReturnValue({ env: { ADMIN_DB: DB } });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("requestIp", () => {
  it.each([
    ["cf-connecting-ip wins over x-forwarded-for", { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }, "1.1.1.1"],
    ["first x-forwarded-for entry, trimmed", { "x-forwarded-for": " 3.3.3.3 , 4.4.4.4" }, "3.3.3.3"],
    ["neither header -> unknown", {}, "unknown"],
    // Matches the inline expression it replaced: an empty first entry stays "", it does not fall through.
    ["empty first x-forwarded-for entry stays empty", { "x-forwarded-for": ", 5.5.5.5" }, ""],
  ])("%s", (_label, headers, expected) => {
    expect(requestIp(new Request("https://example.com", { headers }))).toBe(expected);
  });
});

describe("parsePublicPost", () => {
  it.each(["managed", "box"] as const)("%s lane: a clean request returns the body, the rate-limit secret and D1", async (lane) => {
    const res = await parsePublicPost(post(JSON.stringify(GOOD)), "feedback", lane);
    expect(res).toEqual({ body: GOOD, ip: "unknown", rateLimitSecret: "rl-secret", db: DB });
  });

  const rejections: [string, () => Request, () => void, number, object][] = [
    ["not JSON content-type", () => post(JSON.stringify(GOOD), "text/plain"), () => {}, 400, { ok: false, error: "Bad request" }],
    ["unparseable JSON", () => post("{nope"), () => {}, 400, { ok: false, error: "Bad request" }],
    [
      "Turnstile rejects the token",
      () => post(JSON.stringify(GOOD)),
      () => {
        mockVerifyTurnstile.mockResolvedValue(false);
        mockVerifyBox.mockResolvedValue(false);
      },
      400,
      { ok: false, error: "turnstile_failed" },
    ],
    ["honeypot filled (bots are told it worked)", () => post(JSON.stringify({ ...GOOD, website: "x" })), () => {}, 200, { ok: true }],
    ["D1 binding unreachable (fails closed)", () => post(JSON.stringify(GOOD)), () => mockContext.mockImplementation(() => { throw new Error("no ctx"); }), 503, { ok: false, error: "unavailable" }],
  ];
  const cases = rejections.flatMap(([name, req, setup, status, body]) =>
    (["managed", "box"] as const).map((lane) => [lane, name, req, setup, status, body] as const),
  );

  it.each(cases)("%s lane: %s -> same status and body as before", async (lane, _name, req, setup, status, body) => {
    setup();
    const res = await parsePublicPost(req(), "report", lane);
    expect(res).toBeInstanceOf(NextResponse);
    const response = res as NextResponse;
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
    if (status === 400 && "error" in body && body.error === "turnstile_failed") {
      expect(mockLog).toHaveBeenCalledWith("report", "turnstile_failed");
    }
  });

  it("box lane with withDb=false never touches D1 (the needs route validates fields first)", async () => {
    mockContext.mockImplementation(() => {
      throw new Error("must not be called");
    });
    const res = await parsePublicPost(post(JSON.stringify(GOOD)), "checkin_needs", "box", false);
    expect(res).toEqual({ body: GOOD, ip: "unknown", rateLimitSecret: "rl-secret" });
  });
});
