"use client";

/**
 * BoxHistoryContent — the visible body of /box/[id]/history (map-first
 * rework, scope addition 2026-09-18: Kyle wanted the in-map card to show
 * only the CURRENT snapshot — "the most recent check-in... and then there
 * could be a history link... that could take you to a separate page where
 * we could show all the historical information, check-ins, and all that
 * fun stuff").
 *
 * Reuses the SAME activity read path slice 3 built (useBoxActivity ->
 * GET /api/public/blessing-boxes/activity), filtered to this one box via
 * its existing `venueId` filter — not a second query, and the same
 * structural privacy guarantee: that route's SQL already excludes
 * `problem` reports and hidden check-ins for every caller (see
 * boxActivity.ts's own header), so this page needs no extra filtering of
 * its own to honor "same privacy rules as the activity feed."
 *
 * Pagination mirrors BoxesActivityContent.tsx's own Prev/Next pattern
 * exactly (no "Load more" — avoids an accumulated-items state) — this page
 * just fixes `venueId` instead of exposing box/kind/date filter controls,
 * since it's already scoped to one box by the URL.
 */

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useBoxActivity } from "@/lib/useBoxActivity";
import { ACTIVITY_PAGE_SIZE_DEFAULT } from "@/lib/boxActivity";
import BoxActivityList from "@/components/BoxActivityList";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

interface BoxHistoryContentProps {
  boxId: string;
  boxName: string;
}

export default function BoxHistoryContent({ boxId, boxName }: BoxHistoryContentProps) {
  const { locale } = useLocale();
  const [page, setPage] = useState(1);

  const { page: activityPage, loading } = useBoxActivity({
    venueId: boxId,
    page,
    pageSize: ACTIVITY_PAGE_SIZE_DEFAULT,
  });

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          {/* Back to the exact box's card, not just the bare map — the
              in-map ?venue=<id> deep link MapWrapper already reads. */}
          <Link
            href={`/?venue=${encodeURIComponent(boxId)}`}
            className="text-sm font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline"
          >
            {t("box.history.back", locale)}
          </Link>
          <h1
            className="mt-2 text-3xl font-normal text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {boxName}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-700)]">{t("box.history.subheading", locale)}</p>
        </div>

        <p aria-live="polite" className="text-sm text-[var(--color-ink-500)]">
          {loading && activityPage.items.length === 0
            ? t("activity.loading", locale)
            : t("activity.resultCount", locale, { count: String(activityPage.items.length) })}
        </p>
        {!(loading && activityPage.items.length === 0) && (
          <BoxActivityList items={activityPage.items} showVenueName={false} emptyMessageKey="activity.recentEmpty" />
        )}

        {activityPage.items.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("activity.prevPage", locale)}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!activityPage.hasMore}
              className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("activity.nextPage", locale)}
            </button>
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
