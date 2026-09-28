/**
 * /venues — full, server-rendered directory of every venue on the map.
 *
 * WHY this page exists: the homepage is a live Mapbox canvas — invisible to
 * crawlers and AI answer engines that don't execute the map's client JS (the
 * ItemList JSON-LD on `/` covers structured data, but offers no readable HTML
 * a user or a text-only crawler can actually scan). This page emits the full
 * venue list as plain server-rendered HTML, grouped by category, so search
 * and answer engines get a crawlable index and users get a no-map way to
 * browse every resource. SEO/AEO PR4 item S5.
 *
 * Static server component with a static English `metadata` export (crawler
 * metadata stays English-only, ARCHITECTURE.md "Known bilingual limitation",
 * #287). The visible body is VenuesDirectoryContent — a client component
 * reading the visitor's locale via useLocale() (#289) — so this route never
 * reads cookies() itself and keeps its 100% static caching.
 *
 * groupVenuesByCategory is exported as a pure, framework-free function (no
 * Next.js APIs, no Date/random) specifically so it's unit-testable without
 * rendering the page — see src/__tests__/venues.test.tsx.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import { venues, categoryLabels } from "@/data/venues";
import type { Venue, VenueCategory } from "@/types/venue";
import VenuesDirectoryContent from "@/components/VenuesDirectoryContent";

export const metadata: Metadata = buildPageMetadata({
  title: "All Food Resources",
  description:
    "Browse every food resource on the Pueblo Food Map — food pantries, grocery stores, community gardens, farms, and meal sites across Pueblo County, CO, with addresses and hours.",
  path: "/venues",
});

/**
 * Group venues by category, in categoryLabels' key order, with empty
 * categories omitted and each group's items sorted by name.
 *
 * Pure and deterministic (no side effects, no Date/random) so it's testable
 * against synthetic fixtures without touching the real venues dataset.
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

export default function VenuesPage() {
  const groups = groupVenuesByCategory(venues);
  return <VenuesDirectoryContent groups={groups} />;
}
