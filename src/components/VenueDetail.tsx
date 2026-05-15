"use client";

import { X, ArrowLeft, MapPin, Phone, Mail, Clock } from "lucide-react";
import type { Venue } from "@/types/venue";
import { categoryColors, categoryLabels } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeOpenStatus, formatSlot } from "@/lib/hours";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];

function todayKey(): DayKey {
  const idx = new Date().getDay(); // 0=Sun
  const map: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[idx] ?? "mon";
}

interface VenueDetailProps {
  venue: Venue & { distanceMiles?: number };
  onClose: () => void;
  onBack?: () => void; // used on mobile sheet
  locale?: Locale;
}

export default function VenueDetail({
  venue,
  onClose,
  onBack,
  locale = "en",
}: VenueDetailProps) {
  const status = computeOpenStatus(venue.hours_weekly);
  const today = todayKey();
  const dotColor = categoryColors[venue.category];

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}&travelmode=transit`;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bone-50)] overflow-hidden">
      {/* Sticky header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--color-bone-200)] shrink-0 sticky top-0 bg-[var(--color-bone-50)] z-10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("detail.back", locale)}
            className="flex items-center justify-center w-9 h-9 -ml-2 rounded-md text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("detail.close", locale)}
          className="flex items-center justify-center w-9 h-9 -mr-2 rounded-md text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Venue name */}
        <div>
          <h2
            className="text-2xl font-normal text-[var(--color-ink-900)] leading-tight mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {venue.name}
          </h2>

          {/* Category pill */}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-[var(--color-bone-50)]"
            style={{ backgroundColor: dotColor }}
          >
            <span className="w-2 h-2 rounded-full bg-white/40 shrink-0" aria-hidden />
            {categoryLabels[venue.category]}
          </span>
        </div>

        {/* Address + distance */}
        <div className="flex gap-2.5">
          <MapPin size={16} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm text-[var(--color-ink-700)]">{venue.address}</p>
            {venue.distanceMiles !== undefined && (
              <p className="text-sm text-[var(--color-ink-400)] font-mono mt-0.5">
                {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
              </p>
            )}
          </div>
        </div>

        {/* Get directions CTA */}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            "flex items-center justify-center gap-2 w-full h-12 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
            "text-base font-semibold transition-colors duration-150 " +
            "hover:bg-[var(--color-sage-600)] focus-visible:outline-none " +
            "focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
          }
        >
          {t("detail.getDirections", locale)} →
        </a>

        {/* Badge row */}
        <div className="flex flex-wrap gap-2">
          {status.state === "open" && (
            <StatusBadge variant="open" icon={<Clock size={13} />}>
              {t("badge.openNow", locale)}
            </StatusBadge>
          )}
          {status.state === "opens_at" && (
            <StatusBadge variant="neutral" icon={<Clock size={13} />}>
              {t("badge.opensAt", locale, { time: status.time })}
            </StatusBadge>
          )}
          {status.state === "closed_today" && (
            <StatusBadge variant="neutral">
              {t("badge.closedToday", locale)}
            </StatusBadge>
          )}
          {venue.accepts_snap && (
            <StatusBadge variant="snap">{t("detail.acceptsSnap", locale)}</StatusBadge>
          )}
          {venue.accepts_wic && (
            <StatusBadge variant="snap">{t("detail.acceptsWic", locale)}</StatusBadge>
          )}
        </div>

        {/* Hours table */}
        {venue.hours_weekly && (
          <section aria-label={t("detail.hours", locale)}>
            <SectionHeading>{t("detail.hours", locale)}</SectionHeading>
            <dl className="space-y-1">
              {DAY_KEYS.map((day) => {
                const slots = venue.hours_weekly![day];
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
                  >
                    <dt
                      className={
                        "w-8 text-sm shrink-0 " +
                        (isToday
                          ? "font-semibold text-[var(--color-sage-700)]"
                          : "text-[var(--color-ink-500)]")
                      }
                    >
                      {t(`day.${day}`, locale)}
                    </dt>
                    <dd
                      className={
                        "text-sm font-mono " +
                        (isToday
                          ? "text-[var(--color-sage-700)]"
                          : "text-[var(--color-ink-700)]")
                      }
                    >
                      {slots && slots.length > 0
                        ? slots.map(formatSlot).join(", ")
                        : t("hours.closed", locale)}
                    </dd>
                    {isToday && (
                      <span className="text-xs text-[var(--color-sage-600)] font-medium ml-auto">
                        {t("detail.today", locale)}
                      </span>
                    )}
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        {/* Contact */}
        {(venue.phone ?? venue.email) && (
          <section aria-label={t("detail.contact", locale)}>
            <SectionHeading>{t("detail.contact", locale)}</SectionHeading>
            <div className="space-y-2">
              {venue.phone && (
                <a
                  href={`tel:${venue.phone}`}
                  className="flex items-center gap-2.5 text-sm text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
                >
                  <Phone size={15} className="text-[var(--color-ink-400)]" aria-hidden />
                  {venue.phone}
                </a>
              )}
              {venue.email && (
                <a
                  href={`mailto:${venue.email}`}
                  className="flex items-center gap-2.5 text-sm text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors break-all"
                >
                  <Mail size={15} className="text-[var(--color-ink-400)]" aria-hidden />
                  {venue.email}
                </a>
              )}
            </div>
          </section>
        )}

        {/* About / Notes */}
        {venue.notes && (
          <section aria-label={t("detail.about", locale)}>
            <SectionHeading>{t("detail.about", locale)}</SectionHeading>
            <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
              {venue.notes}
            </p>
          </section>
        )}

        {/* Sources disclosure */}
        <section
          className="border-t border-[var(--color-bone-200)] pt-4"
          aria-label={t("detail.sources", locale)}
        >
          <SectionHeading>{t("detail.sources", locale)}</SectionHeading>
          {venue.url ? (
            <a
              href={venue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-[var(--color-sage-600)] hover:underline mb-1"
            >
              {venue.source}
            </a>
          ) : (
            <p className="text-sm text-[var(--color-ink-500)] mb-1">{venue.source}</p>
          )}
          <p className="text-xs text-[var(--color-ink-400)]">
            {t("detail.lastVerified", locale)}{" "}
            {new Date(venue.last_verified).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
      {children}
    </h3>
  );
}

function StatusBadge({
  children,
  variant,
  icon,
}: {
  children: React.ReactNode;
  variant: "open" | "neutral" | "snap";
  icon?: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    open: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
    neutral: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
    snap: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
  };
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium " +
        styles[variant]
      }
    >
      {icon}
      {children}
    </span>
  );
}
