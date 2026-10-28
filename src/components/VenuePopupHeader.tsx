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
    // before:* — the 32px link (6px below the bar's top) gets a 48px hit area
    // from the bar's top edge down 4px into the body (#827). Growing upward
    // would be clipped by DesktopVenueWindow's overflow-hidden, or overlap
    // the "← Saved" row above.
    "order-1 relative before:absolute before:inset-x-0 before:-top-1.5 before:-bottom-2.5 flex items-center h-8 px-3 -ml-1 rounded-md " +
    "text-xs font-medium text-[var(--color-sage-600)] " +
    "hover:text-[var(--color-sage-700)] hover:bg-[var(--color-bone-100)] transition-colors " +
    PRESS_FEEDBACK + " " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

  return (
    <div
      className={
        // relative z-10: the Close/History hit areas reach 4px into the body
        // below; without a layer of their own, a positioned element there
        // (BoxPhotoHero's wrapper) paints over them and takes the tap.
        "relative z-10 flex items-center gap-2 px-3 shrink-0 " +
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
          // before:* — invisible overlay takes the 44px box to the 48px floor
          // without moving the icon (#827): 2px each side, and 4px down into
          // the body rather than up, where the box already touches the bar's
          // top edge (see the History link above).
          "order-3 relative before:absolute before:-inset-x-0.5 before:top-0 before:-bottom-1 flex items-center justify-center w-11 h-11 " +
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
