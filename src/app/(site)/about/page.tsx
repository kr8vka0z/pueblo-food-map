/**
 * /about — mission, vision, origin story, and how venues are sourced.
 *
 * Static server component with a static English `metadata` export (this
 * EN-tree route; /es/about's own page.tsx passes locale: "es" — ARCHITECTURE.md
 * "i18n model", #689 PR 2). The visible body is AboutContent — a client
 * component reading the visitor's locale via useLocale() (#289) — so this
 * route never reads cookies() itself and keeps its 100% static caching. The
 * FAQPage JSON-LD is still built here, in English (matching this EN-tree
 * page — #689 supersedes #386's old "always English" rule with "JSON-LD
 * matches the URL's language"), and handed to AboutContent as a
 * pre-serialized string.
 *
 * Copy on this page is DRAFT pending final text from Kyle / Pueblo Food
 * Project (#155). See i18n keys about.* in src/lib/i18n.ts.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { publishedAt } from "@/data/published-venues";
import { serializeJsonLd, buildFaqJsonLd } from "@/lib/venueSchema";
import AboutContent from "@/components/AboutContent";

export const metadata: Metadata = buildPageMetadata({
  title: "About",
  description:
    "About Pueblo Food Map — our mission to connect Pueblo County residents with free and low-cost food resources, and how venue data is sourced.",
  path: "/about",
  // #689 PR 2: this page has an /es counterpart — carries hreflang now.
  mirrored: true,
});

export default function AboutPage() {
  // FAQPage JSON-LD is machine-readable metadata, built in English here
  // (this EN-tree page; /es/about's page.tsx builds it in Spanish — #689
  // supersedes #386's old "always English" rule).
  const faqNums = [1, 2, 3, 4, 5, 6] as const;
  const faqItems = faqNums.map((n) => ({
    question: t(`about.faq.q${n}`, "en"),
    answer: t(`about.faq.a${n}`, "en"),
  }));
  const faqJsonLd = serializeJsonLd(buildFaqJsonLd(faqItems));

  return (
    <AboutContent faqJsonLd={faqJsonLd} venueCount={venues.length} publishedAt={publishedAt} />
  );
}
