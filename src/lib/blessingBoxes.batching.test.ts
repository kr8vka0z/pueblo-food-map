/**
 * Batching regression test for loadVisibleCheckinsForVenues: past 100 live
 * boxes an unchunked IN(...) makes D1 throw, and this read has no try/catch,
 * so the public box list would 500 and every pin would vanish.
 */

import { describe, expect, test } from "vitest";
import { loadVisibleCheckinsForVenues } from "@/lib/blessingBoxes";
import { D1_MAX_BOUND_PARAMS } from "@/lib/d1";

describe("loadVisibleCheckinsForVenues — D1 100-bound-param batching", () => {
  test("more than 100 venue ids are split into batches and merged into one map", async () => {
    const venueIds = Array.from({ length: D1_MAX_BOUND_PARAMS + 5 }, (_, i) => `box-${i}`);
    const boundArgsPerCall: string[][] = [];
    const db = {
      prepare: () => ({
        bind: (...args: string[]) => {
          boundArgsPerCall.push(args);
          return {
            all: async () => ({
              results: [{ venue_id: args[0], kind: "filled", visibility: "visible", created_at: "2026-11-01T00:00:00.000Z" }],
            }),
          };
        },
      }),
    } as unknown as D1Database;

    const map = await loadVisibleCheckinsForVenues(db, venueIds);

    expect(boundArgsPerCall.map((a) => a.length)).toEqual([D1_MAX_BOUND_PARAMS, 5]);
    expect(map.get("box-0")).toHaveLength(1);
    expect(map.get(`box-${D1_MAX_BOUND_PARAMS}`)).toHaveLength(1);
  });
});
