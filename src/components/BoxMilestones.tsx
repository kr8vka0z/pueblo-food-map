"use client";

/**
 * BoxMilestones — Blessing Boxes slice 7 ("Numbers"), network-wide section
 * only. Renders the "community milestone moments" line(s) from
 * src/lib/boxStats.ts's computeMilestones() — a plain, celebratory sentence
 * per crossed threshold, or nothing at all when neither metric has reached
 * its first threshold (that "show none" case, per the task, is a real,
 * valid state, not an error — this component just renders null for it,
 * exactly like BoxActivityList's own empty-state convention elsewhere in
 * this feature never forces a placeholder where there's nothing to say).
 */

import { t, type Locale } from "@/lib/i18n";
import type { Milestone } from "@/lib/boxStats";

export interface BoxMilestonesProps {
  milestones: readonly Milestone[];
  locale: Locale;
}

export default function BoxMilestones({ milestones, locale }: BoxMilestonesProps) {
  if (milestones.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-normal text-[var(--color-ink-900)] mb-1" style={{ fontFamily: "var(--font-display)" }}>
        {t("box.stats.milestonesHeading", locale)}
      </h2>
      <ul className="space-y-1">
        {milestones.map((m) => (
          <li key={m.metric} className="text-sm text-[var(--color-ink-700)]">
            {t(`box.stats.milestone.${m.metric}`, locale, { threshold: String(m.threshold) })}
          </li>
        ))}
      </ul>
    </div>
  );
}
