import type { Venue, VenueCategory } from "@/types/venue";

/**
 * Category search index: English labels, Spanish labels, and Pueblo aliases.
 * We always union every term so "despensa" matches in EN mode and "pantry" in ES mode.
 * EmptySearchPopover chip labels must stay inside this set or search will miss them.
 */
const CATEGORY_SEARCH_TERMS: Record<VenueCategory, readonly string[]> = {
  pantry: [
    "food pantry",
    "pantry",
    "despensa",
    "despensa de alimentos",
    "comida",
  ],
  grocery: [
    "grocery store",
    "grocery",
    "supermarket",
    "supermercado",
    "mercado",
  ],
  convenience: [
    "convenience store",
    "convenience",
    "tienda de conveniencia",
    "conveniencia",
  ],
  farm: ["farm", "market", "granja", "mercado"],
  garden: ["community garden", "garden", "huerto", "huerto comunitario"],
  edible_landscape: [
    "edible landscape",
    "paisaje comestible",
  ],
  meal_site: ["meal site", "meal", "comedor", "comedor comunitario"],
};

/**
 * Benefit queries filter venue flags, not category.
 * "estampillas" is common Pueblo wording for SNAP; it should return every accepts_snap venue.
 */
const SNAP_SEARCH_TERMS = ["snap", "estampillas", "cupones", "food stamps"];
const WIC_SEARCH_TERMS = ["wic"];

/**
 * Minimum length before category and benefit synonym scans run.
 * Bidirectional substring checks on one and two character input flooded results.
 * Name substring search still works below this threshold.
 */
const MIN_ALIAS_QUERY_LENGTH = 3;

/** Primary EN label per category for EmptySearchPopover CATEGORY_OPTIONS. */
const CATEGORY_LABELS: Record<VenueCategory, string> = {
  pantry: "Food pantry",
  grocery: "Grocery store",
  convenience: "Convenience store",
  farm: "Farm",
  garden: "Community garden",
  edible_landscape: "Edible landscape",
  meal_site: "Meal site",
};

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Alias scans use bidirectional substring checks that over match at one and two characters.
 * Name search in searchVenues skips this gate so typing a place name still works early.
 */
function isBroadAliasEligible(q: string): boolean {
  return q.length >= MIN_ALIAS_QUERY_LENGTH;
}

/**
 * Match query fragments against bilingual category terms in both directions.
 * Lets "super" surface grocery and "mercado" still reach farm categories.
 */
function matchesCategoryTerms(category: VenueCategory, q: string): boolean {
  if (!isBroadAliasEligible(q)) return false;
  return CATEGORY_SEARCH_TERMS[category].some(
    (term) =>
      term.toLowerCase().includes(q) || q.includes(term.toLowerCase()),
  );
}

/**
 * SNAP benefit intent. Exact "snap" bypasses the alias length gate so users filter in one step.
 * We only short circuit on snap here so wic queries never enable SNAP flag filtering.
 */
function matchesSnapBenefit(q: string): boolean {
  if (q === "snap") return true;
  if (!isBroadAliasEligible(q)) return false;
  return SNAP_SEARCH_TERMS.some(
    (term) => term.includes(q) || q.includes(term),
  );
}

/**
 * WIC benefit intent. Exact "wic" bypasses the alias length gate for the same one step discovery.
 * Kept separate from SNAP so program filters never cross match on a single keyword.
 */
function matchesWicBenefit(q: string): boolean {
  if (q === "wic") return true;
  if (!isBroadAliasEligible(q)) return false;
  return WIC_SEARCH_TERMS.some((term) => term.includes(q) || q.includes(term));
}

/**
 * Filter venues by a free-text query against venue name, category terms (EN + ES),
 * and benefit-program aliases (SNAP / WIC).
 *
 * - No debounce: 108 venues is fast enough for live-filter on each keystroke.
 * - No fuzzy match: substring is sufficient for the demo; revisit post-demo.
 * - Empty query returns the full list unchanged.
 */
export function searchVenues(venues: Venue[], query: string): Venue[] {
  const q = normalizeQuery(query);
  if (!q) return venues;

  const snapQuery = matchesSnapBenefit(q);
  const wicQuery = matchesWicBenefit(q);

  return venues.filter((v) => {
    // Name matching ignores the alias length gate so partial place names work from the first keystroke.
    if (v.name.toLowerCase().includes(q)) return true;
    if (matchesCategoryTerms(v.category, q)) return true;
    if (snapQuery && v.accepts_snap) return true;
    if (wicQuery && v.accepts_wic) return true;
    return false;
  });
}

/**
 * Ordered list of all categories with their search-index labels.
 * Used by EmptySearchPopover to render suggestion chips.
 */
export const CATEGORY_OPTIONS: Array<{ key: VenueCategory; label: string }> =
  Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key: key as VenueCategory,
    label,
  }));
