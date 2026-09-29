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
import Link from "next/link";
import { buildVenueListJsonLd, serializeJsonLd } from "@/lib/venueSchema";
import { buildPageMetadata } from "@/lib/site";
import { SPLASH_GATE_SCRIPT } from "@/lib/splashGate";
import { venues } from "@/data/venues";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = buildPageMetadata({
  title: "Pueblo Food Map — Food Resources in Pueblo County, CO",
  description:
    "Find free and low-cost food near you in Pueblo County, CO — pantries, community gardens, grocery stores, and meal sites, with SNAP/WIC info and directions.",
  path: "/",
  // #689 PR 2: this page has an /es counterpart — carries hreflang now.
  mirrored: true,
});

// Not exported: Next.js rejects unknown named exports from a page file.
const HOME_CRAWL_LINKS = [
  { href: "/venues", label: "All food resources in Pueblo County" },
  { href: "/resources", label: "Food help programs (SNAP, WIC, 2-1-1)" },
  { href: "/about", label: "About Pueblo Food Map" },
  // SEO Phase 3 hubs (#709)
  { href: "/food-pantries", label: "Food pantries in Pueblo County" },
  { href: "/snap-wic-stores", label: "Places that accept SNAP and WIC" },
  { href: "/community-gardens", label: "Community gardens in Pueblo County" },
  { href: "/blessing-boxes", label: "Blessing boxes in Pueblo County" },
] as const;

const HOME_CRAWL_LINK_CLASS =
  "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 " +
  "focus:px-3 focus:py-2 focus:rounded focus:bg-[var(--color-bone-50)] " +
  "focus:text-[var(--color-ink-900)] focus:outline-none focus:ring-2 " +
  "focus:ring-[var(--color-sage-500)]";

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
      {/* Server-rendered links (SEO/AEO plan Phase 0). Before this, the
          homepage's server HTML had zero <a> links, so crawlers that don't run
          JS couldn't get from / to /venues (and from there every venue page).
          Visually hidden like the <h1> above, so the map design is
          unchanged; screen-reader users get the same links. Each link shows
          itself when focused (the skip-link pattern), so keyboard focus never
          lands on something invisible. English only, like the <h1>. */}
      {/* `absolute` keeps the zero-size list out of the flex layout. */}
      <nav aria-label="Site" className="absolute">
        {/* list-none explicitly, rather than relying on Tailwind Preflight, so
            no bullet can ever show over the map. */}
        <ul className="list-none">
          {HOME_CRAWL_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={HOME_CRAWL_LINK_CLASS}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Must sit right before HomePageClient: runs before the splash markup is
          parsed, so returning visitors never paint it (see splashGate.ts). */}
      <script dangerouslySetInnerHTML={{ __html: SPLASH_GATE_SCRIPT }} />
      <HomePageClient />
    </>
  );
}
