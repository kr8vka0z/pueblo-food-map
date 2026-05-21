"use client";

/**
 * BottomSheet v2 — vaul-based mobile-only sheet with three snap points:
 *   peek (88px): visible bar at bottom — venue name + chevron, clickable to expand
 *   quick (~320px): venue summary — name, category badge, distance, hours-today,
 *                   SNAP/WIC pills, two-line description, "See full details →" link
 *   full (90vh): complete venue detail — hours table, address, phone, badges
 *
 * Fixes v1 a11y violation: Drawer.Title is now required (Radix Dialog.Title).
 *
 * Three dismissal paths:
 *   1. Escape key (vaul handles natively when modal=false via onOpenChange)
 *   2. Tap on scrim (vaul handles by default)
 *   3. Explicit close X button on quick/full states
 */

import { useState } from "react";
import { Drawer } from "vaul";
import { X, ChevronUp, MapPin, Phone, Clock } from "lucide-react";
import type { Venue } from "@/types/venue";
import { categoryColors, categoryLabels } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeOpenStatus, formatSlot } from "@/lib/hours";
import { t, type Locale } from "@/lib/i18n";

// ─── Snap points ─────────────────────────────────────────────────────────────
// vaul accepts pixel strings and fractions (0-1 = % of viewport height).
// "88px" = peek bar. 0.4 ≈ 320px on 800px screen. 0.9 = 90% of viewport.
const SNAP_PEEK = "88px" as const;
const SNAP_QUICK = 0.4 as const;
const SNAP_FULL = 0.9 as const;
type SnapPoint = typeof SNAP_PEEK | typeof SNAP_QUICK | typeof SNAP_FULL;
const SNAP_POINTS: SnapPoint[] = [SNAP_PEEK, SNAP_QUICK, SNAP_FULL];

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = (typeof DAY_KEYS)[number];

function todayKey(): DayKey {
  const idx = new Date().getDay(); // 0=Sun
  const map: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[idx] ?? "mon";
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface BottomSheetProps {
  venue: (Venue & { distanceMiles?: number }) | null;
  onClose: () => void;
  /** Called when the snap point changes — e.g. to hide overlapping UI when fully expanded. */
  onSnapChange?: (snap: SnapPoint) => void;
  /** Locale forwarded from MapWrapper. Defaults to "en". */
  locale?: Locale;
}

// ─── BottomSheet ─────────────────────────────────────────────────────────────

export default function BottomSheet({ venue, onClose, onSnapChange, locale = "en" }: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>(SNAP_PEEK);

  // When a new venue is selected, reset to quick snap
  // (handled by key prop in MapWrapper)

  const open = venue !== null;
  const status = venue ? computeOpenStatus(venue.hours_weekly) : null;
  const today = todayKey();

  function handleSnapChange(s: string | number | null) {
    if (s === null) return;
    if (SNAP_POINTS.includes(s as SnapPoint)) {
      setSnap(s as SnapPoint);
      onSnapChange?.(s as SnapPoint);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  const directionsUrl = venue
    ? `https://maps.google.com/?q=${venue.lat},${venue.lng}`
    : "#";

  // ── Peek content ─────────────────────────────────────────────────────────

  const peekContent = venue ? (
    <button
      type="button"
      onClick={() => setSnap(SNAP_QUICK)}
      className={
        "flex w-full items-center gap-3 px-4 py-3 text-left " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset " +
        "focus-visible:ring-[var(--color-sage-500)]"
      }
      aria-label={t("detail.expandDetails", locale, { name: venue.name })}
    >
      <span className="flex-1 text-base font-semibold text-[var(--color-ink-900)] truncate">
        {venue.name}
      </span>
      <ChevronUp size={18} className="text-[var(--color-ink-400)] shrink-0" aria-hidden />
    </button>
  ) : null;

  // ── Quick summary content ─────────────────────────────────────────────────

  const quickContent = venue ? (
    <div className="flex flex-col px-5 py-4 gap-3">
      {/* Header row: title + close */}
      <div className="flex items-start gap-2">
        <h2
          className="flex-1 text-xl font-normal text-[var(--color-ink-900)] leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {venue.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("detail.close", locale)}
          className={
            "flex items-center justify-center w-8 h-8 -mr-1 rounded-md " +
            "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {/* Operator attribution */}
      {venue.operator && (
        <p className="text-xs text-[var(--color-ink-500)] -mt-1">
          {t("operator.operated_by", locale)}{" "}
          <a
            href="https://pueblofoodproject.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
          >
            {venue.operator}
          </a>
        </p>
      )}

      {/* Category badge + SNAP/WIC pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-[var(--color-bone-50)]"
          style={{ backgroundColor: categoryColors[venue.category] }}
        >
          <span className="w-2 h-2 rounded-full bg-white/40 shrink-0" aria-hidden />
          {categoryLabels[venue.category]}
        </span>
        {venue.accepts_snap && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
            {t("badge.snap", locale)}
          </span>
        )}
        {venue.accepts_wic && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
            {t("badge.wic", locale)}
          </span>
        )}
      </div>

      {/* Distance + hours today */}
      <div className="flex items-center gap-4 text-sm text-[var(--color-ink-500)]">
        {venue.distanceMiles !== undefined && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} aria-hidden className="text-[var(--color-ink-400)]" />
            {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
          </span>
        )}
        {status && status.state !== "no_hours" && (
          <span className="flex items-center gap-1.5">
            <Clock size={14} aria-hidden className="text-[var(--color-ink-400)]" />
            {status.state === "open"
              ? `${t("badge.openNow", locale)} · ${t("detail.close", locale).toLowerCase()} ${status.time}`
              : status.state === "opens_at"
              ? t("badge.opensAt", locale, { time: status.time })
              : t("badge.closedToday", locale)}
          </span>
        )}
      </div>

      {/* Description (notes), max two lines */}
      {venue.notes && (
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed line-clamp-2">
          {venue.notes}
        </p>
      )}

      {/* "See full details" link */}
      <button
        type="button"
        onClick={() => setSnap(SNAP_FULL)}
        className={
          "mt-1 text-sm font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
          "rounded text-left"
        }
      >
        {t("detail.seeFullDetails", locale)}
      </button>
    </div>
  ) : null;

  // ── Full detail content ───────────────────────────────────────────────────

  const fullContent = venue ? (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--color-bone-200)] shrink-0 sticky top-0 bg-[var(--color-bone-50)] z-10">
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setSnap(SNAP_QUICK)}
          aria-label={t("detail.collapseToSummary", locale)}
          className={
            "flex items-center justify-center w-9 h-9 -mr-2 rounded-md " +
            "text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Venue name */}
        <div>
          <h2
            className="text-2xl font-normal text-[var(--color-ink-900)] leading-tight mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {venue.name}
          </h2>
          {venue.operator && (
            <p className="text-xs text-[var(--color-ink-500)] mb-2">
              {t("operator.operated_by", locale)}{" "}
              <a
                href="https://pueblofoodproject.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
              >
                {venue.operator}
              </a>
            </p>
          )}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-[var(--color-bone-50)]"
            style={{ backgroundColor: categoryColors[venue.category] }}
          >
            <span className="w-2 h-2 rounded-full bg-white/40 shrink-0" aria-hidden />
            {categoryLabels[venue.category]}
          </span>
        </div>

        {/* Address */}
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

        {/* Get directions — first focusable action after header per spec */}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            "flex items-center justify-center gap-2 w-full h-12 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
            "text-xl font-semibold transition-colors duration-150 " +
            "hover:bg-[var(--color-sage-600)] focus-visible:outline-none " +
            "focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
          }
        >
          {t("detail.getDirections", locale)}
        </a>

        {/* SNAP/WIC badges */}
        {(venue.accepts_snap || venue.accepts_wic) && (
          <div className="flex flex-wrap gap-2">
            {venue.accepts_snap && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                {t("detail.acceptsSnap", locale)}
              </span>
            )}
            {venue.accepts_wic && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                {t("detail.acceptsWic", locale)}
              </span>
            )}
          </div>
        )}

        {/* Hours table (Mon-Sun, today highlighted with aria-current) */}
        {venue.hours_weekly && (
          <section aria-label={t("detail.hours", locale)}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
              {t("detail.hours", locale)}
            </h3>
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
                    aria-current={isToday ? "true" : undefined}
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
                      {isToday && (
                        <span className="sr-only">, {t("detail.today", locale)}</span>
                      )}
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
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        {/* Phone */}
        {venue.phone && (
          <section aria-label={t("detail.contact", locale)}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
              {t("detail.contact", locale)}
            </h3>
            <a
              href={`tel:${venue.phone}`}
              className="flex items-center gap-2.5 text-sm text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
            >
              <Phone size={15} className="text-[var(--color-ink-400)]" aria-hidden />
              {venue.phone}
            </a>
          </section>
        )}

        {/* Notes / Description */}
        {venue.notes && (
          <section aria-label={t("detail.about", locale)}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
              {t("detail.about", locale)}
            </h3>
            <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
              {venue.notes}
            </p>
          </section>
        )}
      </div>
    </div>
  ) : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Drawer.Root
      snapPoints={SNAP_POINTS as (string | number)[]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
      open={open}
      onOpenChange={handleOpenChange}
      modal={false}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Content
          key={venue?.id ?? "empty"}
          className={
            "fixed bottom-0 left-0 right-0 z-[800] flex flex-col " +
            "bg-[var(--color-bone-50)] " +
            "rounded-t-[var(--radius-xl)] " +
            "elevation-2 " +
            "focus:outline-none"
          }
          style={{ maxHeight: "calc(100dvh - 100px)" }}
          aria-label={t("detail.venueDetailsPanel", locale)}
        >
          {/* Drawer.Title — required by Radix to fix a11y missing-title violation */}
          <Drawer.Title className="sr-only">
            {venue ? `${venue.name} ${t("detail.venueDetails", locale)}` : t("detail.venueDetailsPanel", locale)}
          </Drawer.Title>

          {/* Drag handle — keyboard focusable, toggles peek ↔ quick */}
          <div
            className="flex-shrink-0 flex justify-center pt-3 pb-1"
            role="button"
            tabIndex={0}
            aria-label={t("detail.dragToExpand", locale)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSnap(snap === SNAP_PEEK ? SNAP_QUICK : SNAP_PEEK);
              }
              if (e.key === "Escape") onClose();
            }}
          >
            <div
              className="w-9 h-1 rounded-full bg-[var(--color-ink-400)] opacity-30"
              aria-hidden
            />
          </div>

          {/* Content: changes by snap point */}
          {snap === SNAP_PEEK && peekContent}
          {snap === SNAP_QUICK && quickContent}
          {snap === SNAP_FULL && fullContent}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
