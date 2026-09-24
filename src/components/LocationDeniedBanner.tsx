"use client";

/**
 * LocationDeniedBanner — v2 permission-denied overlay.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md
 *   §Mobile·375×812·location-denied
 *   §Desktop·1440×900·location-denied
 *
 * Appears when the user actively re-taps the locate button and geolocation is
 * denied. Does NOT appear on initial mount when permission was previously
 * denied (silent Pueblo-center fallback on revisit).
 *
 * Accessibility:
 *   - role="alert" — aggressive screen reader announcement
 *   - Primary action receives focus on mount
 *   - Escape key dismisses the banner — only while this banner is the
 *     TOPMOST overlay (#527/#604 CI-review follow-up): this banner isn't
 *     full-screen and nothing blocks opening Filters/the Menu on top of it,
 *     so it shares the same "own independent document Escape listener"
 *     failure mode #527 fixed for FilterPanel/HamburgerMenu/
 *     DesktopVenueWindow/BottomSheet — see overlayRegistry.ts's header.
 *   - Close X has a 32×32 hitbox with aria-label="Dismiss"
 */

import { useCallback, useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { useOverlayEscape } from "@/lib/overlayRegistry";

interface LocationDeniedBannerProps {
  /** Re-request geolocation. If denied again, the parent's useEffect re-triggers. */
  onRetry: () => void;
  /** Dismiss the banner. Map stays at Pueblo center. */
  onDismiss: () => void;
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
}

export default function LocationDeniedBanner({
  onRetry,
  onDismiss,
  locale: localeProp,
}: LocationDeniedBannerProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const retryRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action when the banner mounts.
  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  // Escape key dismisses the banner — only when it's the topmost overlay
  // (#527/#604). Mounted only while visible (no `open` prop — MapWrapper.tsx
  // conditionally renders this component entirely), so it registers
  // unconditionally (`true`), same shape as DesktopVenueWindow.tsx.
  const handleEscape = useCallback(() => {
    onDismiss();
  }, [onDismiss]);
  useOverlayEscape(true, handleEscape);

  return (
    /*
     * Outer positioner: absolute, horizontally centered below the search bar.
     * top offset clears it (64px gap) and tracks its safe-area-shifted top.
     * Mobile: full width minus 16px margins on each side (left-4 right-4).
     * Desktop (md+): fixed 420px centered.
     */
    <div
      className={
        "absolute top-[calc(64px+max(1rem,env(safe-area-inset-top)))] left-4 right-4 " +
        "md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2 " +
        "z-[1100]"
      }
      role="alert"
      aria-live="assertive"
    >
      {/* Banner card */}
      <div
        className={
          "relative flex flex-col gap-3 " +
          "rounded-[var(--radius-md)] " +
          "bg-[var(--color-bone-100)] " +
          "border-l-4 border-l-[var(--color-clay-700)] " +
          "px-4 py-[18px] " +
          "elevation-2"
        }
      >
        {/* Close X — top-right, 32×32 hitbox */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("detail.close", locale)}
          className={
            // 32px -> 44px hit area. This box is absolutely positioned via
            // top/right, so growth is compensated by moving the anchor inward
            // by half the size delta (6px) instead of a margin — that keeps
            // the box's center, and therefore the icon, pinned to the same
            // spot (mobile review #11).
            "absolute top-[2px] right-[2px] " +
            "w-11 h-11 " +
            "flex items-center justify-center " +
            "rounded-full " +
            "text-[var(--color-ink-500)] " +
            "hover:bg-[var(--color-bone-200)] " +
            "transition-colors duration-150 " +
            PRESS_FEEDBACK + " " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-1"
          }
        >
          <X size={16} aria-hidden />
        </button>

        {/* Header row: icon + title */}
        <div className="flex items-start gap-2 pr-8">
          <AlertTriangle
            size={20}
            aria-hidden
            className="mt-0.5 shrink-0"
            style={{ color: "var(--color-clay-500)" }}
          />
          <h2
            className="text-[18px] leading-snug font-[var(--font-display)] text-[var(--color-brand-navy)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("banner.title", locale)}
          </h2>
        </div>

        {/* Body copy */}
        <p
          className="text-[14px] leading-relaxed text-[var(--color-ink-700)]"
        >
          {t("banner.body", locale)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-1">
          {/* Primary: Try again — orange bg, navy text, pill */}
          <button
            ref={retryRef}
            type="button"
            onClick={onRetry}
            className={
              "px-4 py-2 " +
              "rounded-full " +
              "bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)] " +
              "text-[14px] font-semibold leading-none " +
              "hover:opacity-90 active:scale-95 " +
              "transition-[opacity,transform] duration-150 " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
            }
          >
            {t("banner.retry", locale)}
          </button>

          {/* Tertiary: Browse Pueblo map — text link */}
          <button
            type="button"
            onClick={onDismiss}
            className={
              "text-[14px] leading-none text-[var(--color-ink-500)] " +
              "underline underline-offset-2 " +
              "hover:text-[var(--color-ink-700)] " +
              "transition-colors duration-150 " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
              "rounded-sm"
            }
          >
            {t("banner.dismiss", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
