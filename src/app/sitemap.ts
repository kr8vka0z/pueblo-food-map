/**
 * Static XML sitemap for Pueblo Food Map.
 *
 * WHY: Tells search crawlers which pages exist and their relative importance.
 * Per-venue URLs (6.4) will be added in a follow-up PR once the /venue/[id]
 * route exists — add a dynamic entry loop there.
 */

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/suggest`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/feedback`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // TODO (PR2 — issue #164, items 6.3/6.4): add per-venue entries here
    // once the /venue/[id] dynamic route ships.
  ];
}
