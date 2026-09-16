"use client";

/**
 * ReportPageContent — visible body of /report/[venueId].
 *
 * Extracted from src/app/report/[venueId]/page.tsx so the page's text (and
 * ReportForm, which now reads useLocale() itself — #289) reflects the
 * visitor's locale while the page stays statically generated
 * (generateStaticParams + dynamicParams = false, unchanged by this
 * extraction — no cookies() read, AGENTS.md "Known bilingual limitation",
 * #287).
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import ReportForm from "@/components/ReportForm";
import type { Venue } from "@/types/venue";

interface ReportPageContentProps {
  venue: Venue;
}

export default function ReportPageContent({ venue }: ReportPageContentProps) {
  const { locale } = useLocale();

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
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
          ← {t("report.backToMap", locale)}
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8">
        <h1
          className="text-2xl font-normal text-[var(--color-ink-900)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("report.title", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mb-6">
          {t("report.subtitle", locale)}
        </p>

        {/* Venue context header */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-bone-200)] bg-white p-4 mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
            {t("report.venueLabel", locale)}
          </p>
          <p className="text-base font-medium text-[var(--color-ink-900)]">
            {venue.name}
          </p>
          <p className="text-sm text-[var(--color-ink-500)]">{venue.address}</p>
        </div>

        {/* Client form component */}
        <ReportForm
          venueId={venue.id}
          venueName={venue.name}
          venueAddress={venue.address}
        />

        {/* Fallback email link */}
        <p className="mt-6 text-xs text-center text-[var(--color-ink-400)]">
          {t("report.fallback", locale)}
        </p>
      </div>
    </main>
  );
}
