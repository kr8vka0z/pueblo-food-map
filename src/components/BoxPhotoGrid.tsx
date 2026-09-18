"use client";

/**
 * BoxPhotoGrid — the approved-photo grid on /box/<id>/history (Blessing
 * Boxes slice 5). Pure presentational component (all data already fetched
 * by useBoxPhotos.ts's caller) so it's trivially testable with a plain
 * photos array, mirroring BoxActivityList.tsx's own props-in/renders-out
 * shape.
 *
 * "Show more" is a CLIENT-side reveal, not a second fetch — the list route
 * (GET /api/public/blessing-boxes/[id]/photos) already caps its response at
 * MAX_HISTORY_PHOTOS (src/lib/boxPhotos.ts) and returns the whole capped
 * array in one shot; there's no page param to ask the server for more.
 * INITIAL_VISIBLE keeps the first paint to a short 2-row grid on mobile.
 */

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relativeTime";
import ReportPhotoButton from "@/components/ReportPhotoButton";
import type { BoxPhotoListItem } from "@/lib/useBoxPhotos";

const INITIAL_VISIBLE = 8;

interface BoxPhotoGridProps {
  photos: BoxPhotoListItem[];
  boxName: string;
  locale: Locale;
}

export default function BoxPhotoGrid({ photos, boxName, locale }: BoxPhotoGridProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  if (photos.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">{t("box.photo.none", locale)}</p>;
  }

  const visible = photos.slice(0, visibleCount);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visible.map((photo) => (
          <div key={photo.id} className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a runtime, R2-backed image via our own serve route, not a build-time/static asset next/image can optimize */}
            <img
              src={`/api/public/box-photos/${photo.id}`}
              alt={t("box.photo.altText", locale, { name: boxName, time: formatRelativeTime(photo.createdAt, locale) })}
              className="aspect-square w-full rounded-[var(--radius-md)] border border-[var(--color-bone-200)] object-cover"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--color-ink-400)]">{formatRelativeTime(photo.createdAt, locale)}</p>
              <ReportPhotoButton photoId={photo.id} locale={locale} />
            </div>
          </div>
        ))}
      </div>
      {visibleCount < photos.length && (
        <button
          type="button"
          onClick={() => setVisibleCount(photos.length)}
          className="mt-3 text-sm font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline"
        >
          {t("box.photo.morePhotos", locale)}
        </button>
      )}
    </div>
  );
}
