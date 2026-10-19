/**
 * Root page — synchronous Server Component shell for the homepage.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #4
 *
 * The page body is HomeShell (src/components/HomeShell.tsx), shared with the
 * /es homepage: venue-index JSON-LD, a sr-only <h1> and crawl links rendered
 * on the server, then HomePageClient for the interactive map/splash body —
 * see that file for why the homepage is split this way. Stays synchronous
 * (NOT async): src/__tests__/page.test.tsx renders it directly with
 * `render(<HomePage />)`, which cannot await a Promise-returning component.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import HomeShell from "@/components/HomeShell";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.home.title", "en"),
  description: t("meta.home.description", "en"),
  path: "/",
  // #689 PR 2: this page has an /es counterpart — carries hreflang now.
  mirrored: true,
});

export default function HomePage() {
  return <HomeShell locale="en" />;
}
