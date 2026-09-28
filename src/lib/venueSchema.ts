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
import {
  buildVenueMetaDescription,
  buildVenueSummary,
  buildVenueTitle,
  parseVenueCityCore,
  FREE_CATEGORIES,
  PLACEHOLDER_ADDRESS,
} from "@/lib/venueSummary";

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

/**
 * Extract a 5-digit zip code from an address string, if present.
 *
 * WHY the LAST match, not the first: review fix (#705) — a house number can
 * itself be 5 digits ("37137 US 50 Bus, Pueblo, CO 81006" was extracting
 * "37137", the house number, as the postal code). A street address's own
 * zip, when present, is always the LAST 5-digit group in the string (it
 * comes after the city/state); a leading 5-digit house number never does.
 */
function extractPostalCode(address: string): string | undefined {
  const matches = [...address.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : undefined;
}

/**
 * Count of published venues sharing each `url` — computed once at module
 * load. Used by buildVenueJsonLd to decide whether `sameAs` (schema.org's
 * "this same entity elsewhere") is safe to emit: 10 gardens/edible
 * landscapes share ONE Pueblo Food Project URL
 * (https://pueblofoodproject.org/gardens/), which is a page ABOUT the
 * gardens program, not any one garden's own identity — sameAs on all 10
 * would tell a search engine 10 different entities are "the same page",
 * which is false. A url a single venue uses is a legitimate sameAs.
 */
const URL_COUNTS: Map<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const v of venues) {
    if (v.url) counts.set(v.url, (counts.get(v.url) ?? 0) + 1);
  }
  return counts;
})();

/** Extract the street portion (up to the first comma) from an address. */
function extractStreetAddress(address: string): string {
  return address.split(",")[0].trim();
}

/**
 * BreadcrumbList for a venue page (SEO/AEO plan Phase 0): Pueblo Food Map ›
 * All places › {venue}. It mirrors the visible breadcrumb VenueContent
 * renders, which is what makes it eligible for Google's breadcrumb display.
 *
 * #689 PR 2: `locale` defaults "en" — this function's own output for the
 * existing EN call site is unaffected by the default (SITE_URL, plain
 * `/venue/<id>`, `t(key, "en")` labels — same values the old hardcoded
 * "en" produced). The "JSON-LD is always English" rule (#386) is now
 * "JSON-LD matches the URL's language" (ARCHITECTURE.md) — an ES caller
 * passes locale: "es" and gets /es URLs + t(key, "es") labels. The middle
 * crumb still reads the SAME key ("footer.venues") the visible breadcrumb
 * link renders for that locale, so the two can't drift.
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

/**
 * The title/description/path a venue page's `generateMetadata` needs, for
 * either tree. Extracted (#689 PR 2, advisor decision) so
 * src/app/(site)/venue/[id]/page.tsx and src/app/es/venue/[id]/page.tsx both
 * stay thin wrappers around ONE title/description pair instead of
 * duplicating the template.
 *
 * #704 (SEO/AEO plan Phase 2) replaced the old byte-for-category-identical
 * "${name} — ${category} in Pueblo, CO. ${address}." template with two
 * length-budgeted, answer-first builders from src/lib/venueSummary.ts:
 * `title` now carries the search intent term ("{Name} – {category phrase}
 * in {City}, CO", ≤ 70 chars rendered with the brand suffix), and
 * `description` is the same verified-fact summary sentence(s) JSON-LD's
 * `description` uses (buildVenueJsonLd below), cut at a sentence boundary
 * to stay ≤ 160 chars — never a separate, drifting description string.
 */
export function venuePageMetadataFields(
  venue: Venue,
  locale: Locale = "en",
): { title: string; description: string; path: string } {
  return {
    title: buildVenueTitle(venue, locale),
    description: buildVenueMetaDescription(venue, locale),
    path: venuePath(venue.id, locale),
  };
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

/**
 * #689 PR 2: `locale` defaults "en" and, once it does, this function's EN
 * output is byte-identical to before #689 (review fix, item 7) — no
 * `inLanguage` field here: schema.org doesn't define `inLanguage` on
 * LocalBusiness/GroceryStore/ConvenienceStore/FoodEstablishment/Place (the
 * types this venue node actually uses, CATEGORY_SCHEMA_TYPE above), only on
 * CreativeWork-derived types. The page's language is already signaled by
 * the WebSite node's own `inLanguage` (buildWebSiteJsonLd, RootShell) and
 * by the page's `<html lang>` / hreflang — inventing a non-standard
 * property here would be exactly the kind of made-up schema.org shape this
 * file's own openingHoursSpecification comment warns against.
 */
export function buildVenueJsonLd(
  venue: Venue,
  locale: Locale = "en",
): Record<string, unknown> {
  const postalCode = extractPostalCode(venue.address);
  const address: Record<string, string> = {
    "@type": "PostalAddress",
    addressRegion: "CO",
    addressCountry: "US",
  };
  // #705 review fix (same guard as buildVenueSummary's PLACEHOLDER_ADDRESS
  // check): never emit the literal "Address not in OpenStreetMap" as a
  // structured-data street address — omit the field entirely rather than
  // publish a placeholder string as fact.
  if (venue.address !== PLACEHOLDER_ADDRESS) {
    address["streetAddress"] = extractStreetAddress(venue.address);
  }
  // #705 review fix: addressLocality was hardcoded "Pueblo" for every venue,
  // wrong for the ~14 in Pueblo West/Colorado City/Blende/Baxter/Avondale/
  // Vineland. Uses the CORE parser (no locale, no "Pueblo County" fallback
  // text) — when the city can't be parsed, omitting the field entirely is
  // correct; emitting fallback prose as a structured-data city name isn't.
  const city = parseVenueCityCore(venue.address);
  if (city) {
    address["addressLocality"] = city;
  }
  if (postalCode) {
    address["postalCode"] = postalCode;
  }

  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": CATEGORY_SCHEMA_TYPE[venue.category],
    name: venue.name,
    // #704 (SEO/AEO plan Phase 2): the old description was byte-identical
    // for every venue sharing a category ("Food Pantry in Pueblo, CO.") —
    // now the same verified-fact summary sentence(s) venuePageMetadataFields
    // uses for <meta description>, so the two can't drift.
    description: buildVenueSummary(venue, locale).join(" "),
    url: `${SITE_URL}${venuePath(venue.id, locale)}`,
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

  // #704: the venue's own outbound link — "the same entity elsewhere",
  // never the map's own URL (that's already `url` above). #705 review fix:
  // only when that url belongs to THIS venue alone (URL_COUNTS <= 1) — a
  // url shared by multiple venues (the 10 gardens/edible landscapes on one
  // Pueblo Food Project page) is a program page, not any one venue's own
  // identity; sameAs on all 10 would falsely claim they're all "the same
  // entity" as each other.
  if (venue.url && (URL_COUNTS.get(venue.url) ?? 0) <= 1) {
    result["sameAs"] = [venue.url];
  }

  // #704 truth rule: "free" only for the 4 categories venueSummary.ts's
  // FREE_CATEGORIES names — the same set the summary sentence's "what"
  // phrase uses, so the two can never disagree about which venues are free.
  if (FREE_CATEGORIES.has(venue.category)) {
    result["isAccessibleForFree"] = true;
  }

  // #704 truth rule: SNAP/EBT only when accepts_snap is CONFIRMED true —
  // false or missing stays silent, never a "does not accept" claim.
  if (venue.accepts_snap === true) {
    result["paymentAccepted"] = "SNAP/EBT";
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
