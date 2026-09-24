"use client";

/**
 * FeedbackPageContent — visible body of /feedback.
 *
 * Extracted from src/app/feedback/page.tsx so the page's text (and
 * FeedbackForm, which now reads useLocale() itself — #289) reflects the
 * visitor's locale while the page stays a static Server Component (no
 * cookies() read — ARCHITECTURE.md "Known bilingual limitation", #287).
 */

import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";
import FeedbackForm from "@/components/FeedbackForm";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

export default function FeedbackPageContent() {
  const { locale } = useLocale();
  // <title> follows locale client-side (#589) — feedback.documentTitle
  // matches page.tsx's metadata title exactly ("Send Feedback").
  useDocumentTitle(pageDocumentTitle(t("feedback.documentTitle", locale)));

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />

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
