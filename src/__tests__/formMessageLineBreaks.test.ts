/**
 * The three public form routes keep paragraph breaks in the visitor's
 * message (#894 item 8): in the email text, and for report/suggest in the
 * stored review row too. Anything that reaches the email subject stays on
 * one line (header injection, #160 1.3).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeD1, makeSubmitRequest } from "@/__tests__/helpers/submitRouteTestHelpers";

vi.mock("@/lib/formRateLimit", () => ({ checkFormRateLimit: vi.fn(async () => true) }));
const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const PARA = "First paragraph.\r\n\r\nSecond paragraph.";
const KEPT = "First paragraph.\n\nSecond paragraph.";

const cases = [
  {
    route: "feedback",
    body: { feedbackType: "feature", message: PARA, contactEmail: "user@example.com" },
    stored: false,
  },
  {
    route: "report",
    body: { venueId: "garden-rmser", issueType: "hours", description: PARA },
    stored: true,
  },
  {
    route: "suggest",
    body: {
      venueName: "Test\r\nBcc: evil@example.com",
      address: "123 Main St, Pueblo, CO",
      category: "pantry",
      notes: PARA,
      submitterEmail: "suggester@example.com",
    },
    stored: true,
  },
] as const;

describe("form messages keep their paragraph breaks", () => {
  let fake: ReturnType<typeof makeFakeD1>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
    fake = makeFakeD1();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: fake.db } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test.each(cases)("$route: email text keeps the break, subject stays one line", async ({ route, body, stored }) => {
    let sent: { subject: string; text: string } | undefined;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
        .mockImplementationOnce(async (_url: string, init: RequestInit) => {
          sent = JSON.parse(init.body as string);
          return { ok: true, text: async () => "{}" };
        }),
    );
    const { POST } = await import(`@/app/(site)/${route}/submit/route`);
    const res = await POST(makeSubmitRequest(`/${route}/submit`, { ...body, website: "", turnstileToken: "tok" }));

    expect(res.status).toBe(200);
    expect(sent!.text).toContain(KEPT);
    expect(sent!.subject).not.toMatch(/[\r\n]/);
    if (stored) {
      const payloads = fake.bindMock.mock.calls.flat().filter((a): a is string => typeof a === "string" && a.startsWith("{"));
      expect(payloads.some((p) => Object.values(JSON.parse(p)).includes(KEPT))).toBe(true);
    }
  });
});
