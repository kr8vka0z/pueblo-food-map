"use client";

/**
 * NotFoundContent — visible body of the branded 404 page.
 *
 * Extracted from src/app/not-found.tsx so the page's text can read the
 * visitor's locale via useLocale() (#289) without forcing not-found.tsx to
 * read a cookie server-side — see that file's header comment for the
 * static-caching rationale (AGENTS.md "Known bilingual limitation", #287).
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";

export default function NotFoundContent() {
  const { locale } = useLocale();
  // <title> follows locale client-side (#589) — notfound.documentTitle
  // matches not-found.tsx's metadata title exactly ("Page Not Found").
  useDocumentTitle(pageDocumentTitle(t("notfound.documentTitle", locale)));

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)] items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-8 shadow-sm">
        <h1
          className="text-3xl font-normal text-[var(--color-ink-900)] mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("notfound.title", locale)}
        </h1>
        <p className="text-base text-[var(--color-ink-500)] mb-6 leading-relaxed">
          {t("notfound.body", locale)}
        </p>
        <Link
          href="/"
          className={
            "inline-flex items-center justify-center px-5 py-2.5 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-600)] text-white text-sm font-medium " +
            "hover:bg-[var(--color-sage-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          ← {t("notfound.backToMap", locale)}
        </Link>
      </div>
    </main>
  );
}
