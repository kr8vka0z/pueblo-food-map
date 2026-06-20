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
import { venues } from "@/data/venues";
import { SITE_URL, SITE_NAME } from "@/lib/site";

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

/** Extract a 5-digit zip code from an address string, if present. */
function extractPostalCode(address: string): string | undefined {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : undefined;
}

/** Extract the street portion (up to the first comma) from an address. */
function extractStreetAddress(address: string): string {
  return address.split(",")[0].trim();
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
  };
  if (postalCode) {
    address["postalCode"] = postalCode;
  }

  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": CATEGORY_SCHEMA_TYPE[venue.category],
    name: venue.name,
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

export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores.",
    inLanguage: "en",
  };
}
