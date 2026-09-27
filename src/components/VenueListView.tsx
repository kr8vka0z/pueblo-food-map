"use client";

/**
 * VenueListView — the admin's searchable/filterable venue table (read-only
 * list #253; per-row Edit link added #255, moved onto the name itself and
 * the separate Actions column removed #672; single Status column + key
 * added, replacing the old status + "Unpublished changes" pair, #673).
 *
 * Presentational + interactive only: no data fetching (that's the Server
 * Component page, src/app/admin/places/page.tsx) and no mutation of its
 * own. `statusByVenueId` is computed there rather than here because it
 * needs src/data/published-venues.ts (the ~2000-entry public-map snapshot)
 * to diff against — importing that file into THIS "use client" component
 * would ship its entire contents to the browser for no reason; the page
 * only ever hands this component the small per-id status strings it needs.
 *
 * The name links to /admin/venues/[id]/edit (src/app/admin/venues/[id]/edit/page.tsx),
 * where AddVenueForm and ArchiveVenueButton own the actual mutations. An
 * archived row's name stays plain text instead (#568 review finding,
 * 2026-09-24, moved here from the old Actions column by #672) — PATCH
 * /api/admin/venues/[id] refuses an archived-row edit with a 409, so a link
 * that always dead-ends into that 409 isn't a real action worth offering.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { categoryLabels } from "@/data/venues";
import { DISPLAY_STATUS_KEY, DISPLAY_STATUS_LABELS, formatLastVerified, type AdminDisplayStatus } from "@/lib/adminVenues";
import type { AdminVenueRow, VenueCategory } from "@/types/venue";

interface VenueListViewProps {
  venues: AdminVenueRow[];
  /** displayStatusOf() per venue id (adminVenues.ts) — computed server-side; see this file's own header for why. */
  statusByVenueId: Record<string, AdminDisplayStatus>;
}

type StatusFilter = "all" | AdminDisplayStatus;
type CategoryFilter = "all" | VenueCategory;

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: DISPLAY_STATUS_LABELS.draft },
  { value: "live", label: DISPLAY_STATUS_LABELS.live },
  { value: "live_edits_waiting", label: DISPLAY_STATUS_LABELS.live_edits_waiting },
  { value: "removed", label: DISPLAY_STATUS_LABELS.removed },
];

// Fixed, declared order (not derived from the current venues prop) so the
// select's option list never shifts as search/filter state changes.
const ALL_CATEGORIES = Object.keys(categoryLabels) as VenueCategory[];

const STATUS_BADGE_STYLES: Record<AdminDisplayStatus, string> = {
  live: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
  draft: "bg-[var(--color-brand-yellow)] text-[var(--color-ink-900)]",
  live_edits_waiting: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
  removed: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
};

const controlLabelClass =
  "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";
// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
const controlInputClass =
  "rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-3 py-2 text-base md:text-sm " +
  "text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";

export default function VenueListView({ venues, statusByVenueId }: VenueListViewProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return venues.filter((v) => {
      if (statusFilter !== "all" && statusByVenueId[v.id] !== statusFilter) return false;
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (q && !v.name.toLowerCase().includes(q) && !v.address.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [venues, query, statusFilter, categoryFilter, statusByVenueId]);

  return (
    <div>
      <StatusKey />

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
          <table className="w-full min-w-[680px] text-left text-sm">
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((venue) => (
                <tr
                  key={venue.id}
                  className="border-b border-[var(--color-bone-200)] last:border-0 hover:bg-[var(--color-bone-100)]"
                >
                  <td className="px-4 py-3 font-medium">
                    {venue.status === "archived" ? (
                      // #568 review finding (2026-09-24), moved here by #672:
                      // PATCH /api/admin/venues/[id] refuses an archived-row
                      // edit with a 409 (see that route's own header) — a
                      // link that always 409s on save is a dead end, not a
                      // real action, so an archived row's name is plain text.
                      <span className="text-[var(--color-ink-700)]">{venue.name}</span>
                    ) : (
                      <Link
                        href={`/admin/venues/${venue.id}/edit`}
                        className={
                          "text-[var(--color-sage-700)] underline underline-offset-2 " +
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded"
                        }
                      >
                        {venue.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-700)]">
                    {categoryLabels[venue.category]}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={statusByVenueId[venue.id]} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">{venue.address}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">
                    {formatLastVerified(venue.last_verified)}
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

/** #673 pt.2: one line per status, in plain language, above the table — the Places tab's status key. */
function StatusKey() {
  return (
    <dl className="mb-4 flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-3 text-xs text-[var(--color-ink-500)] sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1.5">
      {DISPLAY_STATUS_KEY.map(({ status, description }) => (
        <div key={status} className="flex items-center gap-1.5">
          <dt>
            <StatusBadge status={status} />
          </dt>
          <dd>{description}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ status }: { status: AdminDisplayStatus }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        STATUS_BADGE_STYLES[status]
      }
    >
      {DISPLAY_STATUS_LABELS[status]}
    </span>
  );
}
