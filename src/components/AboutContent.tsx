"use client";

/**
 * AboutContent — visible body of /about, including its FAQPage JSON-LD.
 *
 * Extracted from src/app/about/page.tsx so the visible mission/FAQ copy
 * reads the visitor's locale via useLocale() (#289), while the page itself
 * stays a static Server Component (no cookies() read — AGENTS.md "Known
 * bilingual limitation", #287).
 *
 * The FAQPage JSON-LD is built server-side, ALWAYS in English (#386 — every
 * JSON-LD block on this site is machine-readable metadata, out of scope for
 * bilingual support), and passed in as a pre-serialized string. That means
 * the injected JSON-LD only matches this component's visible FAQ text
 * verbatim when locale === "en" — the same tradeoff /venue/[id]'s
 * description already accepts for metadata vs. visible copy.
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { formatPublishedDate } from "@/lib/dataFreshness";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

const FAQ_NUMS = [1, 2, 3, 4, 5, 6] as const;

interface AboutContentProps {
  /** Pre-serialized FAQPage JSON-LD, built in English (#386). */
  faqJsonLd: string;
  /** Live venue count for the "N places" stat line. */
  venueCount: number;
  /** ISO timestamp of the last data publish. */
  publishedAt: string;
}

export default function AboutContent({ faqJsonLd, venueCount, publishedAt }: AboutContentProps) {
  const { locale } = useLocale();

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      {/* FAQPage structured data — English always (#386); mirrors the visible
          FAQ section below only when locale === "en" */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />

      {/* DRAFT COPY — pending final text from Kyle / Pueblo Food Project (#155) */}

      <PageNav locale={locale} />

      {/* Page content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-8">
        <h1
          className="text-3xl font-normal text-[var(--color-ink-900)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("about.heading", locale)}
        </h1>

        {/* Mission */}
        <section aria-labelledby="mission-heading">
          <h2
            id="mission-heading"
            className="text-lg font-semibold text-[var(--color-ink-800)] mb-2"
          >
            {t("about.mission.heading", locale)}
          </h2>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("about.mission.body", locale)}
          </p>
        </section>

        {/* Context stat — why the map matters + current coverage (approved copy, PR4 S8) */}
        <div className="border-l-2 border-[var(--color-sage-500)] pl-4 space-y-2">
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("about.stat.insecurity", locale)}
          </p>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("about.stat.count", locale, { count: String(venueCount) })}
          </p>
          {/* Board review finding #2: map-wide freshness, alongside coverage */}
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("freshness.updated", locale, { date: formatPublishedDate(publishedAt, locale) })}
          </p>
        </div>

        {/* Vision */}
        <section aria-labelledby="vision-heading">
          <h2
            id="vision-heading"
            className="text-lg font-semibold text-[var(--color-ink-800)] mb-2"
          >
            {t("about.vision.heading", locale)}
          </h2>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("about.vision.body", locale)}
          </p>
        </section>

        {/* Origin story */}
        <section aria-labelledby="origin-heading">
          <h2
            id="origin-heading"
            className="text-lg font-semibold text-[var(--color-ink-800)] mb-2"
          >
            {t("about.origin.heading", locale)}
          </h2>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("about.origin.body", locale)}
          </p>
        </section>

        {/* How venues are sourced */}
        <section aria-labelledby="how-we-source-heading">
          <h2
            id="how-we-source-heading"
            className="text-lg font-semibold text-[var(--color-ink-800)] mb-2"
          >
            {t("about.howWeSource.heading", locale)}
          </h2>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("about.howWeSource.body", locale)}
          </p>
        </section>

        {/* FAQ — approved copy (PR4 S8); the JSON-LD above mirrors this text
            verbatim only in English (#386) */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-lg font-semibold text-[var(--color-ink-800)] mb-3">
            {t("about.faq.heading", locale)}
          </h2>
          <div className="space-y-5">
            {FAQ_NUMS.map((n) => (
              <div key={n}>
                <h3 className="text-base font-semibold text-[var(--color-ink-800)] mb-1">
                  {t(`about.faq.q${n}`, locale)}
                </h3>
                <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
                  {t(`about.faq.a${n}`, locale)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Suggest CTA */}
        <section aria-labelledby="suggest-heading" className="pt-2">
          <h2
            id="suggest-heading"
            className="text-lg font-semibold text-[var(--color-ink-800)] mb-2"
          >
            {t("about.suggest.heading", locale)}
          </h2>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mb-4">
            {t("about.suggest.body", locale)}
          </p>
          <Link
            href="/suggest"
            className={
              "inline-block px-4 py-2 text-sm font-medium rounded " +
              "bg-[var(--color-sage-600)] text-white " +
              "hover:bg-[var(--color-sage-700)] transition-colors " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
            }
          >
            {t("about.suggest.cta", locale)}
          </Link>
        </section>
      </div>

      {/* Site footer: links back to map, about, privacy, suggest */}
      <SiteFooter />
    </main>
  );
}
