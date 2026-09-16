/**
 * PageTopNav — the top bar on the pages the Menu opens (About, Suggest,
 * Feedback, Browse all venues, Food help programs).
 *
 * WHY two links: these pages have no bottom nav, so "Back to map" used to be
 * the only way out and it closed the Menu — reaching a second Menu item meant
 * reopening it. "Back to menu" returns to the map with the Menu already open
 * (`/?menu=1`, read by HomePageClient). Kyle picked this over a bottom bar on
 * every page, 2026-09-16.
 */

"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] ";

export default function PageTopNav({ locale }: { locale: Locale }) {
  return (
    <nav className="h-14 flex items-center justify-between gap-3 px-4 border-b border-[var(--color-bone-200)] shrink-0">
      <Link
        href="/"
        className={
          "text-sm font-medium text-[var(--color-sage-600)] " +
          "hover:text-[var(--color-sage-700)] transition-colors rounded " +
          FOCUS
        }
      >
        ← {t("footer.backToMap", locale)}
      </Link>
      <Link
        href="/?menu=1"
        className={
          "inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full " +
          "text-sm font-medium text-[var(--color-sage-700)] " +
          "border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] " +
          "hover:border-[var(--color-sage-700)] transition-colors " +
          FOCUS
        }
      >
        <Menu size={16} aria-hidden />
        {t("nav.backToMenu", locale)}
      </Link>
    </nav>
  );
}
