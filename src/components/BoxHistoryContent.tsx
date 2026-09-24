"use client";

/**
 * BoxHistoryContent — the visible body of /box/[id]/history: a
 * history-first log (issue #511, 2026-09-19 — "Tapping History on a box
 * card should land on a history log, not a second copy of the card").
 * Top to bottom: the box's own name as the page's <h1> + the back link
 * (PageNav), the combined history log newest-first (visible without
 * scrolling), then the box's numbers (slice 7) at the bottom.
 *
 * #511 REMOVED the current-snapshot card (BoxCardBody) and the separate
 * approved-photo grid (BoxPhotoGrid) that used to sit above/below the log —
 * card photo, sponsor band, address, most needed, host note, and the
 * check-in buttons are all gone from this page along with it. A photo is
 * now a log entry ("Photo added", small thumbnail, tap opens the SAME
 * PhotoViewer via BoxActivityList — see that file's own header) instead of
 * a separate grid section, and an approved sponsor is now a log entry
 * ("<name> became a sponsor") instead of a card band.
 *
 * KNOWN REGRESSION, not fixed here (see this PR's own report to Atlas):
 * BoxCardBody's check-in panel was this page's own PR-review fix
 * (2026-09-18) for a no-WebGL visitor — MapWrapper.tsx's mapUnavailable
 * branch routes every box tap straight to `/box/<id>/history` with no other
 * check-in surface. Removing BoxCardBody here removes that visitor's only
 * way to check in, adopt, or even read the address. #511's own acceptance
 * criteria explicitly name "check-in buttons" as removed, so this is a
 * scoped, spec'd tradeoff — not an oversight — but it needs its own
 * decision (accept the loss, or a follow-up issue for a no-WebGL check-in
 * path), which is Kyle's/Atlas's to make, not this slice's.
 *
 * Reuses the SAME activity read path slice 3 built (useBoxActivity ->
 * GET /api/public/blessing-boxes/activity), filtered to this one box via
 * its existing `venueId` filter, with `includeBoxExtras: true` added for
 * #511's two new per-box-only kinds (photo/sponsor — see boxActivity.ts's
 * own header for why this is a dedicated flag, never inferred from
 * `venueId`, and why the global /boxes/activity feed never sets it) — not a
 * second query, and the same structural privacy guarantee: that route's SQL
 * already excludes `problem` reports, hidden check-ins, and any non-
 * approved photo/sponsor row for every caller, so this page needs no extra
 * filtering of its own to honor "same privacy rules as the activity feed."
 *
 * Pagination mirrors BoxesActivityContent.tsx's own Prev/Next pattern
 * exactly (no "Load more" — avoids an accumulated-items state) — this page
 * just fixes `venueId` instead of exposing box/kind/date filter controls,
 * since it's already scoped to one box by the URL.
 *
 * Slice 7 (Numbers) — `allCheckins`/`approvedPhotoCreatedAts` are this box's
 * ENTIRE history, loaded server-side by page.tsx (see its own header for
 * why: the period picker recomputes client-side over this one payload, with
 * no extra fetch per period change). `statsPeriod` defaults to "30d" — a
 * recent-activity snapshot reads more useful on first load than either a
 * single week (too little signal for most boxes) or the box's whole
 * lifetime (buries "what's been happening lately" under old history).
 */

import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";
import { useBoxActivity } from "@/lib/useBoxActivity";
import { ACTIVITY_PAGE_SIZE_DEFAULT } from "@/lib/boxActivity";
import { computeCheckinCounts, computePairAverages, filterByPeriod, type PeriodKey } from "@/lib/boxStats";
import BoxActivityList from "@/components/BoxActivityList";
import BoxNumbersPanel from "@/components/BoxNumbersPanel";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";
import type { CheckinStatusInput, PublicBlessingBox } from "@/lib/blessingBoxes";

interface BoxHistoryContentProps {
  box: PublicBlessingBox;
  /** This box's ENTIRE check-in history (slice 7 — Numbers). Optional, defaulting to [] — page.tsx always supplies the real data; the default only keeps every pre-slice-7 test render (which has no reason to exercise Numbers) working unchanged. */
  allCheckins?: CheckinStatusInput[];
  /** This box's approved-photo timestamps, uncapped (slice 7 — Numbers). Same optional-with-[]-default reasoning as allCheckins above. */
  approvedPhotoCreatedAts?: string[];
}

export default function BoxHistoryContent({ box, allCheckins = [], approvedPhotoCreatedAts = [] }: BoxHistoryContentProps) {
  const { locale } = useLocale();
  // <title> follows locale client-side (#589) — box.history.link's EN value
  // ("History") matches page.tsx generateMetadata's suffix exactly; box.name
  // is a proper noun, not translated, same as the metadata itself.
  useDocumentTitle(pageDocumentTitle(`${box.name} — ${t("box.history.link", locale)}`));
  const [page, setPage] = useState(1);
  const [statsPeriod, setStatsPeriod] = useState<PeriodKey>("30d");

  // includeBoxExtras: true — this page is the ONE caller that gets #511's
  // photo/sponsor entries; see boxActivity.ts's own header for why that's a
  // dedicated flag rather than inferred from venueId.
  const { page: activityPage, loading } = useBoxActivity({
    venueId: box.id,
    page,
    pageSize: ACTIVITY_PAGE_SIZE_DEFAULT,
    includeBoxExtras: true,
  });

  // Counts (fills/uses/empty/low/total/approved photos) are scoped to the
  // selected period; pair averages read the box's ENTIRE history regardless
  // of period — see this file's header and boxStats.ts's own header for why.
  const periodCheckins = useMemo(() => filterByPeriod(allCheckins, statsPeriod, new Date()), [allCheckins, statsPeriod]);
  const counts = useMemo(() => computeCheckinCounts(periodCheckins), [periodCheckins]);
  const pairAverages = useMemo(() => computePairAverages(allCheckins), [allCheckins]);
  const approvedPhotoCount = useMemo(() => {
    const asRows = approvedPhotoCreatedAts.map((created_at) => ({ created_at }));
    return filterByPeriod(asRows, statsPeriod, new Date()).length;
  }, [approvedPhotoCreatedAts, statsPeriod]);

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      {/* backHref points PageNav's own "Back to map" chrome link at the
          exact box's card (?venue=<id>), not just the bare map — the in-map
          deep link MapWrapper already reads. */}
      <PageNav locale={locale} backHref={`/?venue=${encodeURIComponent(box.id)}`} />

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* #511 — box name is the page title. The log immediately follows,
            with no other section between title and log, so it's visible on
            first screen without scrolling (the page's own spec). */}
        <h1 className="text-3xl font-normal text-[var(--color-ink-900)]" style={{ fontFamily: "var(--font-display)" }}>
          {box.name}
        </h1>

        <div>
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

        {/* Numbers (slice 7), below the log per #511's own spec — this
            box's own counts/typical-timing, driven by allCheckins/
            approvedPhotoCreatedAts loaded server-side (see page.tsx's own
            header for why no extra fetch is needed here). */}
        <div>
          <h2
            className="text-xl font-normal text-[var(--color-ink-900)] mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("box.stats.perBoxHeading", locale)}
          </h2>
          <BoxNumbersPanel
            idPrefix="box-history"
            period={statsPeriod}
            onPeriodChange={setStatsPeriod}
            counts={counts}
            approvedPhotoCount={approvedPhotoCount}
            pairAverages={pairAverages}
            locale={locale}
          />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
