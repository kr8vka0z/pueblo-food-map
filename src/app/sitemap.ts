/**
 * XML sitemap for Pueblo Food Map.
 *
 * WHY: Tells search crawlers which pages exist and their relative importance.
 * Static routes are listed first, then per-venue pages (74+ entries) are
 * appended dynamically from the venues array. Venue pages use monthly
 * changeFrequency and 0.7 priority — meaningful but below the homepage.
 *
 * WHY no Blessing Box URLs (SEO/AEO plan Phase 0, docs/seo-aeo-plan.md):
 * `/boxes` was listed here but never existed (a 404 in every crawl), and each
 * `/box/<id>` is a client-side redirect shell into the map card (see
 * src/app/box/[id]/page.tsx), not a page worth indexing — it's `noindex` now.
 * Boxes come back to the sitemap as the planned read-only `/blessing-boxes`
 * list (REVIEW.md). With the live D1 read gone, this file is build-time data
 * only again and no longer `force-dynamic`. src/__tests__/seo.test.ts checks
 * that every static URL below maps to a real page.tsx.
 */

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { venues } from "@/data/venues";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      // WHY 0.8: About is the primary discovery page for new visitors — higher
      // than the utility forms (suggest/feedback/privacy) but below the homepage.
      url: `${SITE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      // WHY 0.8: same tier as /about — a discovery page people search for
      // ("how to get SNAP in Pueblo"), not a utility form.
      url: `${SITE_URL}/resources`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      // WHY 0.7: a browse/discovery page (the crawlable counterpart to the
      // JS-only homepage map) — below /about's 0.8, above the utility forms.
      url: `${SITE_URL}/venues`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      // WHY 0.5/"hourly": live content (Blessing Boxes slice 3), but a
      // secondary/watcher-audience page — below the browse/discovery pages
      // above, same priority tier as /feedback.
      url: `${SITE_URL}/boxes/activity`,
      changeFrequency: "hourly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/suggest`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/feedback`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const venueRoutes: MetadataRoute.Sitemap = venues.map((v) => ({
    url: `${SITE_URL}/venue/${v.id}`,
    // Unlike the static routes above (no per-page last-modified source),
    // every venue row already tracks last_verified — a real signal crawlers
    // can use to prioritize re-crawling changed venues over unchanged ones.
    lastModified: v.last_verified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...venueRoutes];
}
