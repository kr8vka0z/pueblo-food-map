/**
 * groupVenuesByCategory — the /venues and /es/venues directory grouping.
 *
 * Lives in lib rather than in a page.tsx because a page module may only
 * export what Next reads off it (default, metadata, generateStaticParams...);
 * both directory pages and src/__tests__/venues.test.tsx import it from here.
 */

import { categoryLabels } from "@/lib/categories";
import type { Venue, VenueCategory } from "@/types/venue";

/**
 * Group venues by category, in categoryLabels' key order, with empty
 * categories omitted and each group's items sorted by name.
 *
 * Pure and deterministic (no side effects, no Date/random, no locale) so it's
 * testable against synthetic fixtures without touching the real venues dataset.
 */
export function groupVenuesByCategory(
  list: Venue[],
): { category: VenueCategory; items: Venue[] }[] {
  const categories = Object.keys(categoryLabels) as VenueCategory[];
  return categories
    .map((category) => ({
      category,
      items: list
        .filter((v) => v.category === category)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.items.length > 0);
}
