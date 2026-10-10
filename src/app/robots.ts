/**
 * robots.txt generation for Pueblo Food Map.
 *
 * WHY: Allows all crawlers on public pages while blocking /api/ (form-
 * submission endpoints), /admin/ (internal tool, not public content), and
 * /alerts/ (Blessing Boxes slice 6's confirm/stop links — each carries a
 * live subscription token in its `?t=` query string, same reasoning as the
 * per-page `robots: noindex` those two pages' own metadata already sets) —
 * none of the three is meant to be indexed or crawled.
 *
 * WHY the second rule (#164 quick win, S7b): explicit AI-bot policy — block
 * bulk-training scrapers by name, but deliberately do NOT list citation /
 * answer-engine crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot,
 * Bingbot, Googlebot) in any disallow-all rule, so they fall through to the
 * permissive "*" rule above and can still cite this site in AI answers. This
 * re-establishes in version-controlled code a policy that previously lived
 * only as a Cloudflare dashboard bot-management rule — invisible to this
 * repo and to anyone without CF dashboard access.
 *
 * WHY the allowed bots stay allowed (the one-line policy): GPTBot,
 * ChatGPT-User, OAI-SearchBot, PerplexityBot, ClaudeBot and bingbot are how
 * ChatGPT, Perplexity, Copilot and Claude find and cite this site, and
 * Googlebot feeds Google AI Overviews (Google-Extended is only an opt-out for
 * Gemini training, and is left allowed too). Blocking them would remove the
 * site from those answers, which is the goal of docs/seo-aeo-plan.md. The five
 * blocked bots (CCBot, Bytespider, Amazonbot, Applebot-Extended,
 * meta-externalagent) are training-data crawlers that don't send citations or
 * visits back.
 */

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Event flyers (#762) are served from under /api/, which is disallowed
        // below. Google only counts an Event's image (and a link preview only
        // reliably shows it) if the crawler may fetch it, and the longest
        // matching rule wins, so this narrow Allow beats the /api/ Disallow
        // for flyer files and nothing else under /api/.
        allow: ["/", "/api/public/events/*/flyer/"],
        disallow: ["/api/", "/admin/", "/alerts/"],
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
