"use client";

/**
 * BoxesDirectoryContent — visible body of /boxes (Blessing Boxes slice 4,
 * Discovery stories B2/B3/B5/B6).
 *
 * Fetches the SAME live endpoint the map does (useBoxesList — the
 * full-shape sibling of useBoxVenues.ts; see that hook's own header for why
 * a second hook exists instead of widening the first) and renders every
 * box as one sortable, filterable list — B5's "Boxes page," with B2's
 * "closest to me" and B3's "hide reported-empty" folded into one sort
 * control and one checkbox rather than a filter panel (the slice's own
 * instruction).
 *
 * Distance sort is entirely CLIENT-SIDE and never leaves the browser: the
 * fetch to /api/public/blessing-boxes carries no query string, body, or
 * header derived from the visitor's coordinates — useGeolocation's position
 * is read only to compute haversineMiles() locally against the already-
 * fetched array. See BoxesDirectoryContent.test.tsx's "coordinates never
 * leave the browser" regression.
 *
 * A11y: the sort <select> and the location-request affordance both carry
 * real <label>/accessible-name text (never icon-only); the result count is
 * the ONE thing announced via aria-live, not the list itself (same
 * "narrow the live region" convention BoxesActivityContent.tsx already
 * established for /boxes/activity — re-announcing 30+ rows on every filter
 * change would be noise, not help, for a screen-reader user).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useGeolocation } from "@/lib/useGeolocation";
import { useBoxesList } from "@/lib/useBoxesList";
import { haversineMiles, formatMiles } from "@/lib/distance";
import { formatRelativeTime } from "@/lib/relativeTime";
import {
  compareBoxesByNeedsFillingMost,
  compareBoxesByRecentlyFilled,
  STATUS_BADGE_CLASS,
} from "@/lib/blessingBoxes";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

type SortKey = "needsFilling" | "closest" | "recentlyFilled";

const FIELD_LABEL = "block text-xs font-medium text-[var(--color-ink-700)] mb-1";
// text-base md:text-sm, not a bare text-sm: iOS Safari auto-zooms the page
// on focusing any field under 16px (same rule BoxesActivityContent.tsx's
// own SELECT_CLASS documents).
const SELECT_CLASS =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm " +
  "text-[var(--color-ink-900)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

export default function BoxesDirectoryContent() {
  const { locale } = useLocale();
  const { boxes, loading } = useBoxesList();
  const geo = useGeolocation();

  const [sort, setSort] = useState<SortKey>("needsFilling");
  const [hideEmpty, setHideEmpty] = useState(false);
  // Whether "Closest to me" has ever triggered a request() — set only from
  // the event handler below, never from an effect (react-hooks/
  // set-state-in-effect: calling setState synchronously inside a useEffect
  // risks a cascading render — same "derive during render, don't setState
  // in an effect" fix useBoxActivity.ts's own `loading` derivation already
  // applies). isLocating is DERIVED from this plus geo.state.permission at
  // render time, not stored as its own state: useGeolocation's request()
  // has no pending flag of its own (see its own header), and permission
  // stays "prompt" only while the Permissions API hasn't resolved yet.
  const [geoRequested, setGeoRequested] = useState(false);
  const isLocating = geoRequested && geo.state.permission === "prompt";

  function handleSortChange(next: SortKey) {
    setSort(next);
    // B2: "one tap, reusing useGeolocation" — picking "Closest to me" IS the
    // one tap; it requests location right here rather than needing a
    // second, separate button.
    if (next === "closest" && geo.state.permission !== "granted") {
      setGeoRequested(true);
      geo.request();
    }
  }

  const origin = geo.state.permission === "granted" ? geo.state.position : null;

  const visibleBoxes = useMemo(
    () => (hideEmpty ? boxes.filter((b) => b.box.status !== "empty") : boxes),
    [boxes, hideEmpty],
  );

  // B2: distance-sorted only once we actually have a position — with no
  // position (not yet granted, denied, or unavailable) this falls straight
  // back to the default "needs filling most" order, so the page stays
  // fully usable with zero location access (the Discovery accept line:
  // "works without location too ... or just the full list").
  const sortedBoxes = useMemo(() => {
    const list = [...visibleBoxes];
    if (sort === "closest" && origin) {
      return list.sort((a, b) => haversineMiles(origin, a) - haversineMiles(origin, b));
    }
    if (sort === "recentlyFilled") return list.sort(compareBoxesByRecentlyFilled);
    return list.sort(compareBoxesByNeedsFillingMost);
  }, [visibleBoxes, sort, origin]);

  const usingClosestFallback = sort === "closest" && !origin;

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-normal text-[var(--color-ink-900)]" style={{ fontFamily: "var(--font-display)" }}>
            {t("boxes.heading", locale)}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-700)]">{t("boxes.intro", locale)}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label htmlFor="boxes-sort" className={FIELD_LABEL}>
              {t("boxes.sort.label", locale)}
            </label>
            <select
              id="boxes-sort"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value as SortKey)}
              className={SELECT_CLASS}
            >
              <option value="needsFilling">{t("boxes.sort.needsFilling", locale)}</option>
              <option value="closest">{t("boxes.sort.closest", locale)}</option>
              <option value="recentlyFilled">{t("boxes.sort.recentlyFilled", locale)}</option>
            </select>
          </div>

          {/* B3: "prefer boxes not reported empty" — one checkbox, not a filter panel. */}
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink-800)] pb-2">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
              className="size-4 rounded border-[var(--color-bone-300)] text-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            />
            {t("boxes.hideEmpty", locale)}
          </label>
        </div>

        {/* aria-live scoped to this one status line, matching
            BoxesActivityContent's own convention — never wraps the list. */}
        <p aria-live="polite" className="text-sm text-[var(--color-ink-500)]">
          {isLocating
            ? t("boxes.locating", locale)
            : loading && sortedBoxes.length === 0
              ? t("boxes.loading", locale)
              : t("boxes.resultCount", locale, { count: String(sortedBoxes.length) })}
        </p>

        {usingClosestFallback && !isLocating && (
          <p className="text-sm text-[var(--color-warning)]">
            {geo.state.permission === "denied"
              ? t("boxes.sort.locationDenied", locale)
              : t("boxes.sort.needsLocation", locale)}
          </p>
        )}

        {origin && (
          <p className="text-xs text-[var(--color-ink-400)]">{t("boxes.distanceNote", locale)}</p>
        )}

        {!loading && sortedBoxes.length === 0 ? (
          <p data-testid="boxes-empty" className="text-sm text-[var(--color-ink-500)]">
            {t("boxes.empty", locale)}
          </p>
        ) : (
          <ul data-testid="boxes-list" className="space-y-4">
            {sortedBoxes.map((box) => {
              const distanceMiles = origin ? haversineMiles(origin, box) : null;
              return (
                <li key={box.id} className="border-b border-[var(--color-bone-200)] pb-4 last:border-0 last:pb-0">
                  <Link
                    href={`/box/${box.id}`}
                    className={
                      "text-base font-semibold text-[var(--color-sage-600)] " +
                      "hover:text-[var(--color-sage-700)] transition-colors " +
                      "focus-visible:outline-none focus-visible:ring-2 " +
                      "focus-visible:ring-[var(--color-sage-500)] rounded"
                    }
                  >
                    {box.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{box.address}</p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASS[box.box.status]}`}
                    >
                      {t("box.status", locale)}: {t(`box.status.${box.box.status}`, locale)}
                    </span>
                    <span className="text-xs text-[var(--color-ink-400)]">
                      {box.box.lastFilledAt
                        ? t("box.lastFilled", locale, { time: formatRelativeTime(box.box.lastFilledAt, locale) })
                        : t("box.lastFilled.never", locale)}
                    </span>
                    {distanceMiles !== null && (
                      <span className="text-xs font-mono text-[var(--color-ink-500)] tabular-nums">
                        {formatMiles(distanceMiles)}
                      </span>
                    )}
                  </div>

                  {box.box.mostNeeded && (
                    <p className="mt-1 text-sm text-[var(--color-ink-700)]">
                      {t("boxes.mostNeeded", locale, { list: box.box.mostNeeded })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
