"use client";

/**
 * BoxHistoryContent — the visible body of /box/[id]/history (map-first
 * rework, scope addition 2026-09-18: Kyle wanted the in-map card to show
 * only the CURRENT snapshot — "the most recent check-in... and then there
 * could be a history link... that could take you to a separate page where
 * we could show all the historical information, check-ins, and all that
 * fun stuff").
 *
 * Also the ONLY check-in surface for a visitor whose device can't show the
 * map (fix, PR review 2026-09-18): MapWrapper.tsx routes a mapUnavailable
 * box selection straight to this page (no in-map card exists to open there),
 * so BoxCardBody — the SAME snapshot-plus-check-in-panel component the map
 * card renders — is rendered here too, above the history list. Without this,
 * a no-WebGL visitor could see a box's status but had no way to check in at
 * all, a real regression from the pre-rework standalone /box/<id> page.
 * `liveBox` is local state seeded from the server-loaded `box` prop (same
 * pattern the old deleted BoxContent.tsx used) so a successful check-in
 * updates the badge/last-filled/recent-check-in line here instantly, with no
 * refetch — mirrors MapWrapper.tsx's own handleBoxCheckinSuccess patch
 * (including skipping 'problem' reports, which set no status) since this
 * page needs the identical optimistic update, just for one box instead of a
 * whole map's worth.
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
import { useBoxActivity } from "@/lib/useBoxActivity";
import { useBoxPhotos } from "@/lib/useBoxPhotos";
import { ACTIVITY_PAGE_SIZE_DEFAULT } from "@/lib/boxActivity";
import { computeCheckinCounts, computePairAverages, filterByPeriod, type PeriodKey } from "@/lib/boxStats";
import BoxActivityList from "@/components/BoxActivityList";
import BoxCardBody from "@/components/BoxCardBody";
import BoxNumbersPanel from "@/components/BoxNumbersPanel";
import BoxPhotoGrid from "@/components/BoxPhotoGrid";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";
import type { BoxStatus, CheckinKind, CheckinStatusInput, PublicBlessingBox } from "@/lib/blessingBoxes";

interface BoxHistoryContentProps {
  box: PublicBlessingBox;
  /** This box's ENTIRE check-in history (slice 7 — Numbers). Optional, defaulting to [] — page.tsx always supplies the real data; the default only keeps every pre-slice-7 test render (which has no reason to exercise Numbers) working unchanged. */
  allCheckins?: CheckinStatusInput[];
  /** This box's approved-photo timestamps, uncapped (slice 7 — Numbers). Same optional-with-[]-default reasoning as allCheckins above. */
  approvedPhotoCreatedAts?: string[];
}

export default function BoxHistoryContent({ box, allCheckins = [], approvedPhotoCreatedAts = [] }: BoxHistoryContentProps) {
  const { locale } = useLocale();
  const [page, setPage] = useState(1);
  const [liveBox, setLiveBox] = useState(box);
  const [statsPeriod, setStatsPeriod] = useState<PeriodKey>("30d");

  const { page: activityPage, loading } = useBoxActivity({
    venueId: liveBox.id,
    page,
    pageSize: ACTIVITY_PAGE_SIZE_DEFAULT,
  });
  const { photos } = useBoxPhotos(liveBox.id);

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

  const handleCheckinSuccess = (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => {
    setLiveBox((current) => ({
      ...current,
      box: {
        ...current.box,
        status: result.status,
        lastFilledAt: result.lastFilledAt,
        // Same "problem" skip + cap-at-5 as MapWrapper's handleBoxCheckinSuccess.
        recentCheckins:
          result.kind === "problem"
            ? current.box.recentCheckins
            : [{ kind: result.kind, createdAt: new Date().toISOString() }, ...current.box.recentCheckins].slice(0, 5),
      },
    }));
  };

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      {/* backHref points PageNav's own "Back to map" chrome link at the
          exact box's card (?venue=<id>), not just the bare map — the in-map
          deep link MapWrapper already reads. Fix, 2026-09-18: this page used
          to ALSO render its own "Back to the map" link below, so a visitor
          saw two of them; deleted in favor of pointing the one chrome link
          everywhere else already has. */}
      <PageNav locale={locale} backHref={`/?venue=${encodeURIComponent(liveBox.id)}`} />

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        <p className="mt-2 text-sm text-[var(--color-ink-700)]">{t("box.history.subheading", locale)}</p>

        {/* Full current-snapshot card, incl. check-in panel and host note —
            see this file's own header. `showHistoryLink={false}` (2026-09-18):
            a History link pointing at the page it's already on is dead
            weight — everything else about BoxCardBody's default rendering
            still applies, since a no-WebGL visitor's only box page is THIS
            one and needs the full snapshot. `headingLevel="h1"` (card
            redesign, 2026-09-19): BoxCardBody now renders the box's own
            name as part of its badge/name/address block — this page no
            longer renders a separate <h1> above it (that would duplicate
            the name as two headings); the card's own name IS this page's
            page-level heading now. */}
        <BoxCardBody
          box={liveBox}
          onCheckinSuccess={handleCheckinSuccess}
          showHistoryLink={false}
          headingLevel="h1"
        />

        {/* Approved-photo grid (slice 5) — reuses the same public serve
            route the card's own single-photo slot uses; this is the "see
            every photo" counterpart to that most-recent-only slot. */}
        <div>
          <h2
            className="text-xl font-normal text-[var(--color-ink-900)] mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("box.photo.galleryHeading", locale)}
          </h2>
          <BoxPhotoGrid photos={photos} boxName={liveBox.name} locale={locale} />
        </div>

        {/* Numbers (slice 7) — this box's own counts/typical-timing, driven
            by allCheckins/approvedPhotoCreatedAts loaded server-side (see
            page.tsx's own header for why no extra fetch is needed here). */}
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
