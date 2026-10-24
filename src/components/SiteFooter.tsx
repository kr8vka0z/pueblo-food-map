/**
 * SiteFooter — slim navigation footer for static utility pages.
 *
 * WHY: The map homepage has no footer (full-viewport map). Every other
 * public page (/about, /privacy, /suggest, /feedback, /venues, /resources,
 * /venue/<id>) shares this footer so visitors can find the About page and
 * navigate back to the map without hunting. Introduced in #155 (About page).
 *
 * Client component: reads locale from LocaleContext so the language toggle
 * on the map page propagates here consistently with other components.
 */

"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { localizedHref } from "@/lib/localizedHref";
import { OSM_COPYRIGHT_URL } from "@/lib/osmAttribution";
import StyxCredit from "./StyxCredit";

// #711: every link is at least 48×48 (DESIGN.md touch-target floor; short
// labels like "About" get the width from min-w-12). The
// rows carry their own height, so the wrapper has no vertical gap and less
// padding, and a 16px column gap (still well over the 8px between hit areas)
// fits more links per row at 360px — otherwise the footer would roughly
// double in height.
const LINK_CLASS =
  "inline-flex items-center justify-center min-h-12 min-w-12 " +
  "hover:text-[var(--color-ink-700)] transition-colors " +
  "focus-visible:outline-none focus-visible:underline";

export default function SiteFooter() {
  const { locale, tree } = useLocale();

  return (
    <footer className="border-t border-[var(--color-bone-200)] bg-[var(--color-bone-50)]">
      <div className="max-w-lg mx-auto px-4 py-2 flex flex-wrap gap-x-4 text-xs text-[var(--color-ink-400)]">
        <Link
          href={localizedHref("/", tree)}
          className={LINK_CLASS}
        >
          {t("footer.backToMap", locale)}
        </Link>
        {/* /venues and /resources (SEO/AEO plan Phase 0): the footer is the
            crawlable path to the venue directory and, through it, every
            /venue/<id> page — the map's own links only exist after JS runs. */}
        <Link
          href={localizedHref("/venues", tree)}
          className={LINK_CLASS}
        >
          {t("footer.venues", locale)}
        </Link>
        <Link
          href={localizedHref("/resources", tree)}
          className={LINK_CLASS}
        >
          {t("footer.resources", locale)}
        </Link>
        {/* SEO Phase 3 hubs (#709): crawlable links to the three topic pages. */}
        <Link
          href={localizedHref("/food-pantries", tree)}
          className={LINK_CLASS}
        >
          {t("footer.foodPantries", locale)}
        </Link>
        <Link
          href={localizedHref("/snap-wic-stores", tree)}
          className={LINK_CLASS}
        >
          {t("footer.snapWic", locale)}
        </Link>
        <Link
          href={localizedHref("/community-gardens", tree)}
          className={LINK_CLASS}
        >
          {t("footer.gardens", locale)}
        </Link>
        <Link
          href={localizedHref("/blessing-boxes", tree)}
          className={LINK_CLASS}
        >
          {t("footer.boxes", locale)}
        </Link>
        <Link
          href={localizedHref("/about", tree)}
          className={LINK_CLASS}
        >
          {t("footer.about", locale)}
        </Link>
        <Link
          href="/privacy"
          className={LINK_CLASS}
        >
          {t("footer.privacy", locale)}
        </Link>
        <Link
          href="/suggest"
          className={LINK_CLASS}
        >
          {t("footer.suggest", locale)}
        </Link>
        {/* ODbL attribution (#133 4.5) — this footer covers /venues, /about
            and every other SiteFooter page that lists venue data without
            Mapbox's own AttributionControl. Same 48px row as the links above
            (#711; it was min-h-11). */}
        <a
          href={OSM_COPYRIGHT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {t("osm.attribution", locale)}
        </a>
        {/* w-full: its own line under the wrapping row of links. */}
        <StyxCredit locale={locale} className="w-full" />
      </div>
    </footer>
  );
}
