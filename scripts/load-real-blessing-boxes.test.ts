/**
 * The two helpers in load-real-blessing-boxes.ts that decide what a resident
 * actually READS on a box card — its name and its address. Everything else in
 * that script (geocoding, bbox filtering, SQL assembly) either talks to a live
 * service or is mechanical string joining; these two are the judgment calls,
 * and both already got them wrong once on the first generated pass:
 *
 *   - the name used an em dash while the one box already live on the map
 *     (216 W Routt, via migrations/0006) uses a plain hyphen, so the 28 would
 *     have shown up as two different naming schemes in one list;
 *   - the address was taken straight from the Census geocoder, which answers
 *     in SHOUTING CASE — correct as a match receipt, wrong as display text
 *     next to every other normally-cased venue on the map.
 *
 * This file exists because the same script is meant to run again later against
 * PRODUCTION, where neither mistake is a quick fix.
 */

import { describe, expect, test } from "vitest";
import { boxName, displayAddress, type GeocodedBox } from "./load-real-blessing-boxes";

function box(overrides: Partial<GeocodedBox> = {}): GeocodedBox {
  return {
    order: 1,
    streetAddress: "573 S Rogers Dr",
    cityStateZip: "Pueblo, CO",
    fullQuery: "573 S Rogers Dr, Pueblo, CO",
    lat: 38.313582,
    lng: -104.730715,
    matchedAddress: "573 S ROGERS DR, PUEBLO, CO, 81007",
    inBbox: true,
    ok: true,
    ...overrides,
  };
}

describe("displayAddress", () => {
  test("re-cases the geocoder's shouting answer into normal display text", () => {
    expect(displayAddress(box())).toBe("573 S Rogers Dr, Pueblo, CO 81007");
  });

  test("keeps a two-word city readable", () => {
    expect(
      displayAddress(
        box({
          streetAddress: "1099 S McCulloch Blvd",
          matchedAddress: "1099 S MCCULLOCH BLVD, PUEBLO WEST, CO, 81007",
        }),
      ),
    ).toBe("1099 S McCulloch Blvd, Pueblo West, CO 81007");
  });

  test("takes the street from Kyle's list, never from the geocoder", () => {
    // The whole reason the street is not case-repaired: title-casing
    // "1587 36TH LN" yields "1587 36Th Ln", and "302 US HWY 50 BUS" yields
    // "Us Hwy". Kyle typed these correctly; the geocoder's copy is only used
    // for the city/state/ZIP it adds.
    expect(
      displayAddress(
        box({
          streetAddress: "1587 36th Ln",
          matchedAddress: "1587 36TH LN, PUEBLO, CO, 81006",
        }),
      ),
    ).toBe("1587 36th Ln, Pueblo, CO 81006");
  });

  test("falls back to the original query when the geocoder returned nothing", () => {
    const unmatched = box({ matchedAddress: null, fullQuery: "somewhere, Pueblo, CO" });
    expect(displayAddress(unmatched)).toBe("somewhere, Pueblo, CO");
  });
});

describe("boxName", () => {
  test("matches the live 216 W Routt box's hyphen, not an em dash", () => {
    const name = boxName(box());
    expect(name).toBe("Blessing Box - 573 S Rogers Dr");
    expect(name).not.toContain("—");
  });

  test("an entry that carries its own name keeps it verbatim", () => {
    expect(
      boxName(box({ name: "Pueblo First Seventh-Day Adventist Church" })),
    ).toBe("Pueblo First Seventh-Day Adventist Church");
  });
});
