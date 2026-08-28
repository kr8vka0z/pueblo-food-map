import { describe, expect, test } from "vitest";
import { haversineMiles, formatMiles } from "@/lib/distance";

describe("haversineMiles", () => {
  test("returns 0 for identical points", () => {
    const point = { lat: 38.2544, lng: -104.6091 };
    expect(haversineMiles(point, point)).toBe(0);
  });

  test("computes Pueblo → Colorado Springs at roughly 40 miles", () => {
    const pueblo = { lat: 38.2544, lng: -104.6091 };
    const coloradoSprings = { lat: 38.8339, lng: -104.8214 };
    const miles = haversineMiles(pueblo, coloradoSprings);
    expect(miles).toBeGreaterThan(38);
    expect(miles).toBeLessThan(45);
  });

  test("is symmetric — distance(a, b) === distance(b, a)", () => {
    const a = { lat: 38.2544, lng: -104.6091 };
    const b = { lat: 38.2811, lng: -104.5906 };
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 10);
  });
});

describe("formatMiles", () => {
  test("collapses sub-tenth distances to a fixed label", () => {
    expect(formatMiles(0.04)).toBe("< 0.1 mi");
  });

  test("shows one decimal under 10 miles", () => {
    expect(formatMiles(2.347)).toBe("2.3 mi");
  });

  test("rounds to whole miles at 10+", () => {
    expect(formatMiles(12.6)).toBe("13 mi");
  });
});
