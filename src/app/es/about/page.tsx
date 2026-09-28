/**
 * /es/about — Spanish twin of /about (#689 PR 2).
 *
 * Thin wrapper: AboutContent is the SAME client component the EN page
 * mounts, already reading useLocale() (#289) — under this tree's locked
 * provider it renders Spanish body copy with no changes needed. The
 * FAQPage JSON-LD is built here in Spanish (#689 supersedes #386's
 * "JSON-LD is always English" rule — see buildFaqJsonLd's own header) so
 * it matches what AboutContent actually renders on this page.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { publishedAt } from "@/data/published-venues";
import { serializeJsonLd, buildFaqJsonLd } from "@/lib/venueSchema";
import AboutContent from "@/components/AboutContent";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.about.title", "es"),
  description: t("meta.about.description", "es"),
  path: "/es/about",
  locale: "es",
  mirrored: true,
});

export default function EsAboutPage() {
  const faqNums = [1, 2, 3, 4, 5, 6] as const;
  const faqItems = faqNums.map((n) => ({
    question: t(`about.faq.q${n}`, "es"),
    answer: t(`about.faq.a${n}`, "es"),
  }));
  const faqJsonLd = serializeJsonLd(buildFaqJsonLd(faqItems, "es"));

  return (
    <AboutContent faqJsonLd={faqJsonLd} venueCount={venues.length} publishedAt={publishedAt} />
  );
}
