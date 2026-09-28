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
import { DISPLAY_DAY_KEYS, slotToIsoTimes } from "@/lib/hours";
import { t, type Locale } from "@/lib/i18n";

/** "in Pueblo, CO." / "en Pueblo, CO." — boilerplate, not a [CHECK] copy key. */
const IN_PUEBLO_CO: Record<Locale, string> = {
  en: "in Pueblo, CO.",
  es: "en Pueblo, CO.",
};

/**
 * @type record maps VenueCategory → schema.org @type value.
 *
 * blessing_box is never actually routed through buildVenueJsonLd — boxes are
 * excluded from the published snapshot venues.ts reads (Build Plan
 * architecture call #1) and get their own JSON-LD builder on /box/[id]
 * instead. This entry exists purely so the Record type stays exhaustive over
 * VenueCategory; "Place" is the same fallback garden/edible_landscape use.
 */
const CATEGORY_SCHEMA_TYPE: Record<Venue["category"], string> = {
  pantry: "LocalBusiness",
  grocery: "GroceryStore",
  convenience: "ConvenienceStore",
  farm: "GroceryStore",
  garden: "Place",
  edible_landscape: "Place",
  meal_site: "FoodEstablishment",
  blessing_box: "Place",
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
 * BreadcrumbList for a venue page (SEO/AEO plan Phase 0): Pueblo Food Map ›
 * All places › {venue}. It mirrors the visible breadcrumb VenueContent
 * renders, which is what makes it eligible for Google's breadcrumb display.
 *
 * #689 PR 2: `locale` defaults "en" so every existing call site (venue
 * page, unchanged) is byte-identical. The "JSON-LD is always English" rule
 * (#386) is now "JSON-LD matches the URL's language" (ARCHITECTURE.md) — an
 * ES caller passes locale: "es" and gets /es URLs + t(key, "es") labels. The
 * middle crumb still reads the SAME key ("footer.venues") the visible
 * breadcrumb link renders for that locale, so the two can't drift.
 */
export function buildVenueBreadcrumbJsonLd(
  venue: Venue,
  locale: Locale = "en",
): Record<string, unknown> {
  const siteUrl = locale === "es" ? `${SITE_URL}/es` : SITE_URL;
  const crumbs = [
    { name: SITE_NAME, url: siteUrl },
    // Same key the visible breadcrumb link renders, so the two can't drift.
    { name: t("footer.venues", locale), url: `${siteUrl}/venues` },
    { name: venue.name, url: `${SITE_URL}${venuePath(venue.id, locale)}` },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
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

/**
 * #689 PR 2: `locale` defaults "en" — every existing call site (venue page,
 * unchanged) still gets `/venue/<id>`. English slugs mirror 1:1 under /es
 * (design decision 1), so this is a plain prefix, not a translation table.
 */
export function venuePath(id: string, locale: Locale = "en"): string {
  return locale === "es" ? `/es/venue/${id}` : `/venue/${id}`;
}

export function buildVenueJsonLd(
  venue: Venue,
  locale: Locale = "en",
): Record<string, unknown> {
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
    description: `${t(`category.full.${venue.category}`, locale)} ${IN_PUEBLO_CO[locale]}`,
    url: `${SITE_URL}${venuePath(venue.id, locale)}`,
    inLanguage: locale,
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
  //
  // #400: venue.hours_irregular (monthly-ordinal etc. schedules) is
  // DELIBERATELY never read here. schema.org's OpeningHoursSpecification has
  // no ordinal-monthly form (no "4th Tuesday of the month" construct) —
  // inventing one (e.g. abusing validFrom/validThrough to fake a recurring
  // monthly window) would emit non-standard structured data search engines
  // either ignore or mis-parse, worse than omitting it. An irregular-only
  // venue's JSON-LD simply has no openingHoursSpecification at all, same as
  // any other venue with no computable weekly schedule.
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
  locale: Locale = "en",
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: venueList.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}${venuePath(v.id, locale)}`,
      name: v.name,
    })),
  };
}

/**
 * Build schema.org FAQPage JSON-LD from resolved question/answer pairs.
 *
 * WHY it takes plain strings (not i18n keys): the /about page resolves each
 * Q&A through t() for the request's locale and passes them in, so the
 * structured data always matches the FAQ actually rendered on the page.
 *
 * `locale` (#689 PR 2, defaults "en") only sets `inLanguage` — the caller
 * already resolved question/answer text for that locale, so this stays a
 * one-line addition, not a second i18n dependency.
 */
export function buildFaqJsonLd(
  items: { question: string; answer: string }[],
  locale: Locale = "en",
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * WHY @graph instead of a flat WebSite object: a bare WebSite node has no
 * identity separate from the page it's declared on. Wrapping WebSite +
 * Organization in one @graph, linked by publisher/@id, makes the site itself
 * a linkable schema.org Organization entity — search engines can then
 * associate the WebSite with a known, cross-referenced entity instead of an
 * anonymous node.
 *
 * SEO/AEO plan Phase 0 fixed the Organization's links:
 * - `sameAs` means "this same entity elsewhere". It used to list
 *   pueblofoodmap.com (itself, a no-op) and pueblofoodproject.org (a different
 *   organization). It now lists only the project's own public repo.
 * - Pueblo Food Project is the WebSite's `sourceOrganization`, schema.org's
 *   "on whose behalf the creator was working" (README: "Built for and with
 *   Pueblo Food Project").
 * - `logo` and `areaServed` give answer engines the brand mark and the region.
 *
 * #689 PR 2: `locale` (defaults "en") gives the /es tree its own WebSite
 * node — `@id`/`url` under /es, `inLanguage: "es"` — while the Organization
 * node underneath stays the single shared entity (same @id both locales,
 * `publisher` still points at it), since it's the same organization either
 * way, not a second one.
 */
export function buildWebSiteJsonLd(locale: Locale = "en"): Record<string, unknown> {
  const siteUrl = locale === "es" ? `${SITE_URL}/es` : SITE_URL;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": locale === "es" ? `${siteUrl}#website` : `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
        description: t("jsonld.website.description", locale),
        inLanguage: locale,
        publisher: { "@id": `${SITE_URL}/#organization` },
        sourceOrganization: {
          "@type": "Organization",
          name: "Pueblo Food Project",
          url: "https://pueblofoodproject.org",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        areaServed: {
          "@type": "AdministrativeArea",
          name: "Pueblo County, Colorado",
        },
        sameAs: ["https://github.com/kr8vka0z/pueblo-food-map"],
      },
    ],
  };
}
