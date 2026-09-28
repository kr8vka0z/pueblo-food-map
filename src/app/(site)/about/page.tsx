/**
 * /about — mission, vision, origin story, and how venues are sourced.
 *
 * Static server component with a static English `metadata` export (crawler
 * metadata stays English-only, ARCHITECTURE.md "Known bilingual limitation",
 * #287). The visible body is AboutContent — a client component reading the
 * visitor's locale via useLocale() (#289) — so this route never reads
 * cookies() itself and keeps its 100% static caching. The FAQPage JSON-LD is
 * still built here, in English always (#386), and handed to AboutContent as
 * a pre-serialized string.
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
});

export default function AboutPage() {
  // FAQPage JSON-LD is machine-readable metadata — always English (#386),
  // independent of the visible FAQ AboutContent renders in the visitor's locale.
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
