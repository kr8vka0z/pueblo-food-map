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
 * src/app/(site)/box/[id]/page.tsx), not a page worth indexing — it's `noindex` now.
 * Boxes come back to the sitemap as the planned read-only `/blessing-boxes`
 * list (REVIEW.md). With the live D1 read gone, this file is build-time data
 * only again and no longer `force-dynamic`. src/__tests__/seo.test.ts checks
 * that every static URL below maps to a real page.tsx.
 *
 * #689 PR 2 (design decision 10): every MIRRORED route (/, /venues,
 * /venue/<id>, /resources, /about, plus the #709 hubs) gets a matching /es entry, and EACH of
 * the pair carries `alternates.languages` pointing at the other — Next's
 * MetadataRoute.Sitemap supports this per-entry (node_modules/next/dist/
 * docs/.../metadata/sitemap.md, "Generating a localized sitemap"). Only
 * mirrored routes get an /es twin; /boxes/activity, /suggest, /feedback,
 * /privacy stay EN-only (#689 "Out" scope) with no alternates block.
 */

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { venues } from "@/data/venues";

/**
 * Build the {en, es, x-default} alternates.languages block Next expects,
 * given a page's EN path. x-default → EN (review fix, matches
 * buildPageMetadata's own hreflang and #689 design decision 5) — without
 * it a crawler/locale that matches neither explicit alternate has no
 * documented fallback for this page pair.
 */
function esAlternates(enPath: string): { languages: { en: string; es: string; "x-default": string } } {
  const enUrl = enPath === "/" ? SITE_URL : `${SITE_URL}${enPath}`;
  const esUrl = enPath === "/" ? `${SITE_URL}/es` : `${SITE_URL}/es${enPath}`;
  return { languages: { en: enUrl, es: esUrl, "x-default": enUrl } };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: esAlternates("/"),
    },
    {
      url: `${SITE_URL}/es`,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: esAlternates("/"),
    },
    {
      // WHY 0.8: About is the primary discovery page for new visitors — higher
      // than the utility forms (suggest/feedback/privacy) but below the homepage.
      url: `${SITE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: esAlternates("/about"),
    },
    {
      url: `${SITE_URL}/es/about`,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: esAlternates("/about"),
    },
    {
      // WHY 0.8: same tier as /about — a discovery page people search for
      // ("how to get SNAP in Pueblo"), not a utility form.
      url: `${SITE_URL}/resources`,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: esAlternates("/resources"),
    },
    {
      url: `${SITE_URL}/es/resources`,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: esAlternates("/resources"),
    },
    // WHY 0.8 / weekly: the SEO Phase 3 hub pages (#709) are the pages meant to
    // rank for "food pantry Pueblo", "SNAP stores Pueblo" etc. — same tier as
    // /about and /resources, and the lists change with each Publish.
    {
      url: `${SITE_URL}/food-pantries`,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: esAlternates("/food-pantries"),
    },
    {
      url: `${SITE_URL}/es/food-pantries`,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: esAlternates("/food-pantries"),
    },
    {
      url: `${SITE_URL}/snap-wic-stores`,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: esAlternates("/snap-wic-stores"),
    },
    {
      url: `${SITE_URL}/es/snap-wic-stores`,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: esAlternates("/snap-wic-stores"),
    },
    {
      url: `${SITE_URL}/community-gardens`,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: esAlternates("/community-gardens"),
    },
    {
      url: `${SITE_URL}/es/community-gardens`,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: esAlternates("/community-gardens"),
    },
    {
      // WHY 0.7: a browse/discovery page (the crawlable counterpart to the
      // JS-only homepage map) — below /about's 0.8, above the utility forms.
      url: `${SITE_URL}/venues`,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: esAlternates("/venues"),
    },
    {
      url: `${SITE_URL}/es/venues`,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: esAlternates("/venues"),
    },
    {
      // WHY 0.5/"hourly": live content (Blessing Boxes slice 3), but a
      // secondary/watcher-audience page — below the browse/discovery pages
      // above, same priority tier as /feedback. Not mirrored — #689 "Out" scope.
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

  const venueRoutes: MetadataRoute.Sitemap = venues.flatMap((v) => {
    const enPath = `/venue/${v.id}`;
    const alternates = esAlternates(enPath);
    return [
      {
        url: `${SITE_URL}${enPath}`,
        // Unlike the static routes above (no per-page last-modified source),
        // every venue row already tracks last_verified — a real signal crawlers
        // can use to prioritize re-crawling changed venues over unchanged ones.
        lastModified: v.last_verified,
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates,
      },
      {
        url: `${SITE_URL}/es${enPath}`,
        lastModified: v.last_verified,
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates,
      },
    ];
  });

  return [...staticRoutes, ...venueRoutes];
}
