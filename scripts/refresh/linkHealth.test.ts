// @vitest-environment node
import { describe, test, expect, vi } from "vitest";
import { classifyLinkCheck, checkUrl } from "./linkHealth";

describe("classifyLinkCheck", () => {
  test("404 and 410 are dead", () => {
    expect(classifyLinkCheck({ kind: "status", status: 404 })).toEqual({ classification: "dead", httpStatus: 404 });
    expect(classifyLinkCheck({ kind: "status", status: 410 })).toEqual({ classification: "dead", httpStatus: 410 });
  });

  test("403 (bot-block false-positive risk) is ignored, not dead", () => {
    expect(classifyLinkCheck({ kind: "status", status: 403 }).classification).toBe("ignore");
  });

  test("429 (rate-limited) is ignored", () => {
    expect(classifyLinkCheck({ kind: "status", status: 429 }).classification).toBe("ignore");
  });

  test("every 5xx is ignored — the target site's bad moment, not this venue's fault", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classifyLinkCheck({ kind: "status", status }).classification).toBe("ignore");
    }
  });

  test("200 is ignored", () => {
    expect(classifyLinkCheck({ kind: "status", status: 200 }).classification).toBe("ignore");
  });

  test("timeout and network error are both ignored, never proposed", () => {
    expect(classifyLinkCheck({ kind: "timeout" }).classification).toBe("ignore");
    expect(classifyLinkCheck({ kind: "network_error", message: "ECONNRESET" }).classification).toBe("ignore");
  });
});

describe("checkUrl", () => {
  test("classifies a real 404 response as dead", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const outcome = await checkUrl("https://example.com/gone", { fetchImpl });
    expect(outcome).toEqual({ classification: "dead", httpStatus: 404 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/gone",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  test("falls back to GET when HEAD is rejected with 405", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const outcome = await checkUrl("https://example.com/head-blocked", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://example.com/head-blocked", expect.objectContaining({ method: "GET" }));
    expect(outcome.classification).toBe("ignore");
  });

  test("a thrown network error classifies as ignore, not dead", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    const outcome = await checkUrl("https://example.com/dns-fail", { fetchImpl });
    expect(outcome.classification).toBe("ignore");
  });
});
