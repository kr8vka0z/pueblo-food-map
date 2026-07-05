/**
 * robots.txt generation for Pueblo Food Map.
 *
 * WHY: Allows all crawlers on public pages while blocking /api/ (form-
 * submission endpoints) and /admin/ (internal tool, not public content) —
 * neither is meant to be indexed or crawled.
 *
 * WHY the second rule (#164 quick win, S7b): explicit AI-bot policy — block
 * bulk-training scrapers by name, but deliberately do NOT list citation /
 * answer-engine crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot,
 * Bingbot, Googlebot) in any disallow-all rule, so they fall through to the
 * permissive "*" rule above and can still cite this site in AI answers. This
 * re-establishes in version-controlled code a policy that previously lived
 * only as a Cloudflare dashboard bot-management rule — invisible to this
 * repo and to anyone without CF dashboard access.
 */

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
      {
        // Bulk-training scrapers — blocked entirely, no crawl access at all.
        userAgent: ["CCBot", "Bytespider", "Amazonbot", "Applebot-Extended", "meta-externalagent"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
