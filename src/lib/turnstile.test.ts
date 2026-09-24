/**
 * verifyTurnstileToken — unit tests for the shared siteverify call.
 *
 * WHY here rather than per route: the three public submit routes' old test
 * files carried these cases (empty token, siteverify network error, success
 * → proceed) and were retired with the in-memory rate limiter (#587). The
 * behaviour lives in this one function, so it's tested once, here.
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

describe("verifyTurnstileToken", () => {
  test.each([null, undefined, ""])("token %j → false without calling siteverify", async (token) => {
    stubFetch();
    expect(await verifyTurnstileToken(token, "secret")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("siteverify success:true → true, sends secret, response and remoteip", async () => {
    stubFetch();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstileToken("tok", "secret", "1.2.3.4")).toBe(true);
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  test("siteverify success:false → false", async () => {
    stubFetch();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false })));
    expect(await verifyTurnstileToken("tok", "secret")).toBe(false);
  });

  test("siteverify non-2xx → false", async () => {
    stubFetch();
    fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
    expect(await verifyTurnstileToken("tok", "secret")).toBe(false);
  });

  test("siteverify network error → false, never throws", async () => {
    stubFetch();
    fetchMock.mockRejectedValue(new TypeError("network down"));
    expect(await verifyTurnstileToken("tok", "secret")).toBe(false);
  });
});
