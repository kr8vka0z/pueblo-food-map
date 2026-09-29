/**
 * Pure list builders for the SEO hub pages (SEO/AEO plan Phase 3, #709):
 * /food-pantries, /snap-wic-stores, /community-gardens (+ /es twins), plus the
 * /blessing-boxes list helpers (PR B).
 *
 * WHY here and not in the page files: Next rejects unknown named exports from
 * a page file, and both trees (EN + /es) plus the tests import these. No
 * Date/random/locale-dependent state, so they run against synthetic fixtures.
 *
 * ItemList / FAQPage JSON-LD are NOT rebuilt here: buildVenueListJsonLd and
 * buildFaqJsonLd (venueSchema.ts) are the house shapes; the hub components
 * feed them the lists these functions return, so schema and visible list
 * can't drift.
 *
 * Truth rules (same as venueSummary.ts): SNAP/WIC only on `=== true` (a
 * truthy check would let the string "true" through); "free" wording only for
 * FREE_CATEGORIES; the OSM placeholder address is never shown.
 */

import type { Venue } from "@/types/venue";
import type { Locale } from "@/lib/i18n";
import { localizedHref } from "@/lib/localizedHref";
import { SITE_URL } from "@/lib/site";
import { FREE_CATEGORIES, PLACEHOLDER_ADDRESS, buildHoursSentence } from "@/lib/venueSummary";

const byName = (a: Venue, b: Venue) => a.name.localeCompare(b.name);

/** Every pantry, sorted by name. */
export function pantriesForHub(list: Venue[]): Venue[] {
  return list.filter((v) => v.category === "pantry").sort(byName);
}

/** Places confirmed to take SNAP and/or WIC (strict `=== true`), sorted by name, each once. */
export function snapWicForHub(list: Venue[]): {
  places: Venue[];
  snapCount: number;
  wicCount: number;
} {
  const places = list
    .filter((v) => v.accepts_snap === true || v.accepts_wic === true)
    .sort(byName);
  return {
    places,
    snapCount: places.filter((v) => v.accepts_snap === true).length,
    wicCount: places.filter((v) => v.accepts_wic === true).length,
  };
}

/** Gardens, then edible landscapes; each group sorted by name, empty groups dropped. */
export function gardensForHub(
  list: Venue[],
): { category: "garden" | "edible_landscape"; items: Venue[] }[] {
  return (["garden", "edible_landscape"] as const)
    .map((category) => ({
      category,
      items: list.filter((v) => v.category === category).sort(byName),
    }))
    .filter((g) => g.items.length > 0);
}

/** True only when EVERY place is in a FREE_CATEGORIES category — gates "free" in hub copy. */
export function allFree(list: Venue[]): boolean {
  return list.length > 0 && list.every((v) => FREE_CATEGORIES.has(v.category));
}

/** The street address to show, or null for the OSM placeholder. */
export function hubAddress(venue: Venue): string | null {
  return venue.address === PLACEHOLDER_ADDRESS ? null : venue.address;
}

/** Hours in plain words ("Hours: Thursdays, 11am – 2pm."), or null when the place has none. */
export function hubHours(venue: Venue, locale: Locale): string | null {
  return buildHoursSentence(venue, locale);
}

// ─── /blessing-boxes (PR B) ─────────────────────────────────────────────────
// Boxes come from D1 at request time (PublicBlessingBox), not the build-time
// snapshot, but the list rules are the same pure shape as the hubs above.

/** Every live box, sorted by name (copy — never mutates the loader's array). */
export function boxesForHub<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Map deep link for a box: the home page reads `?venue=<id>` and opens that
 * pin's card. `localizedHref("/", tree)` gives "/" or "/es" — both mount the
 * same HomePageClient. The id is encoded: box ids come from admin-entered rows.
 */
export function boxDeepLink(id: string, locale: Locale): string {
  return `${localizedHref("/", locale)}?venue=${encodeURIComponent(id)}`;
}

/** ItemList JSON-LD for the rendered box list: absolute deep-link URLs, positions 1..n. */
export function buildBoxListJsonLd(
  boxes: { id: string; name: string }[],
  locale: Locale,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: boxes.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}${boxDeepLink(b.id, locale)}`,
      name: b.name,
    })),
  };
}
