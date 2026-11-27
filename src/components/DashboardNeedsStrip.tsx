/**
 * DashboardNeedsStrip — the admin Dashboard's "Needs you" strip (#680),
 * link cards (issue #680's Layout item 2). Each card is a plain navigation
 * Link to the queue it summarizes — no client state, no mutation here, this
 * strip only counts and points.
 *
 * The cards, their counts, hrefs and optional `detail` breakdown strings are
 * all built by the caller (src/app/(site)/admin/page.tsx), not hardcoded
 * here, so this component doesn't need to know which queues exist.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { focusRingClass, tileCardClass, tileLabelClass } from "@/lib/adminCardStyles";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

export interface NeedsCardData {
  key: string;
  label: string;
  count: number;
  href: string;
  /** A one-line breakdown shown under the count — e.g. "3 to review, 2 data changes" for a combined fallback card. Optional: the "waiting to publish"/"boxes empty or low" cards have nothing to break down. */
  detail?: string;
}

export interface DashboardNeedsStripProps {
  cards: readonly NeedsCardData[];
}

export default function DashboardNeedsStrip({ cards }: DashboardNeedsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className={`${tileCardClass} group flex min-h-12 touch-manipulation flex-col gap-1 transition-colors duration-150 hover:bg-[var(--color-sage-100)] ${PRESS_FEEDBACK} ${focusRingClass}`}
        >
          <span className="flex items-start justify-between gap-2">
            <span className={tileLabelClass}>{card.label}</span>
            <ChevronRight
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-sage-700)] transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </span>
          <span
            className={
              card.count > 0
                ? "text-2xl font-semibold tabular-nums text-[var(--color-ink-900)]"
                : "text-2xl font-semibold tabular-nums text-[var(--color-ink-500)]"
            }
          >
            {card.count}
          </span>
          {card.detail && <span className="text-xs text-[var(--color-ink-500)]">{card.detail}</span>}
        </Link>
      ))}
    </div>
  );
}
