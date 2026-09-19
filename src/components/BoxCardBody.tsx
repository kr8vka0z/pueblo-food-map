"use client";

/**
 * BoxCardBody — the blessing-box body content rendered INSIDE the map's own
 * card family (BottomSheet on mobile, DesktopVenueWindow on desktop), not a
 * standalone page. Replaces the old full-page BoxContent.tsx (deleted) —
 * Kyle, 2026-09-18: "I want ... check in, submit a picture, all that stuff
 * ... to just happen on the map ... like a venue card, not take you to a
 * different page."
 *
 * Shows ONLY the box's current snapshot, never a list (Kyle, 2026-09-18
 * scope addition to the same rework): status + last filled, the single
 * MOST RECENT check-in (not the activity list BoxContent used to embed —
 * that moved to its own page), most-needed, the host's public note, and the
 * check-in panel. A "History" link goes to /box/<id>/history for the full
 * timeline — BoxActivityList (the list renderer) is reused THERE, not here.
 *
 * Name/address/directions/category badge stay owned by the CALLER
 * (BottomSheet/DesktopVenueWindow already render those identically for
 * every other venue) — this component starts at the box-specific content
 * below that shared header, so a box card is a native member of the venue
 * card family rather than a second, differently-shaped UI bolted on.
 *
 * Two extension points were marked at ship time, each rendering NOTHING
 * until its own data existed (no placeholder image, no "coming soon" text):
 *   - the most-recent-PHOTO slot — BUILT, slice 5 (2026-09-18, box_photos):
 *     renders box.box.latestPhoto when set, via the public approved-only
 *     serve route, with a "Report this photo" link (ReportPhotoButton.tsx).
 *   - a current-SPONSOR ("Cared for by …") slot — BUILT, slice 6
 *     (2026-09-18, box_adopters): renders box.box.adopters (approved
 *     display names only — see boxAdopters.ts) when non-empty.
 *
 * Slice 6 also adds the two inline-expand forms from the Build Plan's card
 * UX item 4 — "Apply to adopt this box" (AdoptBoxForm) and "Email me when it needs
 * filling" (BoxAlertSignupForm) — rendered below the check-in panel, each
 * a standalone collapsed-link-until-tapped component owning its own
 * Turnstile hand-off (src/lib/useBoxTurnstileWidget.ts).
 *
 * No expand/collapse state (fix, 2026-09-18 — Kyle: "When I click show
 * details, nothing shows up," because the old `showExpandedDetails` gate
 * hid the host note behind a toggle whose only OTHER effect was revealing a
 * host note most boxes don't have). Everything here — including the host's
 * note, when set — renders unconditionally now, same as DesktopVenueWindow's
 * header replacing its Show/Hide details toggle with a History link for a
 * box (see that component's own header).
 *
 * `showHistoryLink` (default true) exists ONLY to suppress the in-body
 * History link where something else already provides that link: the
 * DesktopVenueWindow header (a box has no toggle to replace, so the link
 * lives there instead — same visual weight/position the toggle had) and the
 * history page itself (BoxHistoryContent — linking a page to itself is
 * dead weight). BottomSheet (mobile, no header link slot) leaves it at the
 * default; positioned near the TOP of this component (right under status)
 * rather than after the check-in panel so it stays reachable without
 * scrolling past five buttons and a note form first (Kyle, 2026-09-18: "the
 * History link is... not buried at the bottom").
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { formatRelativeTime } from "@/lib/relativeTime";
import BoxCheckinPanel from "@/components/BoxCheckinPanel";
import ReportPhotoButton from "@/components/ReportPhotoButton";
import AdoptBoxForm from "@/components/AdoptBoxForm";
import BoxAlertSignupForm from "@/components/BoxAlertSignupForm";
import { STATUS_BADGE_CLASS, type BoxStatus, type CheckinKind, type PublicBlessingBox } from "@/lib/blessingBoxes";

interface BoxCardBodyProps {
  box: PublicBlessingBox;
  onCheckinSuccess?: (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => void;
  /** See this file's own header. Default true — hidden only where a caller already provides an equivalent link elsewhere. */
  showHistoryLink?: boolean;
}

export default function BoxCardBody({ box, onCheckinSuccess, showHistoryLink = true }: BoxCardBodyProps) {
  const { locale } = useLocale();
  const mostRecentCheckin = box.box.recentCheckins[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* Status + last filled */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="box-status-badge"
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASS[box.box.status]}`}
        >
          {t("box.status", locale)}: {t(`box.status.${box.box.status}`, locale)}
        </span>
        <span className="text-xs text-[var(--color-ink-400)]">
          {box.box.lastFilledAt
            ? t("box.lastFilled", locale, { time: formatRelativeTime(box.box.lastFilledAt, locale) })
            : t("box.lastFilled.never", locale)}
        </span>
      </div>

      {/* History link — kept near the top so it's reachable without
          scrolling past the check-in panel first (see this file's own
          header). Suppressed where the caller already renders an equivalent
          link (DesktopVenueWindow's header, the history page itself). */}
      {showHistoryLink && (
        <Link
          href={`/box/${encodeURIComponent(box.id)}/history`}
          className="text-sm font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline w-fit"
        >
          {t("box.history.link", locale)}
        </Link>
      )}

      {/* Most recent check-in — ONE line, not a list (Kyle, 2026-09-18): the
          full timeline lives at /box/<id>/history via the History link above. */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
          {t("box.recentCheckin.heading", locale)}
        </h3>
        {mostRecentCheckin ? (
          <p data-testid="box-recent-checkin" className="text-sm text-[var(--color-ink-700)]">
            {t(`activity.kind.${mostRecentCheckin.kind}`, locale)} ·{" "}
            {formatRelativeTime(mostRecentCheckin.createdAt, locale)}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-ink-500)]">{t("box.recentCheckin.none", locale)}</p>
        )}
      </div>

      {/* Most needed */}
      {box.box.mostNeeded && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
            {t("box.mostNeeded", locale)}
          </h3>
          <p className="text-sm text-[var(--color-ink-700)]">{box.box.mostNeeded}</p>
        </div>
      )}

      {/* Slice 5 (2026-09-18): most-recent APPROVED photo. Bytes stream from
          the public serve route (approved-only, enforced server-side — see
          that route's own header), never a direct R2 URL. Renders nothing
          when null (never uploaded, or nothing approved yet) — no
          placeholder image, no "coming soon" text, unchanged from the
          extension-point rule this slot replaces. */}
      {box.box.latestPhoto && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
            {t("box.photo.heading", locale)}
          </h3>
          {/* eslint-disable-next-line @next/next/no-img-element -- a runtime, R2-backed image via our own serve route, not a build-time/static asset next/image can optimize */}
          <img
            src={`/api/public/box-photos/${box.box.latestPhoto.id}`}
            alt={t("box.photo.altText", locale, {
              name: box.name,
              time: formatRelativeTime(box.box.latestPhoto.createdAt, locale),
            })}
            className="max-h-48 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-200)] object-cover"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-ink-400)]">
              {t("box.photo.caption", locale, { time: formatRelativeTime(box.box.latestPhoto.createdAt, locale) })}
            </p>
            <ReportPhotoButton photoId={box.box.latestPhoto.id} locale={locale} />
          </div>
        </div>
      )}

      {/* Slice 6: current-sponsor ("Cared for by …") slot. Approved display
          names only (box.box.adopters) — renders nothing when empty, same
          extension-point rule the photo slot above follows. */}
      {box.box.adopters.length > 0 && (
        <p className="text-sm text-[var(--color-ink-700)]">
          {t("box.adopters.caredForBy", locale, { names: box.box.adopters.join(", ") })}
        </p>
      )}

      {(box.box.hostName || box.box.hostNote) && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
            {t("box.host", locale)}
          </h3>
          {box.box.hostName && (
            <p className="text-sm font-medium text-[var(--color-ink-700)]">{box.box.hostName}</p>
          )}
          {box.box.hostNote && (
            <p className="text-sm text-[var(--color-ink-700)] leading-relaxed mt-0.5">{box.box.hostNote}</p>
          )}
        </div>
      )}

      {/* Check-in panel — all five choices, one tap for "took something" */}
      <BoxCheckinPanel
        boxId={box.id}
        onCheckinSuccess={(result) => onCheckinSuccess?.(result)}
      />

      {/* Slice 6 card UX — two inline-expand forms, each collapsed to a
          plain link until tapped (Build Plan item 4). */}
      <AdoptBoxForm boxId={box.id} />
      <BoxAlertSignupForm boxId={box.id} />
    </div>
  );
}
