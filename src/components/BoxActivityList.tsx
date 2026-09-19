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
 *
 * #511 — two more kinds render here now, both per-box-history-page-only
 * (boxActivity.ts's own header explains why the global feed never sends
 * them, so no branching on WHICH surface this is is needed here):
 *   - 'photo_added': a small thumbnail, tap opens the SAME PhotoViewer
 *     (#508) the card's own photo uses — one shared dialog instance for the
 *     whole list (`openPhotoIndex`), not one per row, same "single dialog,
 *     imperative open/close" shape BoxCardBody's own #508 usage established.
 *   - 'sponsor_added': the ONE line template here whose `{name}` placeholder
 *     is NOT the venue name — it's the sponsor's own approved display name,
 *     carried in `item.detail` (boxActivity.ts's buildSponsorHalf). Every
 *     other kind's `{name}` is `showVenueName ? item.venueName :
 *     "This box"`; sponsor_added substitutes `item.detail` instead, and (since
 *     that value is already IN the main line) the generic "detail renders as
 *     a second line" rule below is skipped for it — a check-in/event's
 *     `detail` is genuinely separate supplementary text, but a sponsor row's
 *     `detail` IS the sentence's subject.
 */

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { formatRelativeTime } from "@/lib/relativeTime";
import PhotoViewer from "@/components/PhotoViewer";
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
  // Which item's photo is open full-screen, by index into `items` — a
  // single shared PhotoViewer instance for the whole list (below), not one
  // per row; see this file's own header.
  const [openPhotoIndex, setOpenPhotoIndex] = useState<number | null>(null);
  const openPhotoItem = openPhotoIndex !== null ? items[openPhotoIndex] : null;

  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">{t(emptyMessageKey, locale)}</p>;
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((item, i) => {
          // No stable cross-table id exists at this layer (checkins and
          // events are two independent autoincrement sequences merged in
          // SQL — see boxActivity.ts's own header) — source+kind+createdAt+
          // index is stable enough for a client-rendered list that never
          // reorders in place, matching this app's existing precedent for a
          // merged/derived list with no single natural key.
          const key = `${item.source}-${item.venueId}-${item.kind}-${item.createdAt}-${i}`;
          const isSponsor = item.kind === "sponsor_added";
          const isPhoto = item.kind === "photo_added";
          // See this file's own header: sponsor_added is the one line whose
          // {name} is the sponsor's own display name, not the venue name.
          const lineName = isSponsor
            ? (item.detail ?? "")
            : showVenueName
              ? item.venueName
              : t("activity.thisBox", locale);
          const when = formatWhen(item.createdAt, locale, now);
          return (
            <li key={key} className="border-b border-[var(--color-bone-200)] pb-3 last:border-0 last:pb-0">
              <p className="text-sm text-[var(--color-ink-900)]">
                {t(`activity.line.${item.kind}`, locale, { name: lineName })}
                <span className="text-[var(--color-ink-400)]"> · {when}</span>
              </p>
              {/* A sponsor row's `detail` is already the line's subject
                  above (see this file's header) — rendering it again here
                  would repeat the same name twice. */}
              {item.detail && !isSponsor && <p className="mt-0.5 text-xs text-[var(--color-ink-500)]">{item.detail}</p>}
              {isPhoto && item.photoId != null && (
                <button
                  type="button"
                  onClick={() => setOpenPhotoIndex(i)}
                  aria-label={t("box.photo.viewFullSize", locale)}
                  className="mt-1.5 block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a runtime, R2-backed image via our own serve route, not a build-time/static asset next/image can optimize */}
                  <img
                    src={`/api/public/box-photos/${item.photoId}`}
                    alt={t("box.photo.altText", locale, { name: item.venueName, time: when })}
                    className="h-16 w-16 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] object-cover"
                  />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {openPhotoItem?.photoId != null && (
        <PhotoViewer
          src={`/api/public/box-photos/${openPhotoItem.photoId}`}
          alt={t("box.photo.altText", locale, {
            name: openPhotoItem.venueName,
            time: formatWhen(openPhotoItem.createdAt, locale, now),
          })}
          caption={t("box.photo.caption", locale, { time: formatWhen(openPhotoItem.createdAt, locale, now) })}
          open={openPhotoIndex !== null}
          onClose={() => setOpenPhotoIndex(null)}
          locale={locale}
        />
      )}
    </>
  );
}
