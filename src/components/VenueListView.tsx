"use client";

/**
 * VenueListView — the admin's searchable/filterable venue table (read-only
 * list #253; per-row Edit link added #255). Receives every D1 `venues` row
 * (draft + published + archived) as a prop and owns all search/filter UI
 * state client-side — 108 rows total today, comfortably small enough that
 * no server-side pagination or search endpoint is warranted yet.
 *
 * Presentational + interactive only: no data fetching (that's the Server
 * Component page, src/app/admin/page.tsx) and no mutation of its own — the
 * Edit link below only navigates to /admin/venues/[id]/edit
 * (src/app/admin/venues/[id]/edit/page.tsx), where AddVenueForm and
 * ArchiveVenueButton own the actual mutations.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { categoryLabels } from "@/data/venues";
import { STATUS_LABELS, hasUnpublishedChanges, formatLastVerified } from "@/lib/adminVenues";
import type { AdminVenueRow, AdminVenueStatus, VenueCategory } from "@/types/venue";

interface VenueListViewProps {
  venues: AdminVenueRow[];
}

type StatusFilter = "all" | AdminVenueStatus;
type CategoryFilter = "all" | VenueCategory;

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: STATUS_LABELS.published },
  { value: "draft", label: STATUS_LABELS.draft },
  { value: "archived", label: STATUS_LABELS.archived },
];

// Fixed, declared order (not derived from the current venues prop) so the
// select's option list never shifts as search/filter state changes.
const ALL_CATEGORIES = Object.keys(categoryLabels) as VenueCategory[];

const STATUS_BADGE_STYLES: Record<AdminVenueStatus, string> = {
  published: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]", // Live
  draft: "bg-[var(--color-brand-yellow)] text-[var(--color-ink-900)]", // Draft
  archived: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]", // Removed
};

const controlLabelClass =
  "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";
const controlInputClass =
  "rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-3 py-2 text-sm " +
  "text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";

export default function VenueListView({ venues }: VenueListViewProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return venues.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (q && !v.name.toLowerCase().includes(q) && !v.address.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [venues, query, statusFilter, categoryFilter]);

  return (
    <div>
      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="venue-search" className={controlLabelClass}>
            Search
          </label>
          <input
            id="venue-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or address"
            className={controlInputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="venue-status-filter" className={controlLabelClass}>
            Status
          </label>
          <select
            id="venue-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={controlInputClass}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="venue-category-filter" className={controlLabelClass}>
            Category
          </label>
          <select
            id="venue-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className={controlInputClass}
          >
            <option value="all">All</option>
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabels[cat]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-12 text-center text-sm text-[var(--color-ink-500)]">
          No venues match your search.
        </p>
      ) : (
        <div className="elevation-1 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-bone-200)] text-[11px] uppercase tracking-wide text-[var(--color-ink-400)]">
                <th scope="col" className="px-4 py-3 font-medium">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Address
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Last verified
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Unpublished changes
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((venue) => (
                <tr
                  key={venue.id}
                  className="border-b border-[var(--color-bone-200)] last:border-0 hover:bg-[var(--color-bone-100)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-ink-700)]">
                    {venue.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-700)]">
                    {categoryLabels[venue.category]}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={venue.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">{venue.address}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">
                    {formatLastVerified(venue.last_verified)}
                  </td>
                  <td className="px-4 py-3">
                    {hasUnpublishedChanges(venue) && (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-[var(--color-clay-100)] text-[var(--color-clay-700)]">
                        Unpublished changes
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/venues/${venue.id}/edit`}
                      className={
                        "text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2 " +
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded"
                      }
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--color-ink-400)]">
        {filtered.length} of {venues.length} venues
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminVenueStatus }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        STATUS_BADGE_STYLES[status]
      }
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
