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

/**
 * Users type partial category words in either language.
 * Match both directions so short queries like "super" still surface grocery venues.
 */
function matchesCategoryTerms(category: VenueCategory, q: string): boolean {
  return CATEGORY_SEARCH_TERMS[category].some((term) =>
    term.toLowerCase().includes(q) || q.includes(term.toLowerCase()),
  );
}

function matchesSnapBenefit(q: string): boolean {
  return SNAP_SEARCH_TERMS.some(
    (term) => term.includes(q) || q.includes(term),
  );
}

function matchesWicBenefit(q: string): boolean {
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
  const q = query.trim().toLowerCase();
  if (!q) return venues;

  const snapQuery = matchesSnapBenefit(q);
  const wicQuery = matchesWicBenefit(q);

  return venues.filter((v) => {
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
