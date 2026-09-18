"use client";

/**
 * BlessingBoxesMapButton — entry-point candidate "map" (Blessing Boxes
 * slice 4, story B4): a button floating on the map itself, rather than a
 * bottom-nav item (see BottomNav.tsx's `showBoxesItem` prop for the other
 * candidate). Rendered by MapWrapper only when the `?boxEntry=map` preview
 * switch selects it — see that file's own header for both candidate URLs
 * and the default.
 *
 * Positioned bottom-right, clear of BottomNav (bottom-[bar height]) below
 * 2xl and clear of the centred nav pill + Mapbox attribution at 2xl — same
 * safe-area handling BottomNav itself uses. Uses the blessing_box category
 * color (--color-cat-blessing, DESIGN.md's raspberry) so the button reads
 * as "this is about boxes specifically," not a generic action — the same
 * signature color the map's own box pins already use.
 */

import Link from "next/link";
import { Gift } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BOTTOM_NAV_HEIGHT_PX } from "./BottomNav";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

export default function BlessingBoxesMapButton({ locale }: { locale: Locale }) {
  return (
    <Link
      href="/boxes"
      data-testid="map-boxes-button"
      className={
        "fixed z-[999] right-3 " +
        `bottom-[calc(${BOTTOM_NAV_HEIGHT_PX}px+24px+env(safe-area-inset-bottom))] ` +
        "2xl:bottom-24 2xl:right-6 " +
        "flex items-center gap-2 px-4 py-3 rounded-[var(--radius-full)] " +
        "bg-[var(--color-cat-blessing)] text-white text-sm font-semibold " +
        "shadow-[0_4px_16px_rgba(26,24,23,0.14),0_0_0_1px_rgba(26,24,23,0.04)] " +
        "hover:brightness-95 transition-[filter] duration-150 " +
        PRESS_FEEDBACK +
        " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-cat-blessing)]"
      }
    >
      <Gift aria-hidden size={18} />
      <span>{t("nav.boxes", locale)}</span>
    </Link>
  );
}
