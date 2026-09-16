"use client";

/**
 * SponsorCredit — persistent "Sponsored by Pueblo Food Project" link.
 *
 * Positioned bottom-right of the map container (Mapbox attribution is
 * bottom-left — no conflict). Hidden when BottomSheet is fully expanded
 * so it doesn't stack on mobile.
 *
 * Spec: github.com/kr8vka0z/pueblo-food-map/issues/69
 */

import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";

interface SponsorCreditProps {
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
  /** Hide the credit (e.g. when BottomSheet is fully expanded on mobile). */
  hidden?: boolean;
  /** Lift above the bottom nav bar below 2xl (the map view, not the splash). */
  clearBottomNav?: boolean;
}

export default function SponsorCredit({
  locale: localeProp,
  hidden = false,
  clearBottomNav = false,
}: SponsorCreditProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  return (
    <div
      // Hidden by globals.css while the Mapbox credit text is open beside it.
      data-sponsor-credit=""
      // clearBottomNav (the map): below 2xl the bottom nav bar covers the map's
      // bottom edge, so the credit lifts above it — bar height (78) + 12px +
      // the home-indicator inset (docs/bottom-nav-spec.md §9); 2xl and up it
      // sits back in its corner. The splash has no bar and keeps bottom: 8.
      //
      // On the map the credit shares a row with the Mapbox logo across the
      // screen, so it copies the logo's box: 23px tall, 6px above the control
      // corner (measured on dev at 393×852), text centred in it. Without this
      // the text sat ~6px lower than the logo (Kyle, 2026-09-16).
      className={
        clearBottomNav
          ? "flex items-center h-[23px] bottom-[calc(78px+12px+6px+env(safe-area-inset-bottom))] 2xl:bottom-[6px]"
          : undefined
      }
      style={{
        position: "absolute",
        bottom: clearBottomNav ? undefined : 8,
        right: 8,
        zIndex: 1000,
        display: hidden ? "none" : undefined,
      }}
    >
      <a
        href="https://pueblofoodproject.org/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12 }}
        className={
          "text-[var(--color-ink-500)] " +
          "hover:text-[var(--color-ink-700)] hover:underline " +
          "focus-visible:outline-none focus-visible:underline " +
          "focus-visible:text-[var(--color-ink-700)] " +
          "transition-colors duration-150"
        }
      >
        {t("sponsor.text", locale)}
      </a>
    </div>
  );
}
