"use client";

/**
 * RouteStrip — the collapsed bottom-sheet state shown on phone while a
 * walking route is active (#509). Kyle, 2026-09-19: starting a walking route
 * from ANY venue card (a blessing box's address tap or an ordinary place's
 * Walk button) used to leave the full-height card covering the map, with no
 * way to see the route or get back to the card. This strip replaces the full
 * card's content while a route is drawn: place name, distance/time, "Clear
 * route", and "Show card" (which restores the full card).
 *
 * BottomSheet.tsx owns the vaul mechanics that make this reachable three
 * ways (starting a route, dragging the full card down, or the Show card
 * button) — see that file's own header for the snapPoints/dismissible
 * wiring. This component is presentation-only: no state, no vaul awareness.
 */

import { ChevronUp } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import type { RouteInfo } from "@/components/DirectionButtons";

/**
 * Fixed pixel height of the strip. vaul's snapPoints accept a CSS px string
 * ("112px") but NOT calc() — so this can't include env(safe-area-inset-bottom)
 * the way the rest of the app pads for the home-indicator area. A fixed
 * buffer is baked in below instead.
 *
 * BottomSheet.tsx imports this SAME constant for its snap point so the two
 * numbers can never drift apart (a strip taller/shorter than its own snap
 * point would either clip content or leave a dead gap above the strip).
 *
 * ponytail: not exact on notched phones (the safe-area buffer is a fixed
 * guess, not the real inset) — tune during live review if the strip ever
 * visibly crowds the home indicator on a real device.
 */
export const ROUTE_STRIP_HEIGHT_PX = 112;

interface RouteStripProps {
  venueName: string;
  routeInfo: RouteInfo | null;
  locale: Locale;
  /** "Show card" — restores the full card. Drag-up does the same via vaul; this is the tap affordance. */
  onShowCard: () => void;
  /** "Clear route" — same callback DirectionButtons/BoxCardBody's own clear control uses. */
  onClearRoute?: () => void;
}

const linkClass =
  "py-1.5 text-sm font-medium text-[var(--color-sage-600)] " +
  "hover:text-[var(--color-sage-700)] underline-offset-2 hover:underline " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded";

export default function RouteStrip({ venueName, routeInfo, locale, onShowCard, onClearRoute }: RouteStripProps) {
  return (
    <div
      data-testid="route-strip"
      style={{ height: ROUTE_STRIP_HEIGHT_PX }}
      className="flex flex-col justify-center gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="min-w-0 flex-1 truncate text-base font-medium text-[var(--color-ink-900)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {venueName}
        </p>
        {routeInfo && (
          <p data-testid="route-strip-info" className="shrink-0 text-sm font-semibold text-[var(--color-sage-700)]">
            {t("directions.routeDistance", locale, { distance: routeInfo.distance })}
            {" · "}
            {t("directions.routeDuration", locale, { duration: routeInfo.duration })}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        {onClearRoute ? (
          <button type="button" data-testid="route-strip-clear" onClick={onClearRoute} className={linkClass}>
            {t("directions.clearRoute", locale)}
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          data-testid="route-strip-show-card"
          onClick={onShowCard}
          className={`flex items-center gap-1 ${linkClass}`}
        >
          {t("directions.showCard", locale)}
          <ChevronUp size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
