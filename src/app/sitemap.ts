/**
 * XML sitemap for Pueblo Food Map.
 *
 * WHY: Tells search crawlers which pages exist and their relative importance.
 * Static routes are listed first, then per-venue pages (74+ entries) are
 * appended dynamically from the venues array. Venue pages use monthly
 * changeFrequency and 0.7 priority — meaningful but below the homepage.
 *
 * Blessing box pages (slice 1) are appended after venues, read live from D1
 * — boxes are excluded from the venues array on purpose (live, not
 * published), so this is the one place sitemap.ts reaches outside its
 * usual build-time-only data source. `force-dynamic` + a try/catch around
 * the D1 read (never the sitemap-wide function) matches AGENTS.md's
 * invariant that a `next build` must never itself touch D1 — this file
 * still builds fine with zero box entries; the read only ever runs at
 * request time. A D1 failure degrades to "no box entries this request"
 * rather than 500ing the whole sitemap.
 */

import type { MetadataRoute } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SITE_URL } from "@/lib/site";
import { venues } from "@/data/venues";
import { loadLiveBoxes } from "@/lib/blessingBoxes";
import { logBlessingBoxesReadFailure } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function loadBoxRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const { env } = getCloudflareContext();
    const boxes = await loadLiveBoxes(env.ADMIN_DB);
    return boxes.map((b) => ({
      url: `${SITE_URL}/box/${b.id}`,
      lastModified: b.last_verified,
      // "daily": a box's live status/host details can change any time,
      // unlike an ordinary venue's monthly-refresh cadence.
      changeFrequency: "daily",
      priority: 0.6,
    }));
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const boxRoutes = await loadBoxRoutes();

  return [...staticRoutes, ...venueRoutes, ...boxRoutes];
}
