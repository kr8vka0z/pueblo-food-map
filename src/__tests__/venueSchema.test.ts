/**
 * Unit tests for src/lib/venueSchema.ts — pure schema helpers for #164 (6.3/6.4).
 *
 * Tests are kept pure (no DOM, no Next.js server APIs) so they run in jsdom without
 * any mocking beyond this file.
 */

import { describe, test, expect } from "vitest";
import {
  getVenueById,
  venuePath,
  buildVenueJsonLd,
  buildVenueListJsonLd,
  buildWebSiteJsonLd,
} from "@/lib/venueSchema";
import { venues } from "@/data/venues";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// ─── getVenueById ─────────────────────────────────────────────────────────────

describe("getVenueById", () => {
  test("returns the correct venue for a known id", () => {
    const first = venues[0];
    const result = getVenueById(first.id);
    expect(result).toBeDefined();
    expect(result?.id).toBe(first.id);
    expect(result?.name).toBe(first.name);
  });

  test("returns undefined for an unknown id", () => {
    expect(getVenueById("__definitely_not_a_real_venue__")).toBeUndefined();
  });
});

// ─── venuePath ────────────────────────────────────────────────────────────────

describe("venuePath", () => {
  test("returns /venue/<id>", () => {
    expect(venuePath("abc-123")).toBe("/venue/abc-123");
  });
});

// ─── buildVenueJsonLd ─────────────────────────────────────────────────────────

describe("buildVenueJsonLd", () => {
  const grocery = venues.find((v) => v.category === "grocery")!;
  const pantry = venues.find((v) => v.category === "pantry")!;
  const mealSite = venues.find((v) => v.category === "meal_site")!;
  const garden = venues.find((v) => v.category === "garden")!;

  test("@context is schema.org", () => {
    const ld = buildVenueJsonLd(grocery);
    expect(ld["@context"]).toBe("https://schema.org");
  });

  test("grocery → @type GroceryStore", () => {
    const ld = buildVenueJsonLd(grocery);
    expect(ld["@type"]).toBe("GroceryStore");
  });

  test("pantry → @type LocalBusiness", () => {
    const ld = buildVenueJsonLd(pantry);
    expect(ld["@type"]).toBe("LocalBusiness");
  });

  test("meal_site → @type FoodEstablishment", () => {
    const ld = buildVenueJsonLd(mealSite);
    expect(ld["@type"]).toBe("FoodEstablishment");
  });

  test("garden → @type Place", () => {
    const ld = buildVenueJsonLd(garden);
    expect(ld["@type"]).toBe("Place");
  });

  test("has correct name", () => {
    const ld = buildVenueJsonLd(grocery);
    expect(ld["name"]).toBe(grocery.name);
  });

  test("url is SITE_URL/venue/<id>", () => {
    const ld = buildVenueJsonLd(grocery);
    expect(ld["url"]).toBe(`${SITE_URL}/venue/${grocery.id}`);
  });

  test("geo has latitude and longitude", () => {
    const ld = buildVenueJsonLd(grocery);
    const geo = ld["geo"] as Record<string, unknown>;
    expect(geo["@type"]).toBe("GeoCoordinates");
    expect(geo["latitude"]).toBe(grocery.lat);
    expect(geo["longitude"]).toBe(grocery.lng);
  });

  test("address has PostalAddress type with Pueblo/CO", () => {
    const ld = buildVenueJsonLd(grocery);
    const addr = ld["address"] as Record<string, unknown>;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr["addressLocality"]).toBe("Pueblo");
    expect(addr["addressRegion"]).toBe("CO");
  });

  test("telephone present when phone exists", () => {
    const venueWithPhone = venues.find((v) => v.phone);
    if (!venueWithPhone) return; // skip if no phones in test data
    const ld = buildVenueJsonLd(venueWithPhone);
    expect(ld["telephone"]).toBe(venueWithPhone.phone);
  });

  test("telephone absent when phone is missing", () => {
    const venueWithoutPhone = venues.find((v) => !v.phone)!;
    const ld = buildVenueJsonLd(venueWithoutPhone);
    expect("telephone" in ld).toBe(false);
  });

  test("no null or undefined values in the object", () => {
    for (const venue of venues.slice(0, 10)) {
      const ld = buildVenueJsonLd(venue);
      const values = Object.values(ld);
      expect(values.every((v) => v !== null && v !== undefined)).toBe(true);
    }
  });
});

// ─── buildVenueListJsonLd ─────────────────────────────────────────────────────

describe("buildVenueListJsonLd", () => {
  const ld = buildVenueListJsonLd(venues);

  test("@context is schema.org", () => {
    expect(ld["@context"]).toBe("https://schema.org");
  });

  test("@type is ItemList", () => {
    expect(ld["@type"]).toBe("ItemList");
  });

  test("itemListElement has same length as input", () => {
    const items = ld["itemListElement"] as Array<Record<string, unknown>>;
    expect(items.length).toBe(venues.length);
  });

  test("each item has @type ListItem, position, url, name", () => {
    const items = ld["itemListElement"] as Array<Record<string, unknown>>;
    for (const [i, item] of items.entries()) {
      expect(item["@type"]).toBe("ListItem");
      expect(item["position"]).toBe(i + 1);
      expect(typeof item["url"]).toBe("string");
      expect((item["url"] as string).startsWith(SITE_URL)).toBe(true);
      expect(typeof item["name"]).toBe("string");
    }
  });

  test("each item url includes /venue/", () => {
    const items2 = ld["itemListElement"] as Array<Record<string, unknown>>;
    for (const item of items2) {
      expect((item["url"] as string).includes("/venue/")).toBe(true);
    }
  });
});

// ─── buildWebSiteJsonLd ───────────────────────────────────────────────────────

describe("buildWebSiteJsonLd", () => {
  const ld = buildWebSiteJsonLd();

  test("@context is schema.org", () => {
    expect(ld["@context"]).toBe("https://schema.org");
  });

  test("@type is WebSite", () => {
    expect(ld["@type"]).toBe("WebSite");
  });

  test("url is SITE_URL", () => {
    expect(ld["url"]).toBe(SITE_URL);
  });

  test("name is SITE_NAME", () => {
    expect(ld["name"]).toBe(SITE_NAME);
  });

  test("inLanguage is en", () => {
    expect(ld["inLanguage"]).toBe("en");
  });
});
