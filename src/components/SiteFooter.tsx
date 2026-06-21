/**
 * SiteFooter — slim navigation footer for static utility pages.
 *
 * WHY: The map homepage has no footer (full-viewport map). Utility pages
 * (/about, /privacy, /suggest, /feedback) share this footer so visitors
 * can find the About page and navigate back to the map without hunting.
 * Introduced in #155 (About page).
 *
 * Client component: reads locale from LocaleContext so the language toggle
 * on the map page propagates here consistently with other components.
 */

"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";

export default function SiteFooter() {
  const { locale } = useLocale();

  return (
    <footer className="border-t border-[var(--color-bone-200)] bg-[var(--color-bone-50)]">
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--color-ink-400)]">
        <Link
          href="/"
          className={
            "hover:text-[var(--color-ink-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:underline"
          }
        >
          {t("footer.backToMap", locale)}
        </Link>
        <Link
          href="/about"
          className={
            "hover:text-[var(--color-ink-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:underline"
          }
        >
          {t("footer.about", locale)}
        </Link>
        <Link
          href="/privacy"
          className={
            "hover:text-[var(--color-ink-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:underline"
          }
        >
          {t("footer.privacy", locale)}
        </Link>
        <Link
          href="/suggest"
          className={
            "hover:text-[var(--color-ink-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:underline"
          }
        >
          {t("footer.suggest", locale)}
        </Link>
      </div>
    </footer>
  );
}
