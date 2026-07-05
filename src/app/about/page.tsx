/**
 * /about — mission, vision, origin story, and how venues are sourced.
 *
 * Static server component: reads locale from cookie (same pattern as other
 * utility pages — privacy, feedback). No form or dynamic data.
 *
 * Copy on this page is DRAFT pending final text from Kyle / Pueblo Food
 * Project (#155). See i18n keys about.* in src/lib/i18n.ts.
 *
 * WHY server component: locale cookie read at request time avoids an ES→EN
 * language flash for Spanish-language visitors (same rationale as /privacy).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { serializeJsonLd, buildFaqJsonLd } from "@/lib/venueSchema";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = buildPageMetadata({
  title: "About",
  description:
    "About Pueblo Food Map — our mission to connect Pueblo County residents with free and low-cost food resources, and how venue data is sourced.",
  path: "/about",
});

export default async function AboutPage() {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("pfm-locale")?.value;
  const locale: Locale = rawLocale === "en" || rawLocale === "es" ? rawLocale : "en";

  // Built once so the visible FAQ and the FAQPage JSON-LD below are guaranteed
  // to render the exact same question/answer pairs — one source, not two
  // copies that could drift (#PR4 S8).
  const faqNums = [1, 2, 3, 4, 5, 6] as const;
  const faqItems = faqNums.map((n) => ({
    question: t(`about.faq.q${n}`, locale),
    answer: t(`about.faq.a${n}`, locale),
  }));

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
      {/* FAQPage structured data — mirrors the visible FAQ section below (#PR4) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildFaqJsonLd(faqItems)) }}
      />

      {/* DRAFT COPY — pending final text from Kyle / Pueblo Food Project (#155) */}

      {/* Top nav bar */}
      <nav className="h-12 flex items-center px-4 border-b border-[var(--color-bone-200)] shrink-0">
        <Link
          href="/"
          className={
            "text-sm font-medium text-[var(--color-sage-600)] " +
            "hover:text-[var(--color-sage-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] rounded"
          }
        >
          ← {t("about.backToMap", locale)}
        </Link>
      </nav>

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
            {t("about.stat.count", locale, { count: String(venues.length) })}
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

        {/* FAQ — approved copy (PR4 S8); mirrored in the FAQPage JSON-LD injected above */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-lg font-semibold text-[var(--color-ink-800)] mb-3">
            {t("about.faq.heading", locale)}
          </h2>
          <div className="space-y-5">
            {faqNums.map((n) => (
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
