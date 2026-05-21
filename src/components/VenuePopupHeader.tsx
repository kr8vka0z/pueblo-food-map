"use client";

/**
 * VenuePopupHeader — persistent chrome bar for DesktopVenueWindow (issue #64).
 *
 * Always visible in both collapsed and expanded states. Same height (44px) and
 * background in both. Holds:
 *   - Visually left:  text-label toggle button ("Show details" ↔ "Hide details")
 *   - Visually right: X-close button (clears selectedVenueId)
 *
 * Tab order: X-close → Show/Hide details → body content.
 * The X-close is rendered first in DOM order (first in tab order); the toggle
 * follows in DOM order (second in tab order). CSS `order-*` utilities swap their
 * visual positions without touching DOM order. No positive tabIndex values are used.
 *
 * ARIA: toggle carries aria-expanded and aria-controls pointing to the popup body
 * region (id="venue-popup-body-{venueId}"), which is applied by DesktopVenueWindow.
 *
 * Keyboard: Enter/Space activate buttons (browser default for <button>).
 */

import { X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

interface VenuePopupHeaderProps {
  venueId: string;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  locale?: Locale;
}

export default function VenuePopupHeader({
  venueId,
  expanded,
  onToggle,
  onClose,
  locale = "en",
}: VenuePopupHeaderProps) {
  const toggleLabel = expanded
    ? t("detail.hideDetails", locale)
    : t("detail.showDetails", locale);

  const bodyId = `venue-popup-body-${venueId}`;

  return (
    <div
      className={
        "flex items-center gap-2 px-3 shrink-0 " +
        "h-11 border-b border-[var(--color-bone-200)] " +
        "bg-[var(--color-bone-50)]"
      }
    >
      {/* X-close — first in DOM = first in tab order; order-3 = visually rightmost */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("detail.close", locale)}
        className={
          "order-3 flex items-center justify-center w-8 h-8 -mr-1 rounded-md shrink-0 " +
          "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        }
      >
        <X size={16} aria-hidden />
      </button>

      {/* Spacer — order-2 = sits between toggle (order-1) and X-close (order-3) */}
      <div className="order-2 flex-1" />

      {/* Show / Hide details toggle — second in DOM = second in tab order; order-1 = visually leftmost */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className={
          "order-1 flex items-center h-8 px-3 -ml-1 rounded-md " +
          "text-xs font-medium text-[var(--color-sage-600)] " +
          "hover:text-[var(--color-sage-700)] hover:bg-[var(--color-bone-100)] transition-colors " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        }
      >
        {toggleLabel}
      </button>
    </div>
  );
}
