/**
 * Batching regression test for loadApprovedAdopterNamesForVenues (#568 item
 * 7) — new file because src/lib/boxAdopters.test.ts is an existing test
 * file (write-guarded on fix/* branches); this covers ONLY the new
 * >100-id chunking behavior, not the rest of the module (see that file for
 * everything else, including the un-chunked <=100-id shape this preserves).
 */

import { describe, expect, test } from "vitest";
import { loadApprovedAdopterNamesForVenues } from "@/lib/boxAdopters";
import { D1_MAX_BOUND_PARAMS } from "@/lib/d1";

describe("loadApprovedAdopterNamesForVenues — D1 100-bound-param batching", () => {
  test("more than 100 venue ids issues more than one batched query, never one oversized IN(...)", async () => {
    const venueIds = Array.from({ length: D1_MAX_BOUND_PARAMS + 5 }, (_, i) => `box-${i}`);
    const boundArgsPerCall: unknown[][] = [];
    const db = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgsPerCall.push(args);
          return { all: async () => ({ results: [] }) };
        },
      }),
    } as unknown as D1Database;

    await loadApprovedAdopterNamesForVenues(db, venueIds);

    // Without the #568 fix this is exactly 1 call bound with all 105 ids —
    // D1 throws "too many SQL variables" past 100 in the real API.
    expect(boundArgsPerCall.length).toBe(2);
    expect(boundArgsPerCall[0].length).toBe(D1_MAX_BOUND_PARAMS);
    expect(boundArgsPerCall[1].length).toBe(5);
  });

  test("results from every batch land in the same returned map", async () => {
    const venueIds = Array.from({ length: D1_MAX_BOUND_PARAMS + 1 }, (_, i) => `box-${i}`);
    let call = 0;
    const db = {
      prepare: () => ({
        bind: () => {
          call += 1;
          const venueId = call === 1 ? "box-0" : `box-${D1_MAX_BOUND_PARAMS}`;
          return { all: async () => ({ results: [{ venue_id: venueId, display_name: "Someone" }] }) };
        },
      }),
    } as unknown as D1Database;

    const map = await loadApprovedAdopterNamesForVenues(db, venueIds);

    expect(map.get("box-0")).toEqual(["Someone"]);
    expect(map.get(`box-${D1_MAX_BOUND_PARAMS}`)).toEqual(["Someone"]);
  });
});
