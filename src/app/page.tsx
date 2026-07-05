/**
 * Root page — synchronous Server Component shell for the homepage.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #4
 *
 * WHY split from the interactive body (SEO PR1, see AGENTS.md
 * "Discoverability / SEO" → "Deferred: server-render the homepage ItemList
 * JSON-LD"): the homepage used to BE the client component now in
 * HomePageClient.tsx — its first render always returned null (the
 * splash-gate state starts unresolved until an effect runs), so crawlers
 * that don't execute JS, and the ItemList JSON-LD script that lived in that
 * same component, never appeared in the server response at all. This file
 * is now a synchronous Server Component (NOT async —
 * src/__tests__/page.test.tsx renders it directly with
 * `render(<HomePage />)`, which cannot await a Promise-returning component)
 * that emits the venue-index JSON-LD, a sr-only <h1>, and page metadata
 * unconditionally, then mounts HomePageClient for the interactive
 * map/splash body.
 */

import type { Metadata } from "next";
import { buildVenueListJsonLd, serializeJsonLd } from "@/lib/venueSchema";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = buildPageMetadata({
  title: "Pueblo Food Map — Food Resources in Pueblo County, CO",
  description:
    "Find free and low-cost food near you in Pueblo County, CO — pantries, community gardens, grocery stores, and meal sites, with SNAP/WIC info and directions.",
  path: "/",
});

export default function HomePage() {
  // Build ItemList JSON-LD once (referentially stable — venues array is static).
  const itemListJsonLd = buildVenueListJsonLd(venues);

  return (
    <>
      {/* ItemList JSON-LD — crawlable venue index for search engines, on / only */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
      />
      {/* sr-only: gives crawlers/AT a real <h1> without changing the splash/map visual design */}
      <h1 className="sr-only">Pueblo Food Map — Food Resources in Pueblo County, CO</h1>
      <HomePageClient />
    </>
  );
}
