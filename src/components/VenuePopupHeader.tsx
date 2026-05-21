"use client";

/**
 * VenuePopupHeader — persistent chrome bar for DesktopVenueWindow (issue #64).
 *
 * Always visible in both collapsed and expanded states. Same height (44px) and
 * background in both. Holds:
 *   - Left: text-label toggle button ("Show details" ↔ "Hide details")
 *   - Right: X-close button (clears selectedVenueId)
 *
 * Tab order: X-close (tabIndex 0) → Show/Hide details (tabIndex 0) → body.
 * The X-close is rendered first in DOM order to be first in tab order; the
 * toggle follows. Both are native <button> elements.
 *
 * Keyboard: Enter/Space activate buttons (browser default for <button>).
 */

import { X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

interface VenuePopupHeaderProps {
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  locale?: Locale;
}

export default function VenuePopupHeader({
  expanded,
  onToggle,
  onClose,
  locale = "en",
}: VenuePopupHeaderProps) {
  const toggleLabel = expanded
    ? t("detail.hideDetails", locale)
    : t("detail.showDetails", locale);

  return (
    <div
      className={
        "flex items-center gap-2 px-3 shrink-0 " +
        "h-11 border-b border-[var(--color-bone-200)] " +
        "bg-[var(--color-bone-50)]"
      }
      style={{ height: "44px" }}
    >
      {/* X-close — first in DOM = first in tab order */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("detail.close", locale)}
        className={
          "flex items-center justify-center w-8 h-8 -ml-1 rounded-md shrink-0 " +
          "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        }
      >
        <X size={16} aria-hidden />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Show / Hide details toggle — second in DOM = second in tab order */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={
          "flex items-center h-8 px-3 -mr-1 rounded-md " +
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
