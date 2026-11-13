/**
 * parsePublicPost() on JSON that parses but isn't a form object (#894 item
 * 13). Such a body used to reach the field reads and throw, answering 500
 * instead of 400 "Bad request". New file because publicRequest.test.ts is
 * write-guarded on fix/ branches; mocks mirror that file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: vi.fn(async () => true) }));
vi.mock("@/lib/boxTurnstile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/boxTurnstile")>()),
  verifyBoxTurnstile: vi.fn(async () => true),
}));
vi.mock("@/lib/cloudflareContext", () => ({ getCloudflareContext: () => ({ env: { ADMIN_DB: { fake: "d1" } } }) }));
vi.mock("@/lib/logger", () => ({ logFormFailure: vi.fn() }));

import { parsePublicPost } from "@/lib/publicRequest";

function post(body: string) {
  return new Request("https://x.test/submit", { method: "POST", headers: { "content-type": "application/json" }, body });
}

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "managed-secret");
  vi.stubEnv("TURNSTILE_BOX_SECRET_KEY", "box-secret");
  vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "rl-secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("parsePublicPost: valid JSON that isn't an object", () => {
  const lanes = ["managed", "box"] as const;
  const bodies = ["null", '"x"', "5", "[]", '[{"turnstileToken":"tok"}]'];
  it.each(lanes.flatMap((lane) => bodies.map((b) => [lane, b] as const)))("%s lane, body %s -> 400 Bad request", async (lane, b) => {
    const res = await parsePublicPost(post(b), "feedback", lane);
    expect(res).toBeInstanceOf(NextResponse);
    const r = res as NextResponse;
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "Bad request" });
  });

  it.each(lanes)("%s lane: a non-string honeypot doesn't crash the request", async (lane) => {
    const body = { turnstileToken: "tok", website: 1 };
    const res = await parsePublicPost(post(JSON.stringify(body)), "feedback", lane);
    expect(res).not.toBeInstanceOf(NextResponse);
  });
});
