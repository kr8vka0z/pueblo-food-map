/**
 * buildLocationPermission — the four location_permission results (#738).
 * Kept apart from posthogQuery.test.ts so the original two-result cases there
 * stay untouched; both files cover the same mapper.
 */

import { describe, test, expect } from "vitest";
import { buildLocationPermission } from "@/lib/posthogQuery";

describe("buildLocationPermission — timeout and unavailable", () => {
  test("counts all four results and ignores unknown ones", () => {
    expect(
      buildLocationPermission([["granted", 7], ["denied", 2], ["timeout", 6], ["unavailable", 3], ["prompt", 100]]),
    ).toEqual({ granted: 7, denied: 2, timeout: 6, unavailable: 3 });
  });

  test("no rows -> all zero", () => {
    expect(buildLocationPermission([])).toEqual({ granted: 0, denied: 0, timeout: 0, unavailable: 0 });
  });
});
