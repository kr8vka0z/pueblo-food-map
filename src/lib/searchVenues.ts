import type { Venue, VenueCategory } from "@/types/venue";

/**
 * Human-readable category labels used for search matching.
 *
 * These are the canonical EN labels for the search index. They deliberately
 * differ from `categoryLabels` in data/venues.ts (which is used for map
 * display). The shorter forms ("Grocery store" vs "Grocery / Supermarket")
 * match what a user is more likely to type.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Scope §2
 * Decision: EN-only for demo; locale toggle is deferred (open question #11).
 */
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
 * Filter venues by a free-text query against venue name and readable category.
 *
 * - No debounce: 112 venues is fast enough for live-filter on each keystroke.
 * - No fuzzy match: substring is sufficient for the demo; revisit post-demo.
 * - Empty query returns the full list unchanged.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Scope §2
 */
export function searchVenues(venues: Venue[], query: string): Venue[] {
  const q = query.trim().toLowerCase();
  if (!q) return venues;
  return venues.filter((v) => {
    const name = v.name.toLowerCase();
    const cat = CATEGORY_LABELS[v.category].toLowerCase();
    return name.includes(q) || cat.includes(q);
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
