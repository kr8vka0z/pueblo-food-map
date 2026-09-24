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
import { OSM_COPYRIGHT_URL } from "@/lib/osmAttribution";

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
        {/* ODbL attribution (#133 4.5) — this footer covers /venues, /about
            and every other SiteFooter page that lists venue data without
            Mapbox's own AttributionControl. min-h-11 matches this repo's
            established inline-text-link touch target (DESIGN.md, "Venue
            phone link"). */}
        <a
          href={OSM_COPYRIGHT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={
            "inline-flex items-center min-h-11 " +
            "hover:text-[var(--color-ink-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:underline"
          }
        >
          {t("osm.attribution", locale)}
        </a>
      </div>
    </footer>
  );
}
