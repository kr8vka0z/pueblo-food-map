/**
 * src/lib/indexingHost.ts — only pueblofoodmap.com may be indexed (SEO/AEO
 * plan Phase 0). custom-worker.ts applies this to every page response; the
 * canonical-host case must stay a no-op, or production deindexes itself.
 */

import { describe, test, expect } from "vitest";
import {
  CANONICAL_HOSTNAME,
  NOINDEX_HEADER_VALUE,
  isIndexableHostname,
  applyHostIndexingPolicy,
} from "@/lib/indexingHost";

describe("isIndexableHostname", () => {
  test("the canonical hostname is pueblofoodmap.com", () => {
    expect(CANONICAL_HOSTNAME).toBe("pueblofoodmap.com");
  });

  test("the canonical host is indexable, case-insensitively", () => {
    expect(isIndexableHostname("pueblofoodmap.com")).toBe(true);
    expect(isIndexableHostname("PuebloFoodMap.com")).toBe(true);
  });

  test.each([
    "dev.pueblofoodmap.com",
    "www.pueblofoodmap.com",
    "pueblo-food-map.kyle-boyd.workers.dev",
    "pueblo-food-map-staging.kyle-boyd.workers.dev",
    "localhost",
    "127.0.0.1",
    "pueblofoodmap.com.evil.example",
  ])("%s is not indexable", (hostname) => {
    expect(isIndexableHostname(hostname)).toBe(false);
  });
});

describe("applyHostIndexingPolicy", () => {
  test("returns the canonical host's response untouched (same object, no header)", () => {
    const response = new Response("ok", { headers: { "content-type": "text/html" } });
    const result = applyHostIndexingPolicy(response, "pueblofoodmap.com");
    expect(result).toBe(response);
    expect(result.headers.get("X-Robots-Tag")).toBeNull();
  });

  test("tags any other host with X-Robots-Tag: noindex, nofollow", () => {
    const response = new Response("ok", { headers: { "content-type": "text/html" } });
    const result = applyHostIndexingPolicy(response, "dev.pueblofoodmap.com");
    expect(result.headers.get("X-Robots-Tag")).toBe(NOINDEX_HEADER_VALUE);
    expect(NOINDEX_HEADER_VALUE).toBe("noindex, nofollow");
  });

  test("keeps status, other headers and body when tagging", async () => {
    const response = new Response("not here", {
      status: 404,
      headers: { "content-type": "text/html", "cache-control": "s-maxage=60" },
    });
    const result = applyHostIndexingPolicy(response, "pueblo-food-map.kyle-boyd.workers.dev");
    expect(result.status).toBe(404);
    expect(result.headers.get("content-type")).toBe("text/html");
    expect(result.headers.get("cache-control")).toBe("s-maxage=60");
    expect(await result.text()).toBe("not here");
  });

  test("works on a response whose headers are immutable", () => {
    const response = Response.redirect("https://pueblofoodmap.com/", 302);
    expect(() => response.headers.set("x-test", "1")).toThrow();
    const result = applyHostIndexingPolicy(response, "dev.pueblofoodmap.com");
    expect(result.headers.get("X-Robots-Tag")).toBe(NOINDEX_HEADER_VALUE);
    expect(result.status).toBe(302);
  });
});
