/**
 * /suggest/submit with a non-string optional field (#894 item 13). It used
 * to pass the length check, then throw in stripLineBreaks (a 500) instead of
 * the route's usual 422. New file because suggestSubmitD1.test.ts is
 * write-guarded on fix/ branches; setup mirrors it.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeD1, makeSubmitRequest, mockTurnstileSuccess } from "@/__tests__/helpers/submitRouteTestHelpers";

vi.mock("@/lib/formRateLimit", () => ({ checkFormRateLimit: vi.fn(async () => true) }));
const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const validBody = {
  venueName: "Test Pantry",
  address: "123 Main St, Pueblo, CO",
  category: "pantry",
  submitterEmail: "suggester@example.com",
  website: "",
  turnstileToken: "valid-test-token",
};

describe("POST /suggest/submit: optional field types", () => {
  let POST: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeD1().db } });
    POST = (await import("@/app/(site)/suggest/submit/route")).POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test.each([
    ["hours", ["x"]],
    ["contact", 5],
    ["notes", { a: 1 }],
  ])("non-string %s -> 422, not a 500", async (field, value) => {
    vi.stubGlobal("fetch", mockTurnstileSuccess());
    const res = await POST(makeSubmitRequest("/suggest/submit", { ...validBody, [field]: value }));
    expect(res.status).toBe(422);
  });
});
