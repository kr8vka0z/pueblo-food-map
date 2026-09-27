/**
 * DashboardNeedsStrip — the admin Dashboard's "Needs you" strip (#680),
 * four link cards replacing today's NeedsDecisionPanel / needs-help list /
 * stale-places blocks (issue #680's own Layout item 2). Each card is a
 * plain navigation Link to the queue it summarizes — no client state, no
 * mutation here, this strip only counts and points.
 *
 * Two of the four cards are TEMPORARY fallbacks until #674/#675 (fold Data
 * refresh + Review queue into the Places list) and #677 (fold Photo review
 * + Sponsor requests into the Blessing Boxes tab) land — see each card's
 * own `detail` string, built by the caller (src/app/admin/page.tsx), not
 * hardcoded here, so this component doesn't need to know which upstream
 * issue is open.
 */

import Link from "next/link";

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
          className="elevation-1 flex min-h-11 flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 transition-colors duration-150 hover:bg-[var(--color-bone-100)]"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-500)]">{card.label}</span>
          <span
            className={
              card.count > 0
                ? "text-2xl font-semibold text-[var(--color-ink-900)]"
                : "text-2xl font-semibold text-[var(--color-ink-500)]"
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
