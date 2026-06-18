import { describe, test, expect } from "vitest";
import { searchVenues } from "@/lib/searchVenues";
import type { Venue } from "@/types/venue";

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test-1",
    name: "Test Venue",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Main St, Pueblo, CO",
    source: "test",
    last_verified: "2026-01-01",
    accepts_snap: false,
    accepts_wic: false,
    ...overrides,
  };
}

const pantry = makeVenue({ id: "p1", name: "Eastside Pantry", category: "pantry" });
const grocery = makeVenue({
  id: "g1",
  name: "City Market",
  category: "grocery",
  accepts_snap: true,
});
const mealSite = makeVenue({ id: "m1", name: "Community Kitchen", category: "meal_site" });
const snapGrocery = makeVenue({
  id: "sg1",
  name: "SNAP Store",
  category: "grocery",
  accepts_snap: true,
});
const venues = [pantry, grocery, mealSite, snapGrocery];

describe("searchVenues", () => {
  test("empty query returns all venues unchanged", () => {
    expect(searchVenues(venues, "")).toEqual(venues);
    expect(searchVenues(venues, "   ")).toEqual(venues);
  });

  test("matches venue name (case insensitive)", () => {
    const result = searchVenues(venues, "eastside");
    expect(result.map((v) => v.id)).toEqual(["p1"]);
  });

  test("English category: pantry", () => {
    const result = searchVenues(venues, "food pantry");
    expect(result.some((v) => v.category === "pantry")).toBe(true);
  });

  test("Spanish alias: despensa matches pantry", () => {
    const result = searchVenues(venues, "despensa");
    expect(result.map((v) => v.id)).toContain("p1");
  });

  test("Spanish alias: supermercado matches grocery", () => {
    const result = searchVenues(venues, "supermercado");
    expect(result.some((v) => v.category === "grocery")).toBe(true);
  });

  test("Spanish alias: mercado matches grocery or farm", () => {
    const result = searchVenues(venues, "mercado");
    expect(result.length).toBeGreaterThan(0);
  });

  test("Spanish alias: comedor matches meal_site", () => {
    const result = searchVenues(venues, "comedor");
    expect(result.map((v) => v.id)).toContain("m1");
  });

  test("benefit alias: estampillas matches SNAP-accepting venues", () => {
    const result = searchVenues(venues, "estampillas");
    expect(result.every((v) => v.accepts_snap)).toBe(true);
    expect(result.map((v) => v.id).sort()).toEqual(["g1", "sg1"].sort());
  });

  test("benefit alias: wic matches WIC-accepting venues", () => {
    const wicVenue = makeVenue({
      id: "w1",
      name: "WIC Clinic",
      category: "grocery",
      accepts_wic: true,
    });
    const result = searchVenues([pantry, wicVenue], "wic");
    expect(result.map((v) => v.id)).toEqual(["w1"]);
  });

  test("no match returns empty array", () => {
    expect(searchVenues(venues, "zzzznotfound")).toEqual([]);
  });

  /**
   * Guardrails for live filter on each keystroke. Alias matching can flood results at one and two
   * characters, so these cases lock the contract between name search, alias gate, and benefit acronyms.
   */
  describe("short query guardrails", () => {
    test("two character input does not trigger broad category alias matching", () => {
      expect(searchVenues(venues, "su")).toEqual([]);
      expect(searchVenues(venues, "me")).toEqual([]);
    });

    test("two character input does not trigger partial benefit alias matching", () => {
      // Venue names omit SNAP so a failure here means alias noise, not place name substring matches.
      const snapOnlyVenues = [
        makeVenue({
          id: "g2",
          name: "City Market",
          category: "grocery",
          accepts_snap: true,
        }),
        pantry,
      ];
      expect(searchVenues(snapOnlyVenues, "sn")).toEqual([]);
      expect(searchVenues(snapOnlyVenues, "wi")).toEqual([]);
    });

    test("venue name substring still matches at short lengths", () => {
      const result = searchVenues(venues, "ci");
      expect(result.map((v) => v.id)).toEqual(["g1"]);
    });

    test("exact short benefit keyword snap matches SNAP venues", () => {
      const result = searchVenues(venues, "snap");
      expect(result.every((v) => v.accepts_snap)).toBe(true);
      expect(result.map((v) => v.id).sort()).toEqual(["g1", "sg1"].sort());
    });

    test("exact short benefit keyword wic matches WIC venues", () => {
      const wicVenue = makeVenue({
        id: "w1",
        name: "Family Health Center",
        category: "grocery",
        accepts_wic: true,
      });
      const result = searchVenues([pantry, wicVenue], "wic");
      expect(result.map((v) => v.id)).toEqual(["w1"]);
    });

    test("exact snap and wic queries do not cross match benefit programs", () => {
      const snapOnly = makeVenue({
        id: "s1",
        name: "Neighborhood Grocery",
        category: "grocery",
        accepts_snap: true,
        accepts_wic: false,
      });
      const wicOnly = makeVenue({
        id: "w2",
        name: "Family Health Center",
        category: "grocery",
        accepts_snap: false,
        accepts_wic: true,
      });
      const mixed = [snapOnly, wicOnly];

      expect(searchVenues(mixed, "snap").map((v) => v.id)).toEqual(["s1"]);
      expect(searchVenues(mixed, "wic").map((v) => v.id)).toEqual(["w2"]);
    });

    test("three or more characters still match bilingual category aliases", () => {
      expect(searchVenues(venues, "sup").some((v) => v.category === "grocery")).toBe(
        true,
      );
      expect(searchVenues(venues, "des").map((v) => v.id)).toContain("p1");
    });
  });
});
