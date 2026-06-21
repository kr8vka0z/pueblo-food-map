"use client";

/**
 * HoursList — shared weekly hours table with today-row highlighting.
 *
 * Used by BottomSheet (compact=false, text-sm) and DesktopVenueWindow
 * (compact=true, text-xs). Both need identical logic: today row border,
 * aria-current="date", sr-only "today" announcement, and formatted slots.
 *
 * todayKey and DISPLAY_DAY_KEYS come from src/lib/hours.ts — the single
 * source of truth; BottomSheet's inline duplicate was removed in #166 8.2.
 */

import { todayKey, DISPLAY_DAY_KEYS, formatSlot } from "@/lib/hours";
import { t, type Locale } from "@/lib/i18n";
import type { WeeklyHours } from "@/types/venue";

interface HoursListProps {
  hours_weekly: WeeklyHours;
  locale: Locale;
  /**
   * compact=true → text-xs (DesktopVenueWindow)
   * compact=false → text-sm (BottomSheet)
   */
  compact?: boolean;
}

export default function HoursList({ hours_weekly, locale, compact = false }: HoursListProps) {
  const today = todayKey();
  const textSize = compact ? "text-xs" : "text-sm";

  return (
    <dl className="space-y-1">
      {DISPLAY_DAY_KEYS.map((day) => {
        const slots = hours_weekly[day];
        const isToday = day === today;
        return (
          <div
            key={day}
            className={
              "flex items-baseline gap-3 py-0.5 " +
              (isToday
                ? "border-l-[3px] pl-2 border-[var(--color-sage-500)]"
                : "pl-3")
            }
            aria-current={isToday ? "date" : undefined}
          >
            <dt
              className={
                `${textSize} shrink-0 ` +
                (compact ? "w-7 " : "w-8 ") +
                (isToday
                  ? "font-semibold text-[var(--color-sage-700)]"
                  : "text-[var(--color-ink-500)]")
              }
            >
              {t(`day.${day}`, locale)}
              {isToday && (
                <span className="sr-only">, {t("detail.today", locale)}</span>
              )}
            </dt>
            <dd
              className={
                `${textSize} font-mono ` +
                (isToday
                  ? "text-[var(--color-sage-700)]"
                  : "text-[var(--color-ink-700)]")
              }
            >
              {slots && slots.length > 0
                ? slots.map(formatSlot).join(", ")
                : t("hours.closed", locale)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
