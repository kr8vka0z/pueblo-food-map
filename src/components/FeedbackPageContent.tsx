"use client";

/**
 * FeedbackPageContent — visible body of /feedback.
 *
 * Extracted from src/app/feedback/page.tsx so the page's text (and
 * FeedbackForm, which now reads useLocale() itself — #289) reflects the
 * visitor's locale while the page stays a static Server Component (no
 * cookies() read — AGENTS.md "Known bilingual limitation", #287).
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import FeedbackForm from "@/components/FeedbackForm";
import SiteFooter from "@/components/SiteFooter";

export default function FeedbackPageContent() {
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
          ← {t("feedback.backToMap", locale)}
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8">
        <h1
          className="text-2xl font-normal text-[var(--color-ink-900)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("feedback.title", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mb-6">
          {t("feedback.subtitle", locale)}
        </p>

        {/* Client form component */}
        <FeedbackForm />

        {/* Fallback email link */}
        <p className="mt-6 text-xs text-center text-[var(--color-ink-400)]">
          {t("feedback.fallback", locale)}
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
