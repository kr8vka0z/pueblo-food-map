/**
 * XML sitemap for Pueblo Food Map.
 *
 * WHY: Tells search crawlers which pages exist and their relative importance.
 * Static routes are listed first, then per-venue pages (74+ entries) are
 * appended dynamically from the venues array. Venue pages use monthly
 * changeFrequency and 0.7 priority — meaningful but below the homepage.
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
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...venueRoutes];
}
