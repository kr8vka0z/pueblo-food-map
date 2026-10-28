"use client";

/**
 * VenuePopupHeader — the header bar of DesktopVenueWindow (issue #64).
 *
 * Holds the X-close (visually right) and, for a blessing box, a "History"
 * link to /box/<id>/history (visually left). The Show/Hide details toggle
 * that used to sit in the left slot is gone (#732): a computer always shows
 * the full card.
 *
 * Tab order: X-close → History → body content. X-close is first in DOM
 * order; CSS `order-*` utilities swap the visual positions without touching
 * DOM order. No positive tabIndex values are used.
 */

import Link from "next/link";
import { X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

interface VenuePopupHeaderProps {
  onClose: () => void;
  locale?: Locale;
  /** Blessing box only: the History link's URL. */
  historyHref?: string;
}

export default function VenuePopupHeader({
  onClose,
  locale = "en",
  historyHref,
}: VenuePopupHeaderProps) {
  const historyClassName =
    "order-1 flex items-center h-8 px-3 -ml-1 rounded-md " +
    "text-xs font-medium text-[var(--color-sage-600)] " +
    "hover:text-[var(--color-sage-700)] hover:bg-[var(--color-bone-100)] transition-colors " +
    PRESS_FEEDBACK + " " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

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
          // 32px -> 44px hit area (this row is already 44px tall, so the new
          // box fills it exactly). Negative margin folds in the pre-existing
          // -mr-1 and cancels the growth so the panel's tight header layout
          // and the icon's position don't move (mobile review #11).
          "order-3 flex items-center justify-center w-11 h-11 " +
          "-mt-1.5 -mb-1.5 -ml-1.5 -mr-[10px] rounded-md shrink-0 " +
          "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
          PRESS_FEEDBACK + " " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        }
      >
        <X size={16} aria-hidden />
      </button>

      {/* Spacer — order-2 = sits between History (order-1) and X-close (order-3) */}
      <div className="order-2 flex-1" />

      {/* History link (blessing box) — second in DOM = second in tab order;
          order-1 = visually leftmost. */}
      {historyHref && (
        <Link href={historyHref} className={historyClassName}>
          {t("box.history.link", locale)}
        </Link>
      )}
    </div>
  );
}
