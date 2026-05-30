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
 * Placement: bottom-center, floating above the bottom sheet (mobile) and
 * above the Mapbox attribution (desktop). Hidden when the sheet is at the
 * full 90vh snap (map mostly covered) to avoid overlap with sheet content.
 *
 * Styling: mirrors the SplashScreen CTA — orange pill, navy text.
 * Fades/slides in & out; respects prefers-reduced-motion.
 *
 * Positioning constants (easy to tune for live review):
 *   BOTTOM_OFFSET_DEFAULT_PX — distance from the viewport bottom, no sheet
 *   BOTTOM_OFFSET_SHEET_PEEK_PX — extra clearance above the peek bar (88px)
 */

import { Locate, LocateFixed, Loader2 } from "lucide-react";
import type { GeoState } from "@/lib/useGeolocation";
import { t, type Locale } from "@/lib/i18n";

// ─── Tunable layout constants ─────────────────────────────────────────────────

/** px from viewport bottom when no bottom sheet is visible (desktop + mobile no-sheet). */
export const BOTTOM_OFFSET_DEFAULT_PX = 24;

/** px from viewport bottom on mobile when the peek bar (88px) is showing.
 *  The peek bar sits at the bottom; add a small gap above it. */
export const BOTTOM_OFFSET_SHEET_PEEK_PX = 88 + 12; // peek bar height + gap

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
  locale = "en",
}: LocateButtonProps) {
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

  // Bottom offset depends on whether the mobile bottom sheet peek bar is visible
  const bottomPx = sheetVisible
    ? BOTTOM_OFFSET_SHEET_PEEK_PX
    : BOTTOM_OFFSET_DEFAULT_PX;

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
        bottom: bottomPx,
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
        "transition-[opacity,transform,bottom] duration-200",
        "motion-safe:animate-[locateButtonIn_200ms_ease-out]",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
