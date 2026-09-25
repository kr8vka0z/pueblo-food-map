"use client";

/**
 * HoursList — shared weekly hours table with today-row highlighting, plus
 * (#400) an optional monthly-schedule section below it so a venue with both
 * (e.g. Lynn Gardens Baptist Church) shows weekly AND monthly together, in
 * one place, rather than each caller assembling the two separately.
 *
 * Used by BottomSheet (compact=false, text-sm) and DesktopVenueWindow
 * (compact=true, text-xs). Both need identical logic: today row border,
 * aria-current="date", sr-only "today" announcement, and formatted slots.
 *
 * todayKey and DISPLAY_DAY_KEYS come from src/lib/hours.ts — the single
 * source of truth; BottomSheet's inline duplicate was removed in #166 8.2.
 */

import { todayKey, DISPLAY_DAY_KEYS, formatSlot, describeIrregularSchedule } from "@/lib/hours";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import type { IrregularSchedule, WeeklyHours } from "@/types/venue";

interface HoursListProps {
  /** Optional (#400) — a venue can carry ONLY hours_irregular (no weekly table at all). */
  hours_weekly?: WeeklyHours;
  /** Non-weekly schedules (#400) — rendered as a "Monthly" section below the weekly table when present. */
  hours_irregular?: IrregularSchedule[];
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
  /**
   * compact=true → text-xs (DesktopVenueWindow)
   * compact=false → text-sm (BottomSheet)
   */
  compact?: boolean;
}

export default function HoursList({ hours_weekly, hours_irregular, locale: localeProp, compact = false }: HoursListProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const today = todayKey();
  const textSize = compact ? "text-xs" : "text-sm";

  return (
    <>
    {hours_weekly && (
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
    )}
    {hours_irregular && hours_irregular.length > 0 && (
      <div className="mt-2">
        <p
          className={`${textSize} font-semibold text-[var(--color-ink-500)] mb-1`}
        >
          {t("hours.irregular.heading", locale)}
        </p>
        <ul className="space-y-0.5">
          {hours_irregular.map((entry, i) => (
            <li key={i} className={`${textSize} text-[var(--color-ink-700)]`}>
              {describeIrregularSchedule(entry, locale, t)}
            </li>
          ))}
        </ul>
      </div>
    )}
    </>
  );
}
