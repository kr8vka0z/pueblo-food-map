/**
 * Regression guard for the 2026-08-24 to 2026-09-02 production outage:
 * every /venue/[id] and /report/[venueId] page 404'd because
 * open-next.config.ts used OpenNext's default "dummy" incremental cache
 * while those routes were statically generated with `dynamicParams =
 * false` (PR #351). A "dummy" cache never persists prerendered HTML, so a
 * cache miss on a static + dynamicParams=false route throws
 * NoFallbackError and renders not-found.tsx — see AGENTS.md's "Per-venue
 * pages" section and the WHY comment in open-next.config.ts for the full
 * trace. No test in this repo had ever exercised the OpenNext/workerd
 * runtime, so nothing caught the regression for 10 days across 19 deploys.
 *
 * WHY this greps for the export instead of hardcoding a route list: new
 * static dynamic routes will keep appearing, and this test must keep
 * catching the pairing without needing an edit every time one is added.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import openNextConfig from "../../open-next.config";

function findStaticDynamicRoutePages(dir: string): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      hits.push(...findStaticDynamicRoutePages(full));
    } else if (entry === "page.tsx" || entry === "page.ts") {
      const source = readFileSync(full, "utf8");
      if (/export const dynamicParams\s*=\s*false/.test(source)) {
        hits.push(full);
      }
    }
  }
  return hits;
}

describe("open-next.config incremental cache vs. static dynamic routes", () => {
  test("no dynamicParams=false page.tsx exists while the incremental cache is the dummy default", () => {
    const staticDynamicRoutes = findStaticDynamicRoutePages(join(process.cwd(), "src/app"));
    expect(staticDynamicRoutes.length).toBeGreaterThan(0); // sanity: prove the grep still finds /venue/[id] + /report/[venueId]

    // @opennextjs/cloudflare's resolveIncrementalCache() (config.js) always
    // normalizes `incrementalCache` to one of two runtime shapes: the
    // literal string "dummy" (nothing configured), or a zero-arg function
    // wrapping a real cache implementation object. Cast through `any` here
    // rather than fight the library's deep override generics in a test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolved = (openNextConfig as any).default.override.incrementalCache;
    const cacheName = typeof resolved === "string" ? resolved : resolved().name;

    expect(cacheName).not.toBe("dummy");
  });
});
