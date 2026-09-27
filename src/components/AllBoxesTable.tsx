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

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BoxHealthEntry, BoxHealthStatus } from "@/lib/boxHealth";

export interface AllBoxesTableProps {
  entries: BoxHealthEntry[];
}

// Same label/color pairing as BoxHealthList.tsx's STATUS_META, as a badge
// rather than a dot — a table row has room to spell the status out.
const STATUS_BADGE: Record<BoxHealthStatus, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  low: { label: "Low", className: "bg-[var(--color-clay-100)] text-[var(--color-warning)]" },
  empty: { label: "Empty", className: "bg-[var(--color-clay-100)] text-[var(--color-danger)]" },
  problem: { label: "Problem", className: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" },
  quiet: { label: "Quiet", className: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]" },
};

type StatusFilter = "all" | "needs-help" | BoxHealthStatus;
type SponsorFilter = "any" | "has" | "needs";
type SortKey = "attention" | "oldest" | "newest" | "name";

const NEEDS_HELP_STATUSES: ReadonlySet<BoxHealthStatus> = new Set(["low", "empty", "problem"]);

// Default sort order (task spec): Empty -> Problem -> Low -> Quiet -> OK.
const ATTENTION_PRIORITY: Record<BoxHealthStatus, number> = { empty: 0, problem: 1, low: 2, quiet: 3, ok: 4 };

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
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
  { key: "name", label: "Name A–Z" },
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

/** Days-since comparator, "no reports yet" (null) sorting as the OLDEST possible value — same null convention src/lib/boxHealth.ts's rankQuiet used before #671 removed it. Descending: most-stale first. */
function compareDaysDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return b - a;
}

/** Same comparator, ascending (least-stale/most-recent first) — "no reports yet" sorts LAST here, since it's the opposite of "newest". */
function compareDaysAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function sortEntries(entries: BoxHealthEntry[], sort: SortKey): BoxHealthEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "attention":
      return sorted.sort(
        (a, b) =>
          ATTENTION_PRIORITY[a.health.status] - ATTENTION_PRIORITY[b.health.status] ||
          compareDaysDesc(a.health.daysSinceLastReport, b.health.daysSinceLastReport),
      );
    case "oldest":
      return sorted.sort((a, b) => compareDaysDesc(a.health.daysSinceLastReport, b.health.daysSinceLastReport));
    case "newest":
      return sorted.sort((a, b) => compareDaysAsc(a.health.daysSinceLastReport, b.health.daysSinceLastReport));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function matchesStatus(entry: BoxHealthEntry, filter: StatusFilter): boolean {
  if (filter === "all") return true;
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

const filterButtonClass =
  "min-h-12 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-50";
const filterButtonActive = "border-[var(--color-sage-500)] bg-[var(--color-sage-100)] text-[var(--color-sage-700)]";
const filterButtonInactive =
  "border-[var(--color-bone-300)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]";

export default function AllBoxesTable({ entries }: AllBoxesTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sponsorFilter, setSponsorFilter] = useState<SponsorFilter>("any");
  const [sort, setSort] = useState<SortKey>("attention");
  const [search, setSearch] = useState("");

  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>();
    for (const filter of STATUS_FILTERS) counts.set(filter.key, entries.filter((e) => matchesStatus(e, filter.key)).length);
    return counts;
  }, [entries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = entries.filter(
      (e) => matchesStatus(e, statusFilter) && matchesSponsor(e, sponsorFilter) && matchesSearch(e, query),
    );
    return sortEntries(matched, sort);
  }, [entries, statusFilter, sponsorFilter, search, sort]);

  if (entries.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-10 text-center">
        <p className="text-sm text-[var(--color-ink-500)]">No blessing boxes yet.</p>
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
          const isDisabled = filter.key !== "all" && count === 0;
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={isActive}
              disabled={isDisabled}
              onClick={() => setStatusFilter(filter.key)}
              className={`${filterButtonClass} ${isActive ? filterButtonActive : filterButtonInactive}`}
            >
              {filter.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="boxes-search" className="sr-only">
            Search boxes
          </label>
          <input
            type="text"
            id="boxes-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, address or sponsor"
            className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-3 text-sm text-[var(--color-ink-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          />
        </div>
        <div>
          <label htmlFor="boxes-sponsor-filter" className="sr-only">
            Sponsor
          </label>
          <select
            id="boxes-sponsor-filter"
            value={sponsorFilter}
            onChange={(e) => setSponsorFilter(e.target.value as SponsorFilter)}
            className="min-h-12 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-3 text-sm text-[var(--color-ink-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          >
            <option value="any">Any sponsor status</option>
            <option value="has">Has a sponsor</option>
            <option value="needs">Needs a sponsor</option>
          </select>
        </div>
        <div>
          <label htmlFor="boxes-sort" className="sr-only">
            Sort
          </label>
          <select
            id="boxes-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="min-h-12 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-3 text-sm text-[var(--color-ink-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="mb-2 text-sm text-[var(--color-ink-500)]">
        Showing {filtered.length} of {entries.length} boxes
      </p>

      <div className="elevation-1 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-bone-200)] text-xs uppercase tracking-wide text-[var(--color-ink-400)]">
              <th scope="col" className="px-4 py-3 font-medium">
                Box
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Last report
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Sponsor
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--color-ink-500)]">
                  No boxes match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((entry) => {
                const badge = STATUS_BADGE[entry.health.status];
                return (
                  <tr key={entry.venueId} className="border-b border-[var(--color-bone-100)] last:border-b-0">
                    <td className="px-4 py-3">
                      {/* Box name IS the edit link (#671, same "name = edit link"
                          change #672 made to the Places tab) — the separate
                          trailing Edit column/link is gone. */}
                      <Link
                        href={`/admin/venues/${entry.venueId}/edit`}
                        className="font-medium text-[var(--color-sage-700)] underline underline-offset-2"
                      >
                        {entry.name}
                      </Link>
                      <p className="text-xs text-[var(--color-ink-500)]">{entry.address}</p>
                      {entry.removedOn && (
                        <p className="text-xs font-medium text-[var(--color-clay-700)]">Removed from service</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-700)]">{formatLastReport(entry)}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-700)]">{formatSponsors(entry.sponsors)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
