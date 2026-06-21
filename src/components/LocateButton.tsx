"use client";

/**
 * LocateButton — v3 bottom-center location control (#108).
 *
 * Single morphing pill, three visible states:
 *   findFood  — no location yet; label "Find food near me"; always visible
 *   locating  — geolocation in flight; spinner + "Locating…"
 *   reCenter  — located but user has panned so the dot is off-screen; label "Re-center"
 *   hidden    — located AND the dot is on-screen; button is not rendered
 *
 * Placement: mobile — top-center, just below the search bar so it never
 * overlaps the venue bottom-sheet. Desktop — bottom-center, above the Mapbox
 * attribution. Still hidden when the venue sheet is fully expanded.
 *
 * Styling: mirrors the SplashScreen CTA — orange pill, navy text.
 * Fades/slides in & out; respects prefers-reduced-motion.
 *
 * Positioning constants (easy to tune for live review):
 *   BOTTOM_OFFSET_DEFAULT_PX — desktop: distance from the viewport bottom
 *   TOP_OFFSET_MOBILE_PX — mobile: distance from the viewport top (below search)
 */

import { Locate, LocateFixed, Loader2 } from "lucide-react";
import type { GeoState } from "@/lib/useGeolocation";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";

// ─── Tunable layout constants ─────────────────────────────────────────────────

/** px from viewport bottom — desktop placement (bottom-center). */
export const BOTTOM_OFFSET_DEFAULT_PX = 24;

/** px from viewport top — mobile placement, just below the search bar
 *  (top-4 = 16px + ~44px bar + gap), so the button never overlaps the venue
 *  bottom-sheet (#122 follow-up). */
export const TOP_OFFSET_MOBILE_PX = 72;

// ─── Props ────────────────────────────────────────────────────────────────────

export type LocateButtonVariant = "findFood" | "locating" | "reCenter" | "hidden";

interface LocateButtonProps {
  /** Current geolocation state from useGeolocation. */
  geoState: GeoState;
  /** Whether a geolocation request is currently in flight. */
  isLocating: boolean;
  /** Whether the user-dot has drifted off the visible map area. */
  isDrifted: boolean;
  /** Called when the user taps the button. */
  onRequest: () => void;
  /** True on mobile with the bottom sheet showing (not fully expanded). */
  sheetVisible?: boolean;
  /** True when the bottom sheet is at the full 90vh snap — hide the button. */
  sheetFullyExpanded?: boolean;
  /** Locale for i18n. Defaults to "en". */
  locale?: Locale;
}

// ─── LocateButton ─────────────────────────────────────────────────────────────

export default function LocateButton({
  geoState,
  isLocating,
  isDrifted,
  onRequest,
  sheetVisible = false,
  sheetFullyExpanded = false,
  locale: localeProp,
}: LocateButtonProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  // Determine which variant to show
  const variant: LocateButtonVariant = (() => {
    if (sheetFullyExpanded) return "hidden";
    if (isLocating) return "locating";
    if (geoState.permission === "granted" && geoState.position !== null) {
      // Located — show Re-center only if the dot has drifted off-screen
      return isDrifted ? "reCenter" : "hidden";
    }
    // Not yet located (prompt or denied): always show Find food
    return "findFood";
  })();

  if (variant === "hidden") return null;

  // Placement: on mobile (sheetVisible) anchor just below the search bar so the
  // button never overlaps the venue bottom-sheet; on desktop, bottom-center.
  const placement = sheetVisible
    ? { top: TOP_OFFSET_MOBILE_PX }
    : { bottom: BOTTOM_OFFSET_DEFAULT_PX };

  const label =
    variant === "locating"
      ? t("locate.locating", locale)
      : variant === "reCenter"
        ? t("locate.recenter", locale)
        : t("splash.cta.primary", locale); // "Find food near me" — reuse splash CTA key

  const ariaLabel =
    variant === "locating"
      ? t("locate.locating", locale)
      : variant === "reCenter"
        ? t("locate.recenter", locale)
        : t("splash.cta.primary", locale);

  const icon =
    variant === "locating" ? (
      <Loader2
        size={18}
        aria-hidden
        className="animate-spin motion-reduce:animate-none shrink-0"
      />
    ) : variant === "reCenter" ? (
      <LocateFixed size={18} aria-hidden className="shrink-0" />
    ) : (
      <Locate size={18} aria-hidden className="shrink-0" />
    );

  return (
    <button
      type="button"
      onClick={variant !== "locating" ? onRequest : undefined}
      disabled={variant === "locating"}
      aria-label={ariaLabel}
      aria-busy={variant === "locating"}
      data-testid="locate-button"
      data-variant={variant}
      style={{
        position: "absolute",
        ...placement,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
      }}
      className={[
        // Orange pill, navy text — mirrors SplashScreen CTA exactly
        "flex items-center gap-2",
        "px-5 py-3 rounded-full",
        "bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)]",
        "text-sm font-semibold leading-none",
        "whitespace-nowrap",
        // Hover / active states
        "hover:brightness-105 active:brightness-95",
        variant !== "locating" ? "cursor-pointer" : "cursor-default",
        // Focus ring
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-[var(--color-brand-orange)]",
        // Elevation
        "elevation-2",
        // Fade + slide in/out animation — respects prefers-reduced-motion
        "transition-[opacity,transform,top,bottom] duration-200",
        "motion-safe:animate-[locateButtonIn_200ms_ease-out]",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
