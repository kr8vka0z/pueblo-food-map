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
 * Static server component with a static English `metadata` export (this is
 * the EN tree; the /es/venues twin carries Spanish metadata, ARCHITECTURE.md
 * "i18n model", #287). The visible body is VenuesDirectoryContent — a client component
 * reading the visitor's locale via useLocale() (#289) — so this route never
 * reads cookies() itself and keeps its 100% static caching.
 *
 * The grouping is groupVenuesByCategory (src/lib/venueGroups.ts), shared with
 * the /es/venues twin and unit-tested in src/__tests__/venues.test.tsx.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { groupVenuesByCategory } from "@/lib/venueGroups";
import VenuesDirectoryContent from "@/components/VenuesDirectoryContent";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.venues.title", "en"),
  description: t("meta.venues.description", "en"),
  path: "/venues",
  // #689 PR 2: this page has an /es counterpart — carries hreflang now.
  mirrored: true,
});

export default function VenuesPage() {
  const groups = groupVenuesByCategory(venues);
  return <VenuesDirectoryContent groups={groups} />;
}
