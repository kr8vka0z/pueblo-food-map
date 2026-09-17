"use client";

/**
 * BoxActivityList — the shared rendering of an ActivityItem[] into readable
 * lines, used by both /boxes/activity (the global feed) and BoxContent's
 * own per-box "recent activity" panel (Discovery story D3). Kept as one
 * component, not two, so the line template, timestamp formatting, and
 * empty-state copy can never drift between the two surfaces.
 *
 * Timestamp rule: items within 7 days use the existing relative-time
 * helper ("3 hours ago"); older items switch to a short calendar date
 * ("Sep 20") — matches the Build Plan's own example line ("New box added
 * at Bessemer Park · Sep 20") and Intl's `toLocaleDateString`, no new date
 * library.
 */

import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { ActivityItem } from "@/lib/boxActivity";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function formatWhen(iso: string, locale: Locale, now: Date): string {
  const ageMs = now.getTime() - new Date(iso).getTime();
  if (ageMs <= SEVEN_DAYS_MS) return formatRelativeTime(iso, locale, now);
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

interface BoxActivityListProps {
  items: ActivityItem[];
  /** True on the global /boxes/activity feed (many boxes at once); false on BoxContent's own per-box embed, where the venue name is already the page's own heading and repeating it on every line would be noise. */
  showVenueName: boolean;
  /** i18n key for the empty state — the global feed and the per-box embed word it slightly differently ("no activity yet" vs. "no activity at this box yet"). */
  emptyMessageKey?: string;
  /** Injectable clock, same convention as blessingBoxes.ts's computeBoxStatus — lets tests pin "now" instead of faking global time. */
  now?: Date;
}

export default function BoxActivityList({
  items,
  showVenueName,
  emptyMessageKey = "activity.empty",
  now = new Date(),
}: BoxActivityListProps) {
  const { locale } = useLocale();

  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">{t(emptyMessageKey, locale)}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        // No stable cross-table id exists at this layer (checkins and
        // events are two independent autoincrement sequences merged in
        // SQL — see boxActivity.ts's own header) — source+kind+createdAt+
        // index is stable enough for a client-rendered list that never
        // reorders in place, matching this app's existing precedent for a
        // merged/derived list with no single natural key.
        const key = `${item.source}-${item.venueId}-${item.kind}-${item.createdAt}-${i}`;
        return (
          <li key={key} className="border-b border-[var(--color-bone-200)] pb-3 last:border-0 last:pb-0">
            <p className="text-sm text-[var(--color-ink-900)]">
              {t(`activity.line.${item.kind}`, locale, { name: showVenueName ? item.venueName : t("activity.thisBox", locale) })}
              <span className="text-[var(--color-ink-400)]"> · {formatWhen(item.createdAt, locale, now)}</span>
            </p>
            {item.detail && <p className="mt-0.5 text-xs text-[var(--color-ink-500)]">{item.detail}</p>}
          </li>
        );
      })}
    </ul>
  );
}
