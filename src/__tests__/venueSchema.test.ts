/**
 * Unit tests for src/lib/venueSchema.ts — pure schema helpers for #164 (6.3/6.4)
 * plus the structured-data enrichment PR (opening hours + Organization @graph).
 *
 * Tests are kept pure (no DOM, no Next.js server APIs) so they run in jsdom without
 * any mocking beyond this file.
 */

import { describe, test, expect } from "vitest";
import {
  getVenueById,
  venuePath,
  buildVenueJsonLd,
  buildVenueBreadcrumbJsonLd,
  buildVenueListJsonLd,
  buildWebSiteJsonLd,
  buildFaqJsonLd,
  serializeJsonLd,
} from "@/lib/venueSchema";
import { venues } from "@/data/venues";
import { SITE_URL, SITE_NAME, SITE_CONTACT_EMAIL } from "@/lib/site";
import { t } from "@/lib/i18n";
import type { Venue } from "@/types/venue";

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

  // #705 review fix: addressLocality used to be hardcoded "Pueblo" for
  // every venue (wrong for Pueblo West/Colorado City/Blende/Baxter/
  // Avondale/Vineland) — now parsed per venue (see the dedicated
  // "addressLocality" describe block below for the parsed-vs-omitted
  // cases). This generic test only checks the fields every venue always has.
  test("address has PostalAddress type with CO/US", () => {
    const ld = buildVenueJsonLd(grocery);
    const addr = ld["address"] as Record<string, unknown>;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr["addressRegion"]).toBe("CO");
    expect(addr["addressCountry"]).toBe("US");
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

  test("openingHoursSpecification present with correct shape when hours_weekly exists", () => {
    const venueWithHours = venues.find(
      (v) => v.hours_weekly && Object.keys(v.hours_weekly).length > 0,
    )!;
    const ld = buildVenueJsonLd(venueWithHours);
    const specs = ld["openingHoursSpecification"] as Array<
      Record<string, unknown>
    >;
    expect(Array.isArray(specs)).toBe(true);
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) {
      expect(spec["@type"]).toBe("OpeningHoursSpecification");
      expect(typeof spec["dayOfWeek"]).toBe("string");
      expect(spec["dayOfWeek"]).toMatch(/^https:\/\/schema\.org\/\w+day$/);
      expect(spec["opens"]).toMatch(/^\d{2}:\d{2}$/);
      expect(spec["closes"]).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  test("openingHoursSpecification absent when hours_weekly is missing", () => {
    const venueWithoutHours = venues.find((v) => !v.hours_weekly)!;
    const ld = buildVenueJsonLd(venueWithoutHours);
    expect("openingHoursSpecification" in ld).toBe(false);
  });

  // #400: schema.org's OpeningHoursSpecification has no ordinal-monthly
  // form — an irregular-only venue must never fake one (venueSchema.ts's
  // own doc comment).
  test("openingHoursSpecification absent for an irregular-only venue (no invented schema.org shape)", () => {
    const venueWithoutHours = venues.find((v) => !v.hours_weekly)!;
    const irregularOnly = {
      ...venueWithoutHours,
      hours_weekly: undefined,
      hours_irregular: [
        {
          recurrence: "monthly_ordinal" as const,
          ordinal: 4 as const,
          weekday: "tue" as const,
          slots: ["11:00-12:00"],
        },
      ],
    };
    const ld = buildVenueJsonLd(irregularOnly);
    expect("openingHoursSpecification" in ld).toBe(false);
  });

  test("openingHoursSpecification carries only the weekly specs when both weekly and irregular are present", () => {
    const venueWithHours = venues.find(
      (v) => v.hours_weekly && Object.keys(v.hours_weekly).length > 0,
    )!;
    const both = {
      ...venueWithHours,
      hours_irregular: [
        {
          recurrence: "monthly_ordinal" as const,
          ordinal: 4 as const,
          weekday: "tue" as const,
          slots: ["11:00-12:00"],
        },
      ],
    };
    const withoutIrregular = { ...venueWithHours, hours_irregular: undefined };
    expect(buildVenueJsonLd(both)["openingHoursSpecification"]).toEqual(
      buildVenueJsonLd(withoutIrregular)["openingHoursSpecification"],
    );
  });

  test("no null or undefined values in the object", () => {
    for (const venue of venues.slice(0, 10)) {
      const ld = buildVenueJsonLd(venue);
      const values = Object.values(ld);
      expect(values.every((v) => v !== null && v !== undefined)).toBe(true);
    }
  });

  test("has a non-empty description", () => {
    // WHY: description reduces GSC "missing recommended field" warnings.
    for (const venue of venues.slice(0, 5)) {
      const ld = buildVenueJsonLd(venue);
      expect(typeof ld["description"]).toBe("string");
      expect((ld["description"] as string).length).toBeGreaterThan(0);
    }
  });
});

// ─── #704 JSON-LD enrichment (SEO/AEO plan Phase 2) ────────────────────────

describe("buildVenueJsonLd — #704 enrichment", () => {
  const pantry = venues.find((v) => v.category === "pantry")!;
  const grocery = venues.find((v) => v.category === "grocery")!;
  const convenience = venues.find((v) => v.category === "convenience")!;

  test("sameAs carries the venue's own url when present and unique", () => {
    const withUrl = { ...grocery, url: "https://example.com/a-url-no-published-venue-shares" };
    const ld = buildVenueJsonLd(withUrl);
    expect(ld["sameAs"]).toEqual(["https://example.com/a-url-no-published-venue-shares"]);
  });

  test("sameAs is omitted when the venue has no url", () => {
    const withoutUrl = { ...grocery, url: undefined };
    const ld = buildVenueJsonLd(withoutUrl);
    expect("sameAs" in ld).toBe(false);
  });

  // #705 review fix: 10 published gardens/edible landscapes share ONE
  // Pueblo Food Project URL (a program page, not any one venue's own
  // identity) — sameAs on all 10 would falsely claim they're all "the same
  // entity" as each other. URL_COUNTS (venueSchema.ts) is computed once
  // from the real published venue set, so this is a structural test over
  // real data (never a pinned literal venue name/hours/phone).
  test("sameAs is omitted when the venue's url is shared by other published venues", () => {
    const urlCounts = new Map<string, number>();
    for (const v of venues) if (v.url) urlCounts.set(v.url, (urlCounts.get(v.url) ?? 0) + 1);
    const sharedUrl = [...urlCounts.entries()].find(([, count]) => count > 1);
    expect(sharedUrl, "expected at least one shared venue url in real data").toBeDefined();
    const [url] = sharedUrl!;
    const sharers = venues.filter((v) => v.url === url);
    for (const v of sharers) {
      expect("sameAs" in buildVenueJsonLd(v), v.id).toBe(false);
    }
  });

  test("sameAs is present when the venue's url is unique among published venues", () => {
    const urlCounts = new Map<string, number>();
    for (const v of venues) if (v.url) urlCounts.set(v.url, (urlCounts.get(v.url) ?? 0) + 1);
    const uniqueUrlVenue = venues.find((v) => v.url && urlCounts.get(v.url) === 1);
    expect(uniqueUrlVenue).toBeDefined();
    expect(buildVenueJsonLd(uniqueUrlVenue!)["sameAs"]).toEqual([uniqueUrlVenue!.url]);
  });

  test("isAccessibleForFree is true for a free category (pantry)", () => {
    const ld = buildVenueJsonLd(pantry);
    expect(ld["isAccessibleForFree"]).toBe(true);
  });

  test("isAccessibleForFree is omitted for a non-free category (grocery)", () => {
    const ld = buildVenueJsonLd(grocery);
    expect("isAccessibleForFree" in ld).toBe(false);
  });

  test("paymentAccepted is SNAP/EBT only when accepts_snap === true", () => {
    const confirmed = { ...convenience, accepts_snap: true as const };
    const declined = { ...convenience, accepts_snap: false as const };
    const unknown = { ...convenience, accepts_snap: undefined };
    expect(buildVenueJsonLd(confirmed)["paymentAccepted"]).toBe("SNAP/EBT");
    expect("paymentAccepted" in buildVenueJsonLd(declined)).toBe(false);
    expect("paymentAccepted" in buildVenueJsonLd(unknown)).toBe(false);
  });
});

// ─── #705 review fixes: addressLocality parsing + postal code extraction ──

describe("buildVenueJsonLd — OSM placeholder address guard (#705 review)", () => {
  const grocery = venues.find((v) => v.category === "grocery")!;

  test("omits streetAddress entirely rather than emit the literal placeholder string", () => {
    const v = { ...grocery, address: "Address not in OpenStreetMap" };
    const addr = buildVenueJsonLd(v)["address"] as Record<string, unknown>;
    expect("streetAddress" in addr).toBe(false);
  });
});

describe("buildVenueJsonLd — addressLocality (#705 review)", () => {
  const grocery = venues.find((v) => v.category === "grocery")!;

  test("uses the parsed city, not a hardcoded 'Pueblo'", () => {
    const v = { ...grocery, address: "78 North McCulloch Boulevard, Pueblo West, CO 81007" };
    const addr = buildVenueJsonLd(v)["address"] as Record<string, unknown>;
    expect(addr["addressLocality"]).toBe("Pueblo West");
  });

  test("omits addressLocality entirely when no city can be parsed — never the 'Pueblo County' fallback prose", () => {
    const v = { ...grocery, address: "Mineral Palace Park" };
    const addr = buildVenueJsonLd(v)["address"] as Record<string, unknown>;
    expect("addressLocality" in addr).toBe(false);
  });
});

describe("buildVenueJsonLd — postalCode extraction (#705 review)", () => {
  const grocery = venues.find((v) => v.category === "grocery")!;

  test("uses the zip after 'CO', not a leading 5-digit house number", () => {
    // Real-data regression (DiTomaso Farms / Musso Farms): a 5-digit house
    // number at the START of the address used to win over the real zip.
    const v = { ...grocery, address: "37137 US 50 Bus, Pueblo, CO 81006" };
    const addr = buildVenueJsonLd(v)["address"] as Record<string, unknown>;
    expect(addr["postalCode"]).toBe("81006");
  });

  test("still extracts a zip when there's no 'CO' segment at all", () => {
    const v = { ...grocery, address: "1242 South Prairie Avenue, Pueblo 81004" };
    const addr = buildVenueJsonLd(v)["address"] as Record<string, unknown>;
    expect(addr["postalCode"]).toBe("81004");
  });

  test("omits postalCode when the address has no 5-digit zip at all", () => {
    const v = { ...grocery, address: "410 Main Street, Boone" };
    const addr = buildVenueJsonLd(v)["address"] as Record<string, unknown>;
    expect("postalCode" in addr).toBe(false);
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
//
// Shipped as an @graph of WebSite + Organization (not a flat WebSite object) so
// the site itself is a linkable schema.org entity — see the Organization block
// below and its sameAs array.

describe("buildWebSiteJsonLd", () => {
  const ld = buildWebSiteJsonLd();
  const graph = ld["@graph"] as Array<Record<string, unknown>>;
  const website = graph[0];
  const organization = graph[1];

  test("@context is schema.org", () => {
    expect(ld["@context"]).toBe("https://schema.org");
  });

  test("@graph[0] is the WebSite", () => {
    expect(website["@type"]).toBe("WebSite");
  });

  test("WebSite @id is SITE_URL/#website", () => {
    expect(website["@id"]).toBe(`${SITE_URL}/#website`);
  });

  test("WebSite url is SITE_URL", () => {
    expect(website["url"]).toBe(SITE_URL);
  });

  test("WebSite name is SITE_NAME", () => {
    expect(website["name"]).toBe(SITE_NAME);
  });

  test("WebSite inLanguage is en", () => {
    expect(website["inLanguage"]).toBe("en");
  });

  test("@graph[1] is the Organization, with a sameAs array", () => {
    expect(organization["@type"]).toBe("Organization");
    expect(organization["@id"]).toBe(`${SITE_URL}/#organization`);
    expect(Array.isArray(organization["sameAs"])).toBe(true);
  });

  test("Organization carries the public contact email", () => {
    expect(organization["email"]).toBe(SITE_CONTACT_EMAIL);
    expect(SITE_CONTACT_EMAIL).toBe("hello@pueblofoodmap.com");
  });

  // SEO/AEO plan Phase 0: sameAs is "the same entity elsewhere" — never the
  // site itself, and never a different organization.
  test("sameAs lists neither the site itself nor Pueblo Food Project", () => {
    expect(organization["sameAs"]).not.toContain(SITE_URL);
    expect(organization["sameAs"]).not.toContain("https://pueblofoodproject.org");
  });

  test("Pueblo Food Project is the WebSite's sourceOrganization", () => {
    const source = website["sourceOrganization"] as Record<string, unknown>;
    expect(source["url"]).toBe("https://pueblofoodproject.org");
  });

  test("Organization has an absolute logo URL and Pueblo County as areaServed", () => {
    expect(String(organization["logo"])).toMatch(new RegExp(`^${SITE_URL}/`));
    expect((organization["areaServed"] as Record<string, unknown>)["name"]).toBe("Pueblo County, Colorado");
  });

  test("WebSite.publisher @id matches Organization @id", () => {
    const publisher = website["publisher"] as Record<string, unknown>;
    expect(publisher["@id"]).toBe(organization["@id"]);
  });
});

// ─── serializeJsonLd ──────────────────────────────────────────────────────────

describe("serializeJsonLd", () => {
  test("prevents </script> break-out — no literal </script> in output", () => {
    // WHY: If a venue name or any field contains </script>, JSON.stringify
    // would emit it verbatim, ending the <script> element early (XSS vector).
    // serializeJsonLd escapes < > & to Unicode escapes so break-out is impossible.
    const payload = { name: "</script><script>alert(1)</script>" };
    const result = serializeJsonLd(payload);
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c");
  });

  test("output round-trips through JSON.parse to the original object", () => {
    // WHY: Unicode escape sequences (< etc.) are valid JSON — parsers
    // decode them back to the original characters. Verifies no data loss.
    const original = { name: "</script><script>alert(1)</script>", count: 42 };
    const serialized = serializeJsonLd(original);
    expect(JSON.parse(serialized)).toEqual(original);
  });

  test("escapes > and & as well as <", () => {
    const result = serializeJsonLd({ a: ">", b: "&", c: "<" });
    expect(result).toContain("\\u003e");
    expect(result).toContain("\\u0026");
    expect(result).toContain("\\u003c");
  });

  test("leaves safe characters unchanged", () => {
    const safe = { name: "Pueblo Community Garden", lat: 38.27 };
    const result = serializeJsonLd(safe);
    expect(result).toContain("Pueblo Community Garden");
    expect(result).toContain("38.27");
  });
});

// ─── #689 PR 2: JSON-LD matches the URL's language ─────────────────────────
//
// Supersedes #386's "JSON-LD is always English" rule. EN assertions above
// stay unchanged (locale defaults "en"); these add the ES side.

describe("locale-aware JSON-LD (#689)", () => {
  const grocery = venues.find((v) => v.category === "grocery")!;

  test("venuePath defaults to /venue/<id>, locale es → /es/venue/<id>", () => {
    expect(venuePath("abc-123")).toBe("/venue/abc-123");
    expect(venuePath("abc-123", "es")).toBe("/es/venue/abc-123");
  });

  // Review fix (item 7): buildVenueJsonLd never emits "inLanguage" — the
  // venue node's schema.org types (LocalBusiness/GroceryStore/etc.) don't
  // define that property; the page's language is signaled by the WebSite
  // node's own inLanguage and by <html lang>/hreflang instead.
  // #704 (SEO/AEO plan Phase 2), Decisions item 2: "The summary becomes
  // `description`" — the old byte-per-category-identical literal this test
  // asserted is exactly the duplicate-content problem #704 fixes.
  test("buildVenueJsonLd(venue, 'es') uses the /es url; no inLanguage field", () => {
    const ld = buildVenueJsonLd(grocery, "es");
    expect(ld["url"]).toBe(`${SITE_URL}/es/venue/${grocery.id}`);
    expect("inLanguage" in ld).toBe(false);
  });

  // #705 review fix (item 12): pinned to a synthetic fixture's own expected
  // literal, not to buildVenueSummary's output — comparing a builder's
  // output to itself proves nothing about correctness.
  test("description is the answer-first summary (ES) — pinned to a synthetic fixture", () => {
    const fixture: Venue = {
      id: "test-fixture-garden",
      name: "Test Garden Venue",
      category: "garden",
      lat: 38.27,
      lng: -104.61,
      address: "1 Test Ave, Pueblo, CO 81003",
      source: "test",
      last_verified: "2026-06-01",
    };
    const ld = buildVenueJsonLd(fixture, "es");
    expect(ld["description"]).toBe(
      "Test Garden Venue es un huerto comunitario gratuito en 1 Test Ave, Pueblo, CO 81003. Última verificación: junio 2026.",
    );
  });

  test("buildVenueJsonLd(venue) (default) still uses the EN url; no inLanguage field", () => {
    const ld = buildVenueJsonLd(grocery);
    expect(ld["url"]).toBe(`${SITE_URL}/venue/${grocery.id}`);
    expect("inLanguage" in ld).toBe(false);
  });

  test("buildVenueListJsonLd(venues, 'es') emits /es/venue/ urls", () => {
    const ld = buildVenueListJsonLd(venues, "es");
    const items = ld["itemListElement"] as Array<Record<string, unknown>>;
    for (const item of items) {
      expect((item["url"] as string).startsWith(`${SITE_URL}/es/venue/`)).toBe(true);
    }
  });

  test("buildFaqJsonLd(items, 'es') sets inLanguage es; default stays en", () => {
    const items = [{ question: "q", answer: "a" }];
    expect(buildFaqJsonLd(items)["inLanguage"]).toBe("en");
    expect(buildFaqJsonLd(items, "es")["inLanguage"]).toBe("es");
  });

  test("buildWebSiteJsonLd('es') uses the /es site url and inLanguage es, same Organization @id", () => {
    const ldEn = buildWebSiteJsonLd();
    const ldEs = buildWebSiteJsonLd("es");
    const graphEn = ldEn["@graph"] as Array<Record<string, unknown>>;
    const graphEs = ldEs["@graph"] as Array<Record<string, unknown>>;
    expect(graphEs[0]["@id"]).toBe(`${SITE_URL}/es#website`);
    expect(graphEs[0]["url"]).toBe(`${SITE_URL}/es`);
    expect(graphEs[0]["inLanguage"]).toBe("es");
    // Organization is the same shared entity for both locales.
    expect(graphEs[1]["@id"]).toBe(graphEn[1]["@id"]);
  });

  test("buildVenueBreadcrumbJsonLd(venue, 'es') uses /es urls and the ES footer.venues label", () => {
    const crumbs = buildVenueBreadcrumbJsonLd(grocery, "es");
    const items = crumbs["itemListElement"] as Array<Record<string, unknown>>;
    expect(items.map((i) => i["item"])).toEqual([
      `${SITE_URL}/es`,
      `${SITE_URL}/es/venues`,
      `${SITE_URL}${venuePath(grocery.id, "es")}`,
    ]);
    expect(items[1]["name"]).toBe(t("footer.venues", "es"));
  });
});

// ─── buildVenueBreadcrumbJsonLd (SEO/AEO plan Phase 0) ─────────────────────────

describe("buildVenueBreadcrumbJsonLd", () => {
  const venue = venues[0];
  const crumbs = buildVenueBreadcrumbJsonLd(venue);
  const items = crumbs["itemListElement"] as Array<Record<string, unknown>>;

  test("is a BreadcrumbList", () => {
    expect(crumbs["@context"]).toBe("https://schema.org");
    expect(crumbs["@type"]).toBe("BreadcrumbList");
  });

  test("home › /venues › the venue, in order, with absolute URLs", () => {
    expect(items.map((i) => i["position"])).toEqual([1, 2, 3]);
    expect(items.map((i) => i["item"])).toEqual([
      SITE_URL,
      `${SITE_URL}/venues`,
      `${SITE_URL}${venuePath(venue.id)}`,
    ]);
    expect(items[0]["name"]).toBe(SITE_NAME);
    expect(items[2]["name"]).toBe(venue.name);
  });

  test("the middle crumb's name matches the visible breadcrumb link (EN)", () => {
    expect(items[1]["name"]).toBe(t("footer.venues", "en"));
  });

  test("serializes safely (a </script> in a name can't break out)", () => {
    const hostile = { ...venue, name: "Evil </script><script>alert(1)</script>" };
    expect(serializeJsonLd(buildVenueBreadcrumbJsonLd(hostile))).not.toContain("</script>");
  });
});

