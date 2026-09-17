"use client";

/**
 * BoxesActivityContent — visible body of /boxes/activity (Blessing Boxes
 * slice 3, Discovery stories D1/D2). Filters, the merged feed
 * (BoxActivityList), and page-forward/back — all client-rendered, since
 * this is live D1 data with interactive filter controls, same "no server
 * self-fetch of our own API" reasoning useBoxActivity.ts's own header gives.
 *
 * Filter state is plain local React state, NOT kept in sync with the URL as
 * it changes — a deliberate scope cut for this slice (a fully shareable
 * filtered link is a real nicety, but round-tripping every filter change
 * through router.replace is more machinery than this "browse recent
 * activity" screen needs — see the PR body). The ONE URL param this page
 * does read is `?box=<id>` on initial load, so BoxContent's own "See full
 * activity" link (D3) actually lands pre-filtered to that box — read once
 * via useSearchParams()'s initial value, never written back.
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useBoxActivity } from "@/lib/useBoxActivity";
import { useBoxVenues } from "@/lib/useBoxVenues";
import { ACTIVITY_KINDS, ACTIVITY_PAGE_SIZE_DEFAULT } from "@/lib/boxActivity";
import BoxActivityList from "@/components/BoxActivityList";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

const FIELD_LABEL = "block text-xs font-medium text-[var(--color-ink-700)] mb-1";
// text-base md:text-sm, not a bare text-sm: iOS Safari auto-zooms the page
// on focusing any field under 16px (see mobile-viewport-and-form-zoom.test.ts).
const SELECT_CLASS =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm " +
  "text-[var(--color-ink-900)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

export default function BoxesActivityContent() {
  const { locale } = useLocale();
  const boxVenues = useBoxVenues();
  const searchParams = useSearchParams();

  // Initial value only (a lazy useState initializer runs once, on mount) —
  // see this file's own header for why this deep-link read is one-way.
  const [venueId, setVenueId] = useState(() => searchParams.get("box") ?? "");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  // Any filter change goes back to page 1 — otherwise narrowing the
  // filters could leave the visitor on "page 3" of a now-much-shorter,
  // possibly-empty result set.
  function setFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setVenueId("");
    setKind("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const filters = useMemo(
    () => ({
      venueId: venueId || undefined,
      kind: kind || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: ACTIVITY_PAGE_SIZE_DEFAULT,
    }),
    [venueId, kind, from, to, page],
  );

  const { page: activityPage, loading } = useBoxActivity(filters);
  const hasActiveFilters = Boolean(venueId || kind || from || to);

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-normal text-[var(--color-ink-900)]" style={{ fontFamily: "var(--font-display)" }}>
            {t("activity.heading", locale)}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-700)]">{t("activity.intro", locale)}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="activity-filter-box" className={FIELD_LABEL}>
              {t("activity.filters.box", locale)}
            </label>
            <select
              id="activity-filter-box"
              value={venueId}
              onChange={(e) => setFilter(setVenueId, e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">{t("activity.filters.boxAll", locale)}</option>
              {boxVenues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="activity-filter-kind" className={FIELD_LABEL}>
              {t("activity.filters.kind", locale)}
            </label>
            <select
              id="activity-filter-kind"
              value={kind}
              onChange={(e) => setFilter(setKind, e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">{t("activity.filters.kindAll", locale)}</option>
              {ACTIVITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`activity.kind.${k}`, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="activity-filter-from" className={FIELD_LABEL}>
              {t("activity.filters.from", locale)}
            </label>
            <input
              id="activity-filter-from"
              type="date"
              value={from}
              onChange={(e) => setFilter(setFrom, e.target.value)}
              className={SELECT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="activity-filter-to" className={FIELD_LABEL}>
              {t("activity.filters.to", locale)}
            </label>
            <input
              id="activity-filter-to"
              type="date"
              value={to}
              onChange={(e) => setFilter(setTo, e.target.value)}
              className={SELECT_CLASS}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline"
          >
            {t("activity.filters.clear", locale)}
          </button>
        )}

        {/* aria-live is scoped to this one short status line, not the list
            below it (PR #472 review, nit 2) — a live region around the
            whole 25-item list re-announces every item to a screen reader
            on each filter change; a "12 results" count is the meaningful
            update, and the list itself is read normally, once, like any
            other static content. */}
        <p aria-live="polite" className="text-sm text-[var(--color-ink-500)]">
          {loading && activityPage.items.length === 0
            ? t("activity.loading", locale)
            : t("activity.resultCount", locale, { count: String(activityPage.items.length) })}
        </p>
        {!(loading && activityPage.items.length === 0) && (
          <BoxActivityList items={activityPage.items} showVenueName />
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
