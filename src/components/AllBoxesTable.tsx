"use client";

/**
 * AllBoxesTable — the /admin/boxes tab's full box list (#671 rework:
 * status filter buttons with counts, a name/address/sponsor search, a
 * Sponsor filter, a sort control, and a "Showing X of N" count line — this
 * is now the ONLY place on the tab that answers "which boxes need
 * attention", replacing the old "Needs help now" / "Gone quiet" lists and
 * status map). Filtering/sorting happen entirely in the browser on the
 * page's own already-fetched `entries` — at most a few dozen rows, so no
 * new query or URL state is worth the complexity (task spec).
 *
 * "use client" (converted from a server component in #671): the filter bar
 * needs real interactive state. Same "table wrapped in overflow-x-auto, no
 * card/table breakpoint swap" mobile pattern VenueListView.tsx already
 * established for /admin/places, rather than inventing a second responsive
 * convention for this app's other admin table.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NEEDS_HELP_STATUSES, type BoxHealthEntry, type BoxHealthStatus } from "@/lib/boxHealth";
import type { BoxReviewSummary } from "@/lib/adminBoxes";
import {
  chipClass,
  controlLabelClass,
  emptyStateClass,
  linkClass,
  secondaryButtonClass,
  tableCellClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableLinkRowClass,
  tableWrapClass,
  tagClass,
  type TagTone,
} from "@/lib/adminCardStyles";
import { inputClass } from "@/components/formClasses";
import AdminSegmented from "@/components/AdminSegmented";
import { openRowLink } from "@/lib/rowLinkClick";
import { runViewTransition } from "@/lib/viewTransition";

export interface AllBoxesTableProps {
  entries: BoxHealthEntry[];
  /** #677: this venue's pending photo/sponsor-request summary, keyed by venueId — grouped once by adminBoxes.ts's groupBoxReviewItems() from the tab's own already-fetched review queues. Optional/undefined is the same as "nothing to review anywhere" (no venue has an entry). */
  reviewByVenueId?: Record<string, BoxReviewSummary>;
  /** #677: `?show=review` pre-selects the "To review" chip — set server-side from the URL (src/app/(site)/admin/boxes/page.tsx). */
  initialShowReview?: boolean;
  /** Optional `?status=` value from the URL. */
  initialStatusFilter?: string;
  /** Optional `?sponsor=` value from the URL. */
  initialSponsorFilter?: string;
  /** Optional `?sort=` value from the URL. */
  initialSort?: string;
  /** Optional `?q=` search value from the URL. */
  initialSearch?: string;
}

// One label/tag per status — a table row has room to spell the status out.
// WHY Low is "caution" (ink 900 on yellow): the old amber on clay 100 was
// 4.0:1, under the 4.5:1 words need (#926 decision 12).
const STATUS_BADGE: Record<BoxHealthStatus, { label: string; tone: TagTone }> = {
  ok: { label: "OK", tone: "calm" },
  low: { label: "Low", tone: "caution" },
  empty: { label: "Empty", tone: "danger" },
  problem: { label: "Problem", tone: "attention" },
  quiet: { label: "Quiet", tone: "quiet" },
};

// "review" is cross-cutting (a box can be "review" AND "ok" at once — a
// review item says nothing about box health) — same reasoning "needs-help"
// already established as its own filter value alongside the real
// BoxHealthStatus values.
type StatusFilter = "all" | "needs-help" | "review" | BoxHealthStatus;
type SponsorFilter = "any" | "has" | "needs";
type SortKey = "attention" | "oldest" | "newest" | "name";

// Default sort order (task spec): Empty -> Problem -> Low -> Quiet -> OK.
const ATTENTION_PRIORITY: Record<BoxHealthStatus, number> = { empty: 0, problem: 1, low: 2, quiet: 3, ok: 4 };

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "To review" },
  { key: "needs-help", label: "Needs help" },
  { key: "empty", label: "Empty" },
  { key: "problem", label: "Problem" },
  { key: "low", label: "Low" },
  { key: "quiet", label: "Quiet" },
  { key: "ok", label: "OK" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "attention", label: "Needs attention first" },
  { key: "oldest", label: "Last report: oldest first" },
  { key: "newest", label: "Last report: newest first" },
  { key: "name", label: "Name A to Z" },
];

// Three choices, so a slider (#926 decision 10). Labels stay short: the
// slider never wraps, and all three must fit a 360 px phone. The visible
// "Sponsor" caption above gives them their context.
const SPONSOR_OPTIONS: { value: SponsorFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "has", label: "Has one" },
  { value: "needs", label: "Needs one" },
];

function formatLastReport(entry: BoxHealthEntry): string {
  if (entry.health.daysSinceLastReport === null) return "No reports yet";
  if (entry.health.daysSinceLastReport === 0) return "Today";
  if (entry.health.daysSinceLastReport === 1) return "1 day ago";
  return `${entry.health.daysSinceLastReport} days ago`;
}

/**
 * Public-card sponsor-band format ("A", "A, B", "A, B, +N more" — task
 * spec), as plain text: this is a table cell, not the card's bolded/"and"-
 * joined JSX (src/components/BoxCardBody.tsx's own formatSponsorNames),
 * which has no plain-text equivalent worth importing for one word's
 * difference ("and" vs a comma for exactly two names).
 */
function formatSponsors(names: string[]): string {
  if (names.length === 0) return "Needs a sponsor";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]}, +${names.length - 2} more`;
}

/** Days-since comparator, ascending (least-stale/most-recent first) — "no reports yet" (null) sorts LAST here, since it's the opposite of "newest". */
function compareDaysAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Descending: most-stale first, "no reports yet" (null) sorting as the OLDEST possible value — same null convention src/lib/boxHealth.ts's rankQuiet used before #671 removed it. Exactly the ascending order reversed. */
const compareDaysDesc = (a: number | null, b: number | null): number => compareDaysAsc(b, a);

function sortEntries(
  entries: BoxHealthEntry[],
  sort: SortKey,
  reviewByVenueId: Record<string, BoxReviewSummary>,
): BoxHealthEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "attention":
      // #677: a box with something to review sorts first, ahead of even an
      // "empty"/"problem" health status — a review item is admin-actionable
      // right now, where a health status might just mean "wait for the next
      // report." Ties within the review tier (and the no-review tier) fall
      // through to the existing health-status/staleness ordering unchanged.
      return sorted.sort((a, b) => {
        const aReview = reviewByVenueId[a.venueId] ? 0 : 1;
        const bReview = reviewByVenueId[b.venueId] ? 0 : 1;
        return (
          aReview - bReview ||
          ATTENTION_PRIORITY[a.health.status] - ATTENTION_PRIORITY[b.health.status] ||
          compareDaysDesc(a.health.daysSinceLastReport, b.health.daysSinceLastReport)
        );
      });
    case "oldest":
      return sorted.sort((a, b) => compareDaysDesc(a.health.daysSinceLastReport, b.health.daysSinceLastReport));
    case "newest":
      return sorted.sort((a, b) => compareDaysAsc(a.health.daysSinceLastReport, b.health.daysSinceLastReport));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function matchesStatus(
  entry: BoxHealthEntry,
  filter: StatusFilter,
  reviewByVenueId: Record<string, BoxReviewSummary>,
): boolean {
  if (filter === "all") return true;
  if (filter === "review") return reviewByVenueId[entry.venueId] !== undefined;
  if (filter === "needs-help") return NEEDS_HELP_STATUSES.has(entry.health.status);
  return entry.health.status === filter;
}

function matchesSponsor(entry: BoxHealthEntry, filter: SponsorFilter): boolean {
  if (filter === "any") return true;
  return filter === "has" ? entry.sponsors.length > 0 : entry.sponsors.length === 0;
}

function matchesSearch(entry: BoxHealthEntry, query: string): boolean {
  if (!query) return true;
  const haystack = `${entry.name} ${entry.address} ${entry.sponsors.join(" ")}`.toLowerCase();
  return haystack.includes(query);
}

/**
 * The "To review" column cell (#677): a small thumbnail + "New photo"
 * (pending) or "Photo reported (N×)" (flagged), and/or "Sponsor request" +
 * the applicant's public name — the two lines stack when a venue has both.
 * Blank (no badge, no "—") when there's nothing to review, same "empty
 * means nothing" convention this table's other cells don't bother marking
 * explicitly either.
 */
function ReviewCell({ summary }: { summary: BoxReviewSummary | undefined }) {
  if (!summary) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {summary.photo && (
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview of a runtime R2 object, same reasoning PhotoReviewCard.tsx's own header gives */}
          <img
            src={`/api/admin/box-photos/${summary.photo.id}/preview`}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            className="h-8 w-8 flex-none rounded-[var(--radius-sm)] object-cover border border-[var(--color-bone-200)]"
          />
          <span className="text-xs font-medium text-[var(--color-ink-700)]">
            {summary.photo.status === "flagged" ? `Photo reported (${summary.photo.flagCount}×)` : "New photo"}
          </span>
        </div>
      )}
      {summary.sponsorRequest && (
        <p className="text-xs text-[var(--color-ink-700)]">
          <span className="font-medium">Sponsor request:</span> {summary.sponsorRequest.displayName}
        </p>
      )}
    </div>
  );
}

const VALID_BOX_STATUSES = new Set<string>(STATUS_FILTERS.map((f) => f.key));
const VALID_BOX_SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.key));

function parseBoxStatus(initialShowReview: boolean, rawStatus?: string): StatusFilter {
  if (initialShowReview) return "review";
  if (rawStatus && VALID_BOX_STATUSES.has(rawStatus)) return rawStatus as StatusFilter;
  return "all";
}

function parseBoxSponsor(raw?: string): SponsorFilter {
  return raw === "has" || raw === "needs" ? raw : "any";
}

function parseBoxSort(raw?: string): SortKey {
  return raw && VALID_BOX_SORTS.has(raw) ? (raw as SortKey) : "attention";
}

const EMPTY_REVIEWS: Record<string, BoxReviewSummary> = {};

export default function AllBoxesTable({
  entries,
  reviewByVenueId = EMPTY_REVIEWS,
  initialShowReview = false,
  initialStatusFilter,
  initialSponsorFilter,
  initialSort,
  initialSearch = "",
}: AllBoxesTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseBoxStatus(initialShowReview, initialStatusFilter),
  );
  const [sponsorFilter, setSponsorFilter] = useState<SponsorFilter>(() => parseBoxSponsor(initialSponsorFilter));
  const [sort, setSort] = useState<SortKey>(() => parseBoxSort(initialSort));
  const [search, setSearch] = useState(initialSearch);
  const searchRef = useRef<HTMLInputElement>(null);

  const propKey = `${initialShowReview}|${initialStatusFilter ?? ""}|${initialSponsorFilter ?? ""}|${initialSort ?? ""}|${initialSearch}`;
  const lastPropKey = useRef(propKey);
  useEffect(() => {
    if (lastPropKey.current === propKey) return;
    lastPropKey.current = propKey;
    setStatusFilter(parseBoxStatus(initialShowReview, initialStatusFilter));
    setSponsorFilter(parseBoxSponsor(initialSponsorFilter));
    setSort(parseBoxSort(initialSort));
    setSearch(initialSearch);
  }, [propKey, initialShowReview, initialStatusFilter, initialSponsorFilter, initialSort, initialSearch]);

  const didInteract = useRef(false);
  useEffect(() => {
    if (!didInteract.current || typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (statusFilter === "review") params.set("show", "review");
    else if (statusFilter !== "all") params.set("status", statusFilter);
    if (sponsorFilter !== "any") params.set("sponsor", sponsorFilter);
    if (sort !== "attention") params.set("sort", sort);
    if (search.trim()) params.set("q", search.trim());
    const qs = params.toString();
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [statusFilter, sponsorFilter, sort, search]);

  // DESIGN.md "Empty states" step 3 / "Search and filter" step 6: Clear
  // filters clears the filters and the search words (not the sort). The
  // button unmounts once rows come back, so focus moves to the search box,
  // a control that stays.
  function clearFilters() {
    didInteract.current = true;
    runViewTransition(() => {
      setStatusFilter("all");
      setSponsorFilter("any");
      setSearch("");
    });
    searchRef.current?.focus();
  }

  function handleStatusFilter(next: StatusFilter) {
    didInteract.current = true;
    runViewTransition(() => setStatusFilter(next));
  }

  function handleSponsorFilter(next: SponsorFilter) {
    didInteract.current = true;
    runViewTransition(() => setSponsorFilter(next));
  }

  function handleSort(next: SortKey) {
    didInteract.current = true;
    runViewTransition(() => setSort(next));
  }

  function handleSearch(next: string) {
    didInteract.current = true;
    setSearch(next);
  }

  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>();
    for (const filter of STATUS_FILTERS) {
      counts.set(filter.key, entries.filter((e) => matchesStatus(e, filter.key, reviewByVenueId)).length);
    }
    return counts;
  }, [entries, reviewByVenueId]);

  const query = search.trim().toLowerCase();
  const filtered = sortEntries(
    entries.filter(
      (e) =>
        matchesStatus(e, statusFilter, reviewByVenueId) && matchesSponsor(e, sponsorFilter) && matchesSearch(e, query),
    ),
    sort,
    reviewByVenueId,
  );

  if (entries.length === 0) {
    return (
      <div className={emptyStateClass}>
        <p>No blessing boxes yet.</p>
        <p>Add a place with the category Blessing Box and it shows up here.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Filter boxes by status"
        className="mb-3 flex flex-wrap gap-2"
      >
        {STATUS_FILTERS.map((filter) => {
          const count = statusCounts.get(filter.key) ?? 0;
          const isActive = statusFilter === filter.key;
          const isDisabled = filter.key !== "all" && count === 0 && !isActive;
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={isActive}
              disabled={isDisabled}
              onClick={() => handleStatusFilter(filter.key)}
              className={`${chipClass(isActive)} tabular-nums`}
            >
              {filter.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="boxes-search" className={controlLabelClass}>
            Search boxes
          </label>
          <input
            ref={searchRef}
            type="search"
            id="boxes-search"
            name="q"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, address or sponsor"
            className={inputClass}
          />
        </div>
        <div>
          <AdminSegmented
            name="boxes-sponsor-filter"
            legend="Sponsor"
            legendClass={controlLabelClass}
            options={SPONSOR_OPTIONS}
            value={sponsorFilter}
            onChange={(v) => handleSponsorFilter(v === "has" || v === "needs" ? v : "any")}
          />
        </div>
        <div>
          <label htmlFor="boxes-sort" className={controlLabelClass}>
            Sort
          </label>
          <select
            id="boxes-sort"
            name="sort"
            value={sort}
            onChange={(e) => handleSort(e.target.value as SortKey)}
            className={inputClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="mb-2 text-sm tabular-nums text-[var(--color-ink-500)]">
        Showing {filtered.length} of {entries.length} {entries.length === 1 ? "box" : "boxes"}
      </p>

      {/* Nothing matches: its own box, not a cell of the 720-wide table, so
          the message and Clear filters are never cut off on a phone. */}
      {filtered.length === 0 ? (
        <div className={emptyStateClass}>
          <p>No boxes match these filters.</p>
          <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={tableWrapClass}>
          {/* WHY these minimums: at 560 the Box column was squeezed to 103 px
              on a phone and names wrapped to three or four lines. 240 (with
              its 32 px padding) keeps a name to two lines; the table scrolls
              sideways inside its box instead (#926). 160 for Sponsor holds
              "Needs a sponsor" on one line, so the table is 800. */}
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className={`${tableHeadCellClass} sticky left-0 z-10 min-w-[240px] bg-white shadow-[1px_0_0_var(--color-bone-200)] sm:static sm:shadow-none`}>
                  Box
                </th>
                <th scope="col" className={tableHeadCellClass}>
                  Status
                </th>
                <th scope="col" className={tableHeadCellClass}>
                  Last report
                </th>
                <th scope="col" className={`${tableHeadCellClass} min-w-[160px]`}>
                  Sponsor
                </th>
                <th scope="col" className={tableHeadCellClass}>
                  To review
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const badge = STATUS_BADGE[entry.health.status];
                const review = reviewByVenueId[entry.venueId];
                return (
                  <tr key={entry.venueId} className={tableLinkRowClass} onClick={openRowLink}>
                    <td className={`${tableCellClass} sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-bone-200)] transition-colors duration-150 group-hover:bg-[var(--color-sage-100)] sm:static sm:bg-transparent sm:shadow-none sm:group-hover:bg-transparent`}>
                      {/* Box name IS the edit link (#671, same "name = edit link"
                          change #672 made to the Places tab) — the separate
                          trailing Edit column/link is gone. A click anywhere
                          on the row opens it too (src/lib/rowLinkClick.ts). */}
                      <Link href={`/admin/venues/${entry.venueId}/edit`} data-row-link className={linkClass}>
                        {entry.name}
                      </Link>
                      <p className="text-xs text-[var(--color-ink-500)]">{entry.address}</p>
                      {entry.removedOn && (
                        <p className="text-xs font-medium text-[var(--color-clay-700)]">Removed from service</p>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <span className={tagClass(badge.tone)}>{badge.label}</span>
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap tabular-nums text-[var(--color-ink-700)]`}>{formatLastReport(entry)}</td>
                    {/* "Needs a sponsor" stays on one line; a list of names may wrap. */}
                    <td className={`${tableCellClass} text-[var(--color-ink-700)] ${entry.sponsors.length === 0 ? "whitespace-nowrap" : ""}`}>
                      {formatSponsors(entry.sponsors)}
                    </td>
                    <td className={tableCellClass}>
                      <ReviewCell summary={review} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
