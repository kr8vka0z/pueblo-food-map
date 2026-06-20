/**
 * robots.txt generation for Pueblo Food Map.
 *
 * WHY: Allows all crawlers on public pages while blocking /api/ routes —
 * those are form-submission endpoints, not crawlable content.
 */

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
