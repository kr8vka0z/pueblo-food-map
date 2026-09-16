"use client";

/**
 * PrivacyContent — visible body of /privacy.
 *
 * Extracted from src/app/privacy/page.tsx so the page's text reads the
 * visitor's locale via useLocale() (#289) while the page itself stays a
 * static Server Component (no cookies() read — AGENTS.md "Known bilingual
 * limitation", #287).
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import SiteFooter from "@/components/SiteFooter";

export default function PrivacyContent() {
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
          className="text-2xl font-normal text-[var(--color-ink-900)] mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("privacy.heading", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
          {t("privacy.body", locale)}
        </p>
        {/*
          Analytics is its own paragraph rather than more sentences appended to
          privacy.body: it describes a different actor (Cloudflare, not this
          site's forms), and the two were already long enough that one <p>
          buried the point a reader comes to this page for.
        */}
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-4">
          {t("privacy.analytics", locale)}
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
