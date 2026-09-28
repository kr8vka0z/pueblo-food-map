"use client";

/**
 * AboutContent — visible body of /about, including its FAQPage JSON-LD.
 *
 * This SAME component renders on BOTH /about (src/app/(site)/about/page.tsx)
 * and /es/about (src/app/es/about/page.tsx) — the visible mission/FAQ copy
 * reads the tree's locale via useLocale() (#289), while each page.tsx stays a
 * static Server Component (no cookies() read — ARCHITECTURE.md "i18n model",
 * #287).
 *
 * The FAQPage JSON-LD is built server-side by the CALLING page.tsx (English
 * on /about, Spanish on /es/about — #689 supersedes #386's old "JSON-LD is
 * always English" rule with "JSON-LD matches the URL's language") and
 * passed in as a pre-serialized string — always matching this component's
 * visible FAQ text on a mirrored page, since both read the same tree's
 * locale.
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { localizedHref } from "@/lib/localizedHref";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";
import { formatPublishedDate } from "@/lib/dataFreshness";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

const FAQ_NUMS = [1, 2, 3, 4, 5, 6] as const;

interface AboutContentProps {
  /** Pre-serialized FAQPage JSON-LD, matching the caller's tree (#689). */
  faqJsonLd: string;
  /** Live venue count for the "N places" stat line. */
  venueCount: number;
  /** ISO timestamp of the last data publish. */
  publishedAt: string;
}

export default function AboutContent({ faqJsonLd, venueCount, publishedAt }: AboutContentProps) {
  const { locale, tree } = useLocale();
  // <title> follows locale client-side (#589) — SSR's title (page.tsx's
  // metadata, English on /about or Spanish on /es/about — #689) is what
  // search engines and a first paint see; this only corrects it after
  // hydration for a CLIENT-SIDE toggle on the EN page. skip under /es: the
  // server title there is already Spanish, so there's nothing to correct.
  useDocumentTitle(pageDocumentTitle(t("about.documentTitle", locale)), {
    skip: tree === "es",
  });

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      {/* FAQPage structured data — matches the URL's language (#689
          supersedes #386's "always English" rule): the caller (page.tsx /
          es/about/page.tsx) passes locale-appropriate JSON-LD already
          serialized, always mirroring the FAQ section rendered below. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />

      {/* DRAFT COPY — pending final text from Kyle / Pueblo Food Project (#155) */}

      <PageNav locale={locale} backHref={localizedHref("/", tree)} />

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
            className="text-lg font-semibold text-[var(--color-ink-700)] mb-2"
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
            className="text-lg font-semibold text-[var(--color-ink-700)] mb-2"
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
            className="text-lg font-semibold text-[var(--color-ink-700)] mb-2"
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
            className="text-lg font-semibold text-[var(--color-ink-700)] mb-2"
          >
            {t("about.howWeSource.heading", locale)}
          </h2>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {t("about.howWeSource.body", locale)}
          </p>
        </section>

        {/* FAQ — approved copy (PR4 S8); the JSON-LD above mirrors this text
            verbatim, in whichever tree served this page (#689) */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-lg font-semibold text-[var(--color-ink-700)] mb-3">
            {t("about.faq.heading", locale)}
          </h2>
          <div className="space-y-5">
            {FAQ_NUMS.map((n) => (
              <div key={n}>
                <h3 className="text-base font-semibold text-[var(--color-ink-700)] mb-1">
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
            className="text-lg font-semibold text-[var(--color-ink-700)] mb-2"
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
