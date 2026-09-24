"use client";

/**
 * PrivacyContent — visible body of /privacy.
 *
 * Extracted from src/app/privacy/page.tsx so the page's text reads the
 * visitor's locale via useLocale() (#289) while the page itself stays a
 * static Server Component (no cookies() read — AGENTS.md "Known bilingual
 * limitation", #287).
 *
 * Rewritten for Blessing Boxes slice 6 (adopt-a-box + email alerts): the
 * old single "privacy.body" paragraph is replaced by three headed sections
 * — "What we collect" (privacy.collect.*, the old body's content, updated
 * wording), "Blessing box check-ins" (privacy.checkins.*, new), and "Email
 * alerts and adopting a box" (privacy.alerts.*, new, 4 paragraphs) — each
 * paragraph its own i18n key, per the task's own instruction. The analytics
 * paragraph (privacy.analytics) is unchanged and kept last.
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";
import SiteFooter from "@/components/SiteFooter";

export default function PrivacyContent() {
  const { locale } = useLocale();
  // <title> follows locale client-side (#589) — privacy.heading's EN value
  // ("Privacy") matches page.tsx's metadata title exactly.
  useDocumentTitle(pageDocumentTitle(t("privacy.heading", locale)));

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
        <h2 className="text-lg font-medium text-[var(--color-ink-900)] mt-6 mb-2">
          {t("privacy.collect.heading", locale)}
        </h2>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
          {t("privacy.collect.body", locale)}
        </p>

        <h2 className="text-lg font-medium text-[var(--color-ink-900)] mt-6 mb-2">
          {t("privacy.checkins.heading", locale)}
        </h2>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
          {t("privacy.checkins.body", locale)}
        </p>

        <h2 className="text-lg font-medium text-[var(--color-ink-900)] mt-6 mb-2">
          {t("privacy.alerts.heading", locale)}
        </h2>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
          {t("privacy.alerts.body1", locale)}
        </p>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-2">
          {t("privacy.alerts.body2", locale)}
        </p>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-2">
          {t("privacy.alerts.body3", locale)}
        </p>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-2">
          {t("privacy.alerts.body4", locale)}
        </p>

        {/*
          Analytics is its own paragraph, kept last and UNCHANGED (slice 6
          task's own instruction) — same plain <p>, no heading, as before
          this rewrite: it describes a different actor (Cloudflare, not this
          site's forms/boxes), so it doesn't belong folded into any of the
          sections above, but it wasn't asked to gain a heading either.
        */}
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-6">
          {t("privacy.analytics", locale)}
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
