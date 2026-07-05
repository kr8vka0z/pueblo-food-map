/**
 * Pure helpers for per-venue structured data (JSON-LD) and URL construction.
 * Used by /venue/[id] page, layout.tsx, and homepage.
 *
 * WHY: Extracted as a pure lib (no Next.js server APIs, no React) so every
 * helper is unit-testable in jsdom without mocking server components.
 * Schema.org types chosen to match venue category semantics — pantry as
 * LocalBusiness (no specific subtype), grocery/farm as GroceryStore,
 * meal_site as FoodEstablishment, convenience as ConvenienceStore,
 * garden/edible_landscape as Place.
 */

import type { Venue } from "@/types/venue";
import { venues, categoryLabels } from "@/data/venues";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { DISPLAY_DAY_KEYS, slotToIsoTimes } from "@/lib/hours";

/** @type record maps VenueCategory → schema.org @type value */
const CATEGORY_SCHEMA_TYPE: Record<Venue["category"], string> = {
  pantry: "LocalBusiness",
  grocery: "GroceryStore",
  convenience: "ConvenienceStore",
  farm: "GroceryStore",
  garden: "Place",
  edible_landscape: "Place",
  meal_site: "FoodEstablishment",
};

/** Maps a WeeklyHours day key to its schema.org DayOfWeek IRI. */
const SCHEMA_DAY: Record<string, string> = {
  mon: "https://schema.org/Monday",
  tue: "https://schema.org/Tuesday",
  wed: "https://schema.org/Wednesday",
  thu: "https://schema.org/Thursday",
  fri: "https://schema.org/Friday",
  sat: "https://schema.org/Saturday",
  sun: "https://schema.org/Sunday",
};

/** Extract a 5-digit zip code from an address string, if present. */
function extractPostalCode(address: string): string | undefined {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : undefined;
}

/** Extract the street portion (up to the first comma) from an address. */
function extractStreetAddress(address: string): string {
  return address.split(",")[0].trim();
}

/**
 * Serialize a JSON-LD object for safe injection into a <script> tag.
 *
 * WHY: JSON.stringify does NOT escape `<`, so a `</script>` (or `<!--`) in any
 * field (e.g. a future user-suggested venue name) would break out of the
 * script element — a markup-injection/XSS vector. Escaping <, >, & to \uXXXX
 * keeps the JSON valid while making break-out impossible. Used for every
 * JSON-LD block (venue, WebSite, ItemList).
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&]/g, (c) =>
    c === "<" ? "\\u003c" : c === ">" ? "\\u003e" : "\\u0026",
  );
}

export function getVenueById(id: string): Venue | undefined {
  return venues.find((v) => v.id === id);
}

export function venuePath(id: string): string {
  return `/venue/${id}`;
}

export function buildVenueJsonLd(venue: Venue): Record<string, unknown> {
  const postalCode = extractPostalCode(venue.address);
  const address: Record<string, string> = {
    "@type": "PostalAddress",
    streetAddress: extractStreetAddress(venue.address),
    addressLocality: "Pueblo",
    addressRegion: "CO",
    addressCountry: "US",
  };
  if (postalCode) {
    address["postalCode"] = postalCode;
  }

  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": CATEGORY_SCHEMA_TYPE[venue.category],
    name: venue.name,
    description: `${categoryLabels[venue.category]} in Pueblo, CO.`,
    url: `${SITE_URL}/venue/${venue.id}`,
    address,
    geo: {
      "@type": "GeoCoordinates",
      latitude: venue.lat,
      longitude: venue.lng,
    },
  };

  // Only include telephone when a phone number is present — omit rather than null.
  if (venue.phone) {
    result["telephone"] = venue.phone;
  }

  // Only include openingHoursSpecification when hours_weekly exists and yields
  // at least one parseable slot — omit rather than an empty array, same
  // omit-when-empty convention as telephone above.
  if (venue.hours_weekly) {
    const hoursWeekly = venue.hours_weekly;
    const specs = DISPLAY_DAY_KEYS.flatMap((day) =>
      (hoursWeekly[day] ?? []).flatMap((slot) => {
        const iso = slotToIsoTimes(slot);
        return iso
          ? [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: SCHEMA_DAY[day],
                opens: iso.opens,
                closes: iso.closes,
              },
            ]
          : [];
      }),
    );
    if (specs.length > 0) {
      result["openingHoursSpecification"] = specs;
    }
  }

  return result;
}

export function buildVenueListJsonLd(
  venueList: Venue[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: venueList.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/venue/${v.id}`,
      name: v.name,
    })),
  };
}

/**
 * WHY @graph instead of a flat WebSite object: a bare WebSite node has no
 * identity separate from the page it's declared on. Wrapping WebSite +
 * Organization in one @graph, linked by publisher/@id, makes the site itself
 * a linkable schema.org Organization entity (with a sameAs back to its own
 * canonical presences) — search engines can then associate the WebSite with
 * a known, cross-referenced entity instead of an anonymous node.
 */
export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores.",
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        sameAs: ["https://pueblofoodproject.org", "https://pueblofoodmap.com"],
      },
    ],
  };
}
