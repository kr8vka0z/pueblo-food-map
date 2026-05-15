"use client";

import { Clock } from "lucide-react";
import type { Venue } from "@/types/venue";
import { categoryColors, categoryLabels } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface VenueCardProps {
  venue: Venue & { distanceMiles?: number };
  isSelected: boolean;
  onClick: () => void;
  locale?: Locale;
  headingLevel?: 2 | 3;
}

export default function VenueCard({
  venue,
  isSelected,
  onClick,
  locale = "en",
  headingLevel = 3,
}: VenueCardProps) {
  const status = computeOpenStatus(venue.hours_weekly);
  const dotColor = categoryColors[venue.category];

  const Heading = `h${headingLevel}` as "h2" | "h3";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
          (isSelected
            ? "bg-[var(--color-sage-50)] border-l-[3px] border-[var(--color-sage-500)]"
            : "border-l-[3px] border-transparent hover:bg-[var(--color-bone-100)]")
        }
        style={{ minHeight: 96 }}
        aria-current={isSelected ? "true" : undefined}
      >
        {/* Category dot */}
        <span
          className="mt-1 inline-block w-2.5 h-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />

        {/* Main content */}
        <span className="flex-1 min-w-0">
          <Heading className="block text-base font-semibold text-[var(--color-ink-700)] leading-snug mb-0.5">
            {venue.name}
          </Heading>
          <span className="block text-sm text-[var(--color-ink-400)] truncate mb-1.5">
            {categoryLabels[venue.category]} · {venue.address}
          </span>

          {/* Badge row */}
          <span className="flex flex-wrap gap-1.5">
            {status.state === "open" && (
              <Badge variant="open">
                <Clock size={11} className="shrink-0" aria-hidden />
                {t("badge.openNow", locale)}
              </Badge>
            )}
            {status.state === "opens_at" && (
              <Badge variant="neutral">
                <Clock size={11} className="shrink-0" aria-hidden />
                {t("badge.opensAt", locale, { time: status.time })}
              </Badge>
            )}
            {status.state === "closed_today" && (
              <Badge variant="neutral">{t("badge.closedToday", locale)}</Badge>
            )}
            {venue.accepts_snap && (
              <Badge variant="snap">{t("badge.snap", locale)}</Badge>
            )}
            {venue.accepts_wic && (
              <Badge variant="snap">{t("badge.wic", locale)}</Badge>
            )}
          </span>
        </span>

        {/* Distance */}
        {venue.distanceMiles !== undefined && (
          <span
            className="shrink-0 text-sm font-mono text-[var(--color-ink-500)] tabular-nums"
            aria-label={`${formatMiles(venue.distanceMiles)} ${t("distance.fromYou", locale)}`}
          >
            {formatMiles(venue.distanceMiles)}
          </span>
        )}
      </button>
    </li>
  );
}

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "open" | "neutral" | "snap";
}) {
  const styles: Record<string, string> = {
    open: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
    neutral: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
    snap: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
  };
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium " +
        styles[variant]
      }
    >
      {children}
    </span>
  );
}
