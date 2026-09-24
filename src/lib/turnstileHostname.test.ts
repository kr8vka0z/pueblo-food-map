/**
 * verifyTurnstileToken — siteverify hostname check (#595).
 *
 * Separate file from turnstile.test.ts: that file is tracked in origin/dev
 * and the write-guard on this fix/* branch refused an in-place edit to it
 * (despite #595 describing it as "new as of today" — it was already
 * committed by the time this branch was cut). The exact diff that was meant
 * to land in turnstile.test.ts is included in this branch's final report
 * for the parent to apply; this file covers the same behavior standalone so
 * the new siteverify hostname guard in turnstile.ts still ships with test
 * coverage either way.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function stubFetch() {
  vi.stubGlobal("fetch", fetchMock);
}

describe("verifyTurnstileToken — siteverify hostname check (#595)", () => {
  test.each([
    "pueblofoodmap.com",
    "www.pueblofoodmap.com",
    "dev.pueblofoodmap.com",
    "pueblo-food-map.kyle-boyd.workers.dev",
    "localhost", // Cloudflare's documented test keys report this domain
  ])("success:true with hostname %j (one of ours) → true", async (hostname) => {
    stubFetch();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, hostname })),
    );
    expect(await verifyTurnstileToken("tok", "secret")).toBe(true);
  });

  test("success:true with a foreign hostname → false", async () => {
    stubFetch();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, hostname: "attacker.example.com" }),
      ),
    );
    expect(await verifyTurnstileToken("tok", "secret")).toBe(false);
  });

  test("success:true with no hostname field → true (mocked-fetch test doubles never set it)", async () => {
    stubFetch();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstileToken("tok", "secret")).toBe(true);
  });
});
