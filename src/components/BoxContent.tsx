"use client";

/**
 * BoxContent — visible body of /box/[id] (Blessing Boxes slice 1, extended
 * in slice 2 with real computed status + the check-in panel).
 *
 * Mirrors VenueContent.tsx's shape (nav bar, header, action links) for
 * visual consistency with the rest of the site, but reads the
 * PublicBlessingBox shape instead of Venue — host/most-needed/status have no
 * equivalent on a normal venue detail card. Extracted as its own client
 * component (not folded into VenueContent) for the same reason VenueContent
 * itself was extracted from page.tsx: the page stays free of useLocale()
 * (#289's pattern) so generateMetadata/the server page never reads a
 * dynamic API by way of this component.
 *
 * SLICE 2 — status/lastFilledAt are lifted into local state, seeded from
 * the server-rendered `box` prop, so BoxCheckinPanel's onCheckinSuccess can
 * update the badge and "last filled" line the instant a check-in succeeds —
 * no refetch, no page reload, no dependency on the list endpoint's 60s edge
 * cache (see BoxCheckinPanel.tsx / the checkins route's own headers).
 */

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { formatRelativeTime } from "@/lib/relativeTime";
import BoxCheckinPanel from "@/components/BoxCheckinPanel";
import type { BoxStatus, PublicBlessingBox } from "@/lib/blessingBoxes";

interface BoxContentProps {
  box: PublicBlessingBox;
}

/** Semantic-token color pairing per status — success/warning/danger are DESIGN.md's general status tokens, not admin-only (see AGENTS.md's own note on --color-danger, which is about ONE admin button's rationale, not a restriction on this token's normal error/status use elsewhere). Unknown/out_of_service intentionally reuse the same muted neutral treatment slice 1 already used for the placeholder — neither is an alarming state. */
const STATUS_BADGE_CLASS: Record<BoxStatus, string> = {
  stocked: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  low: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  empty: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  unknown: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
  out_of_service: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
};

export default function BoxContent({ box }: BoxContentProps) {
  const { locale } = useLocale();
  const [status, setStatus] = useState<BoxStatus>(box.box.status);
  const [lastFilledAt, setLastFilledAt] = useState<string | null>(box.box.lastFilledAt);

  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${box.lat},${box.lng}`;

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
      {/* Top nav bar — matches VenueContent's pattern */}
      <nav className="h-12 flex items-center px-4 border-b border-[var(--color-bone-200)] shrink-0">
        <Link
          href="/"
          className={
            "text-sm font-medium text-[var(--color-sage-600)] " +
            "hover:text-[var(--color-sage-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] rounded"
          }
        >
          ← {t("report.backToMap", locale)}
        </Link>
      </nav>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-sage-600)] mb-1">
            {t("category.full.blessing_box", locale)}
          </p>
          <h1
            className="text-2xl font-normal text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {box.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">{box.address}</p>
        </header>

        {/* Status — computed from check-ins (slice 2); lifted into local state so a successful check-in updates this instantly. */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="box-status-badge"
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
          >
            {t("box.status", locale)}: {t(`box.status.${status}`, locale)}
          </span>
          <span className="text-xs text-[var(--color-ink-400)]">
            {lastFilledAt
              ? t("box.lastFilled", locale, { time: formatRelativeTime(lastFilledAt, locale) })
              : t("box.lastFilled.never", locale)}
          </span>
        </div>

        {/* Host */}
        {(box.box.hostName || box.box.hostNote) && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("box.host", locale)}
            </h2>
            {box.box.hostName && (
              <p className="text-sm font-medium text-[var(--color-ink-700)]">{box.box.hostName}</p>
            )}
            {box.box.hostNote && (
              <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-1">{box.box.hostNote}</p>
            )}
          </section>
        )}

        {/* Most needed */}
        {box.box.mostNeeded && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("box.mostNeeded", locale)}
            </h2>
            <p className="text-sm text-[var(--color-ink-700)]">{box.box.mostNeeded}</p>
          </section>
        )}

        {/* Installed since */}
        {box.box.installedOn && (
          <p className="text-xs text-[var(--color-ink-400)]">
            {t("box.installedSince", locale)}: {box.box.installedOn}
          </p>
        )}

        {/* Action links */}
        <div className="flex flex-col gap-3 pt-2">
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className={
              "inline-flex items-center justify-center px-4 py-2 rounded " +
              "bg-[var(--color-sage-600)] text-white text-sm font-medium " +
              "hover:bg-[var(--color-sage-700)] transition-colors " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            {t("detail.getDirections", locale)}
          </a>
        </div>

        {/* Check-in panel (slice 2) */}
        <BoxCheckinPanel
          boxId={box.id}
          onCheckinSuccess={({ status: newStatus, lastFilledAt: newLastFilledAt }) => {
            setStatus(newStatus);
            setLastFilledAt(newLastFilledAt);
          }}
        />
      </div>
    </main>
  );
}
