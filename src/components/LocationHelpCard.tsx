"use client";

/**
 * LocationHelpCard — bottom card explaining why "Find food near me" / "Near me"
 * produced no position, and what still works (#739, mockup option B). Replaces
 * the old top-of-map LocationDeniedBanner: it only covered a refusal on a
 * second tap, so a splash-tap failure dropped visitors on the Pueblo-center map
 * with no explanation, and more than half of them left.
 *
 * Two messages, driven by the geo result:
 *   - denied: the browser won't prompt again, so NO "Try again" — point at the
 *     two things that work without location (tap a pin, the list) and say where
 *     to turn location on next time.
 *   - failed (#738 timeout/unavailable): the person didn't refuse, so offer
 *     "Try again" plus the same two fallbacks.
 *
 * Accessibility:
 *   - role="status" (polite), not the old banner's role="alert": the card is a
 *     non-blocking bottom card, not a blocking dialog, and it appears right
 *     after the splash closes and focus moves to the map — an assertive
 *     interruption would talk over that. It does NOT take focus on mount for
 *     the same reason (the person's next move is the map). Caveat: a live
 *     region that mounts already holding text is announced less reliably than
 *     one that changes, but the old alert had the same exposure under the same
 *     conditional-render pattern.
 *   - Escape dismisses only while this card is the TOPMOST overlay (#527/#604):
 *     it isn't full-screen and Filters/the Menu can open on top of it, so it
 *     shares the overlayRegistry Escape stack instead of its own document
 *     listener.
 *   - 44×44 close X (aria-label from detail.close); action buttons are 48px.
 *   - Hidden (not unmounted) while any full-surface overlay is open, so the
 *     card never floats over the Menu/Filters/venue sheet.
 */

import { useCallback } from "react";
import { MapPin, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { useAnyOverlayOpen, useOverlayEscape } from "@/lib/overlayRegistry";
import type { LocationFailure } from "@/lib/useGeolocation";

interface LocationHelpCardProps {
  /** Which result to explain. "failed" carries the timeout/unavailable reason. */
  failure: LocationFailure;
  /** Re-run the locate flow. Only rendered for "failed". */
  onRetry: () => void;
  /** Switch to the list view (and close the card). */
  onShowList: () => void;
  /** Close the card; the map stays where it is. */
  onDismiss: () => void;
  /**
   * Extra offset for the desktop side panel, px — centres the card in the map
   * area left of it, the same shift BottomNav applies (#682).
   */
  rightInset?: number;
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2";

export default function LocationHelpCard({
  failure,
  onRetry,
  onShowList,
  onDismiss,
  rightInset = 0,
  locale: localeProp,
}: LocationHelpCardProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const overlayOpen = useAnyOverlayOpen();

  const handleEscape = useCallback(() => onDismiss(), [onDismiss]);
  useOverlayEscape(true, handleEscape);

  if (overlayOpen) return null;

  const denied = failure.permission === "denied";
  const lead = denied
    ? t("locationCard.denied.body", locale)
    : t(
        failure.reason === "timeout"
          ? "locationCard.failed.body.timeout"
          : "locationCard.failed.body.unavailable",
        locale,
      );

  return (
    <div
      role="status"
      data-location-help-card=""
      // Per-instance CSS var, same trick as BottomNav (#682): arbitrary-value
      // calc() can't take a number prop, and `left` (not `transform`) keeps
      // the md:-translate-x-1/2 centering intact.
      style={{ ["--panel-right-inset" as string]: `${rightInset}px` }}
      className={
        // Below 2xl the bottom nav is a bar: sit 6px above its top edge
        // (--bottom-nav-clearance is its full height; globals.css keeps it in
        // sync with BOTTOM_NAV_HEIGHT_PX). Safe-area inset first so a
        // home-indicator phone never tucks the card under the nav.
        "absolute z-[1100] left-3 right-3 " +
        "bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-clearance)+6px)] " +
        // 2xl: the nav is a floating pill (24px up + 52px tall); clear it by 12px.
        "2xl:bottom-[88px] " +
        // Phone: full width minus 12px margins (same as the nav). md+: a
        // fixed 420px card centred over the map area, clear of the side panel.
        "md:left-[calc(50%-var(--panel-right-inset,0px)/2)] md:right-auto md:w-[420px] md:-translate-x-1/2 " +
        "flex flex-col gap-2 " +
        // Short landscape phones: scroll inside the card rather than push it
        // over the search bar.
        "max-h-[calc(var(--viewport-small)-160px)] overflow-y-auto " +
        "bg-[var(--color-bone-100)] rounded-[14px] " +
        "border-t-4 border-[var(--color-sage-600)] " +
        "px-4 pt-4 pb-3.5 elevation-2"
      }
    >
      {/* Close X — top-right, 44×44 hit area */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("detail.close", locale)}
        className={
          "absolute top-[2px] right-[2px] w-11 h-11 " +
          "flex items-center justify-center rounded-full " +
          "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-200)] " +
          "transition-colors duration-150 " +
          PRESS_FEEDBACK + " " +
          FOCUS_RING
        }
      >
        <X size={16} aria-hidden />
      </button>

      <div className="flex items-start gap-2 pr-9">
        <MapPin
          size={20}
          aria-hidden
          className="mt-0.5 shrink-0"
          style={{ color: "var(--color-sage-600)" }}
        />
        <h2
          className="text-[18px] leading-snug text-[var(--color-brand-navy)]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {t(denied ? "locationCard.denied.title" : "locationCard.failed.title", locale)}
        </h2>
      </div>

      <p className="text-[14px] leading-relaxed text-[var(--color-ink-700)]">
        {lead} {t("locationCard.tapPin", locale)}
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        {!denied && (
          <button
            type="button"
            onClick={onRetry}
            className={
              "min-h-12 px-[18px] rounded-full " +
              "bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)] " +
              "text-[15px] font-bold leading-none " +
              PRESS_FEEDBACK + " " +
              "transition-[filter] duration-150 " +
              FOCUS_RING
            }
          >
            {t("locationCard.retry", locale)}
          </button>
        )}
        <button
          type="button"
          onClick={onShowList}
          className={
            "min-h-12 px-4 rounded-full " +
            "border-[1.5px] border-[var(--color-sage-600)] bg-transparent " +
            "text-[var(--color-sage-600)] text-[15px] font-bold leading-none " +
            "hover:bg-[var(--color-sage-50)] " +
            "transition-colors duration-150 " +
            PRESS_FEEDBACK + " " +
            FOCUS_RING
          }
        >
          {t("viewSuggestion.seeAsList", locale)}
        </button>
      </div>

      {denied && (
        <p className="text-[13px] leading-snug text-[var(--color-ink-500)]">
          {t("locationCard.denied.hint", locale)}
        </p>
      )}
    </div>
  );
}
