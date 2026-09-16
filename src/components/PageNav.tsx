/**
 * PageNav — navigation on the pages the Menu opens (About, Suggest, Feedback,
 * Browse all venues, Food help programs).
 *
 * WHY the bottom nav lives here too: these pages used to offer only "Back to
 * map", which closed the Menu, so reaching a second Menu item meant reopening
 * it. A "Back to menu" link (/?menu=1) fixed the steps but flashed the map on
 * the way (Kyle, 2026-09-16), so the same BottomNav + drawer the map uses now
 * sit on every one of these pages: Menu and Saved open right over the page.
 *
 * What each nav item does off the map:
 *   - Menu / Saved — open the drawer in place (same HamburgerMenu).
 *   - Resources    — its page, as on the map (highlighted when you're on it).
 *   - Near me      — the map, locating you (/?near=1, read by HomePageClient).
 *   - A saved place — the map, opened on that pin (/?venue=<id>).
 * "Show welcome screen" is map-only (the splash lives there), so the drawer
 * omits it here.
 *
 * The page's <main> must clear the fixed bar at its bottom — see PAGE_NAV_CLEARANCE.
 */

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BottomNav, { type MenuSection } from "./BottomNav";
import HamburgerMenu from "./HamburgerMenu";
import { t, type Locale } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import { venues } from "@/data/venues";

/**
 * Classes for a page's <main> so its end clears the fixed nav: bottom padding
 * for the pill (below 2xl) / the floating 2xl pill. shrink-0 is load-bearing:
 * <body> is a full-height flex column, so without it <main> shrinks to the
 * viewport, its content overflows, and the padding lands mid-page — the
 * footer ended up under the nav (measured on dev /about at 393×852).
 */
export const PAGE_NAV_CLEARANCE = "shrink-0 pb-[calc(76px+env(safe-area-inset-bottom))] 2xl:pb-24";

const NO_GEO = { permission: "prompt", position: null } as const;

export default function PageNav({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [section, setSection] = useState<MenuSection | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const favoriteIds = useFavorites();
  const savedVenues = useMemo(() => {
    const ids = new Set(favoriteIds);
    return venues.filter((v) => ids.has(v.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [favoriteIds]);

  const handleSectionTap = useCallback((s: MenuSection) => {
    setSection((current) => (current === s ? null : s));
  }, []);
  const handleClose = useCallback(() => setSection(null), []);

  return (
    <>
      <nav className="h-12 flex items-center px-4 border-b border-[var(--color-bone-200)] shrink-0">
        <Link
          href="/"
          className={
            "text-sm font-medium text-[var(--color-sage-600)] " +
            "hover:text-[var(--color-sage-700)] transition-colors rounded " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          ← {t("footer.backToMap", locale)}
        </Link>
      </nav>

      <HamburgerMenu
        locale={locale}
        open={section !== null}
        onClose={handleClose}
        view={section ?? "top"}
        savedVenues={savedVenues}
        onSelectVenue={(id) => router.push(`/?venue=${encodeURIComponent(id)}`)}
        ignoreOutsideRef={navRef}
      />

      <BottomNav
        locale={locale}
        openSection={section}
        onSectionTap={handleSectionTap}
        geoState={NO_GEO}
        isLocating={false}
        isDrifted={false}
        onNearMe={() => router.push("/?near=1")}
        navRef={navRef}
        onResourcesPage={pathname === "/resources"}
      />
    </>
  );
}
