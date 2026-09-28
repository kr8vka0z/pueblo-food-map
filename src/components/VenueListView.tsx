"use client";

/**
 * VenueListView — the admin's searchable/filterable venue table (read-only
 * list #253; per-row Edit link added #255, moved onto the name itself and
 * the separate Actions column removed #672; single Status column + key
 * added, replacing the old status + "Unpublished changes" pair, #673).
 *
 * #674 ("fold the Data refresh tab into Places"): this file now also owns
 * everything the retired /admin/flags queue used to — a "To review" column
 * per row, quick-filter chips (All / To review / Waiting to publish / Draft
 * / Live / Removed), and the source/AI-lane filters moved over from that
 * queue. Two NEW kinds of row appear alongside plain venue rows:
 *   - an existing venue with pending review items shows them in its own "To
 *     review" cell (one short line + badge per item) — this covers RESTORES
 *     too (an `add` proposal targeting an already-archived venue attaches
 *     to that venue's own row, never a synthetic one).
 *   - a genuinely-new suggestion (no existing venue row to attach to)
 *     renders as its own synthetic "Suggested new place" row — see the Row
 *     union type below.
 * `itemsByVenueId`/`addItems` are grouped server-side
 * (src/app/(site)/admin/places/page.tsx) — this component only renders and
 * filters what it's handed, same "no data fetching here" boundary this
 * file's own header already established for statusByVenueId.
 *
 * #675 ("fold the Review queue into Places"): a pending `public_submissions`
 * row (a public closure/problem report, or a "new_venue" suggestion) is now
 * one more `ReviewItem` (src/lib/publicSubmissions.ts) alongside a
 * `change_proposals` one — everywhere this file used to say "proposal," it
 * now says "item" and branches on `item.kind` only where the two truly
 * differ:
 *   - the source filter gains "The public" ("public"), matching every
 *     submission item regardless of its own `kind` (closure vs new_venue);
 *   - the "To review" cell tags a submission item "Public" instead of a
 *     lane badge — ReviewLane is a change-proposal-only concept (Jev triage
 *     never runs on a public report), so a submission item has no lane to
 *     show;
 *   - a "new_venue" submission becomes its own "Suggested new place" row,
 *     the SAME row shape a genuinely-new `add` proposal already got —
 *     tagged "Public" there too.
 * A closure report against an ARCHIVED venue attaches to that venue's own
 * "Removed" row exactly like a restore proposal does — no separate case
 * needed here, since groupItemsByTarget() (the page) already resolves
 * against a venue of ANY status.
 *
 * Presentational + interactive only: no data fetching (that's the Server
 * Component page, src/app/(site)/admin/places/page.tsx) and no mutation of its
 * own beyond what ProposalCard/SubmissionCard (rendered nowhere in this
 * file directly, but SOURCE_BADGE/LANE_BADGE/fieldLabel and
 * summarizeSubmissionForRow are reused from them) already own.
 * `statusByVenueId` is computed there rather than here because it
 * needs src/data/published-venues.ts (the ~2000-entry public-map snapshot)
 * to diff against — importing that file into THIS "use client" component
 * would ship its entire contents to the browser for no reason; the page
 * only ever hands this component the small per-id status strings it needs.
 *
 * The name links to /admin/venues/[id]/edit (src/app/(site)/admin/venues/[id]/edit/page.tsx),
 * where AddVenueForm and ArchiveVenueButton own the actual mutations. An
 * archived row's name stays plain text UNLESS it has a pending review item
 * to review (#674: a restore's / a public report's "Suggestions to review"
 * box lives on that page — PATCH refusing to SAVE an archived edit, #568,
 * is a different concern from viewing/approving an item there) — see
 * isArchivedRowLinkable below.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { categoryLabels } from "@/data/venues";
import { DISPLAY_STATUS_KEY, DISPLAY_STATUS_LABELS, formatLastVerified, type AdminDisplayStatus } from "@/lib/adminVenues";
import { SOURCE_BADGE, LANE_BADGE, fieldLabel } from "@/components/ProposalCard";
import { summarizeSubmissionForRow } from "@/components/SubmissionCard";
import { renameMetaOf, reviewableDiffFields, reviewLaneOf } from "@/lib/adminProposals";
import type { ProposalSourceValue, ReviewLane } from "@/lib/adminProposals";
import { reviewItemKey, type ReviewItem } from "@/lib/publicSubmissions";
import type { AdminVenueRow, VenueCategory } from "@/types/venue";

interface VenueListViewProps {
  venues: AdminVenueRow[];
  /** displayStatusOf() per venue id (adminVenues.ts) — computed server-side; see this file's own header for why. */
  statusByVenueId: Record<string, AdminDisplayStatus>;
  /** Pending review items (proposals + public submissions) grouped by their target venue's id (includes restores and reports against a removed venue) — computed server-side, see this file's own header. */
  itemsByVenueId?: Record<string, ReviewItem[]>;
  /** Genuinely-new suggestions (an `add` proposal or a "new_venue" submission) with no existing venue row — rendered as their own "Suggested new place" rows. */
  addItems?: ReviewItem[];
  /** #674: `?show=review` pre-selects the "To review" chip — set server-side from the URL (src/app/(site)/admin/places/page.tsx), never parsed client-side. */
  initialShowReview?: boolean;
  /** #675: `?from=public` pre-selects the "The public" source filter chip — same server-side-only convention as initialShowReview. */
  initialSourceFilter?: SourceFilter;
}

// A quick-filter chip is either "all", a real AdminDisplayStatus, or the
// cross-cutting "to_review" — a genuinely-new suggestion row has no
// AdminDisplayStatus of its own (it isn't a venue yet), so it can only ever
// match "all" or "to_review".
type QuickFilter = "all" | "to_review" | AdminDisplayStatus;
type CategoryFilter = "all" | VenueCategory;
// "public" matches any submission item (closure or new_venue) regardless of
// source — public reports have no upstream data source the way a proposal
// does, so they get one shared filter value rather than per-issue-type ones.
type SourceFilter = "all" | ProposalSourceValue | "public";
type LaneFilterValue = "all" | ReviewLane;

const QUICK_FILTER_ORDER: QuickFilter[] = ["all", "to_review", "live_edits_waiting", "draft", "live", "removed"];
const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  all: "All places",
  to_review: "To review",
  ...DISPLAY_STATUS_LABELS,
};

// Fixed, declared order (not derived from the current venues prop) so the
// select's option list never shifts as search/filter state changes.
const ALL_CATEGORIES = Object.keys(categoryLabels) as VenueCategory[];

const STATUS_BADGE_STYLES: Record<AdminDisplayStatus, string> = {
  live: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
  draft: "bg-[var(--color-brand-yellow)] text-[var(--color-ink-900)]",
  live_edits_waiting: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
  removed: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
};

// clay-100/700: the established informational-emphasis pairing (DESIGN.md)
// — same pairing SubmissionCard.tsx's own "Public report" badge uses, so a
// public item reads the same accent everywhere it appears.
const PUBLIC_BADGE_CLASS = "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]";

const controlLabelClass =
  "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";
// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
const controlInputClass =
  "rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-3 py-2 text-base md:text-sm " +
  "text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";

const filterChipClass = (active: boolean) =>
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 " +
  (active
    ? "border-[var(--color-sage-500)] bg-[var(--color-sage-100)] text-[var(--color-sage-700)]"
    : "border-[var(--color-bone-300)] text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)]");

// ─── Item helpers — read across the ReviewItem union without callers caring
// which table an item came from ─────────────────────────────────────────────

/** A proposal's real upstream source, or "public" for any submission item — the one dimension the source filter/chips read. */
function itemSourceFilterValue(item: ReviewItem): SourceFilter {
  return item.kind === "proposal" ? (item.proposal.row.source as ProposalSourceValue) : "public";
}

/** null for a submission item — ReviewLane (Jev triage) is a change-proposal-only concept, see this file's own header. */
function itemLane(item: ReviewItem): ReviewLane | null {
  if (item.kind !== "proposal") return null;
  const { row, diff, parseError } = item.proposal;
  return reviewLaneOf(row, parseError ? null : diff);
}

// ─── Row model: a real venue, or a synthetic "Suggested new place" row ─────

type Row =
  | { kind: "venue"; venue: AdminVenueRow; items: ReviewItem[] }
  | { kind: "new"; item: ReviewItem };

function newItemName(item: ReviewItem): string {
  if (item.kind === "proposal") {
    const after = !item.proposal.parseError ? item.proposal.diff.after : null;
    return (typeof after?.name === "string" && after.name) || item.proposal.row.target_venue_id;
  }
  return (!item.submission.parseError && item.submission.payload.venueName) || "New place suggestion";
}

function newItemCategory(item: ReviewItem): VenueCategory | null {
  if (item.kind === "proposal") {
    const after = !item.proposal.parseError ? item.proposal.diff.after : null;
    return (after?.category as VenueCategory | undefined) ?? null;
  }
  // A "new" row's submission is always kind="new_venue" (a "closure" report
  // always carries a real target_venue_id, so it can never land in addItems
  // — see groupItemsByTarget() on the Places page) — narrowed explicitly
  // here since ReviewSubmission's payload shape depends on `kind`, not on
  // `parseError` alone.
  return !item.submission.parseError && item.submission.kind === "new_venue"
    ? (item.submission.payload.category as VenueCategory)
    : null;
}

function newItemAddress(item: ReviewItem): string {
  if (item.kind === "proposal") {
    const after = !item.proposal.parseError ? item.proposal.diff.after : null;
    return typeof after?.address === "string" ? after.address : "";
  }
  return !item.submission.parseError && item.submission.kind === "new_venue" ? item.submission.payload.address : "";
}

/** The href a "Suggested new place" row's name links to — an `add` proposal and a "new_venue" submission both prefill /admin/venues/new, just via a different query param (their own routes already accept it, see AddVenueForm.tsx's own header). */
function newItemHref(item: ReviewItem): string {
  return item.kind === "proposal"
    ? `/admin/venues/new?proposal=${item.proposal.row.id}`
    : `/admin/venues/new?submission=${item.submission.id}`;
}

function rowName(row: Row): string {
  return row.kind === "venue" ? row.venue.name : newItemName(row.item);
}

function rowCategory(row: Row): VenueCategory | null {
  return row.kind === "venue" ? row.venue.category : newItemCategory(row.item);
}

function rowAddress(row: Row): string {
  return row.kind === "venue" ? row.venue.address : newItemAddress(row.item);
}

function rowItems(row: Row): ReviewItem[] {
  return row.kind === "venue" ? row.items : [row.item];
}

function rowNeedsReview(row: Row): boolean {
  return rowItems(row).length > 0;
}

/**
 * A short, human line for one proposal's "To review" cell — the issue's own
 * examples ("Data refresh: new phone number", "looks closed: suggests
 * removal", "website link broken", "listed under a new name") are
 * illustrative, not a literal spec; this covers every change_type/source
 * shape ProposalCard.tsx itself branches on, using the SAME field-label map
 * (fieldLabel, imported from ProposalCard.tsx) so a field name never reads
 * differently in the two places it's shown.
 */
const REVIEW_FIELD_WORD: Record<string, string> = {
  phone: "phone number",
  url: "website",
  address: "address",
  hours_weekly: "hours",
  category: "category",
  name: "name",
  operator: "operator",
};

function summarizeProposalForRow(p: Extract<ReviewItem, { kind: "proposal" }>["proposal"]): string {
  if (p.parseError) return "Suggested change — couldn't read details";
  const { row, diff } = p;
  if (row.source === "link_health") return "Website link broken";
  if (renameMetaOf(diff)) return "Listed under a new name";
  if (row.change_type === "remove") return "Looks closed — suggests removal";
  if (row.change_type === "add") return "Suggested new place";
  const fields = reviewableDiffFields(diff);
  if (fields.length === 0) return "Confirmed still current";
  if (fields.length === 1) return `New ${REVIEW_FIELD_WORD[fields[0]] ?? fieldLabel(fields[0]).toLowerCase()}`;
  return `${fields.length} fields changed`;
}

/**
 * #675: the "To review" cell's per-item summary line — a proposal reads
 * exactly as it did before (summarizeProposalForRow above); a public
 * submission is prefixed "Public:" per the issue's own example ("Public:
 * 'Hours are wrong'"), reusing SubmissionCard.tsx's own summarizer so the
 * text can't drift between the two places it's shown.
 */
function summarizeItemForRow(item: ReviewItem): string {
  return item.kind === "proposal" ? summarizeProposalForRow(item.proposal) : `Public: ${summarizeSubmissionForRow(item.submission)}`;
}

function ReviewCell({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) return <span className="text-[var(--color-ink-400)]">—</span>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const lane = itemLane(item);
        const badge = lane ? LANE_BADGE[lane] : { label: "Public", className: PUBLIC_BADGE_CLASS };
        const key = item.kind === "proposal" ? item.proposal.row.id : `s-${item.submission.id}`;
        return (
          <li key={key} className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--color-ink-700)]">{summarizeItemForRow(item)}</span>
            <span className={`inline-flex items-center rounded px-1 py-0.5 font-medium ${badge.className}`}>{badge.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function VenueListView({
  venues,
  statusByVenueId,
  itemsByVenueId = {},
  addItems = [],
  initialShowReview = false,
  initialSourceFilter = "all",
}: VenueListViewProps) {
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialShowReview ? "to_review" : "all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialSourceFilter);
  const [laneFilter, setLaneFilter] = useState<LaneFilterValue>("all");

  const rows: Row[] = useMemo(() => {
    const venueRows: Row[] = venues.map((venue) => ({
      kind: "venue",
      venue,
      items: itemsByVenueId[venue.id] ?? [],
    }));
    const newRows: Row[] = addItems.map((item) => ({ kind: "new", item }));
    // Alphabetical by display name first (matches the page's own `ORDER BY
    // name` for plain venues) — the default "review first" sort below is a
    // stable re-partition ON TOP of this order, not a replacement for it.
    return [...venueRows, ...newRows].sort((a, b) => rowName(a).localeCompare(rowName(b)));
  }, [venues, itemsByVenueId, addItems]);

  const allItems = useMemo(() => rows.flatMap(rowItems), [rows]);

  const presentSources = useMemo(
    () => [...new Set(allItems.map(itemSourceFilterValue))],
    [allItems],
  );
  const presentLanes = useMemo(
    () => [...new Set(allItems.map(itemLane).filter((lane): lane is ReviewLane => lane !== null))],
    [allItems],
  );

  const quickFilterCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = {
      all: rows.length,
      to_review: 0,
      draft: 0,
      live: 0,
      live_edits_waiting: 0,
      removed: 0,
    };
    for (const row of rows) {
      if (rowNeedsReview(row)) counts.to_review += 1;
      if (row.kind === "venue") counts[statusByVenueId[row.venue.id]] += 1;
    }
    return counts;
  }, [rows, statusByVenueId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (quickFilter === "to_review" && !rowNeedsReview(row)) return false;
      if (quickFilter !== "all" && quickFilter !== "to_review") {
        if (row.kind !== "venue" || statusByVenueId[row.venue.id] !== quickFilter) return false;
      }
      if (categoryFilter !== "all" && rowCategory(row) !== categoryFilter) return false;
      if (sourceFilter !== "all" && !rowItems(row).some((item) => itemSourceFilterValue(item) === sourceFilter)) return false;
      if (laneFilter !== "all" && !rowItems(row).some((item) => itemLane(item) === laneFilter)) return false;
      if (q) {
        const name = rowName(row).toLowerCase();
        const address = rowAddress(row).toLowerCase();
        if (!name.includes(q) && !address.includes(q)) return false;
      }
      return true;
    });
  }, [rows, quickFilter, categoryFilter, sourceFilter, laneFilter, query, statusByVenueId]);

  // Default sort: something-to-review rows first — Array.prototype.sort is
  // stable (guaranteed since ES2019), so this is a partition on top of
  // `filtered`'s existing alphabetical order, not a re-sort of it.
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => Number(rowNeedsReview(b)) - Number(rowNeedsReview(a))),
    [filtered],
  );

  return (
    <div>
      <StatusKey />

      {/* Quick-filter chips (#674, moved the concept of a filter row up from
          the old /admin/flags queue's source/change-type chips). */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {QUICK_FILTER_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setQuickFilter(value)}
            className={filterChipClass(quickFilter === value)}
          >
            {QUICK_FILTER_LABELS[value]}
            {quickFilterCounts[value] > 0 && ` (${quickFilterCounts[value]})`}
          </button>
        ))}
      </div>

      {/* Source/AI-lane filters — moved over from the old /admin/flags
          queue; only shown once there's more than one value present, same
          "don't clutter an all-noise or all-one-source queue" rule that
          queue's own filter row followed. #675: "public" (any submission
          item) is one more value in the SAME chip row, not a separate
          filter group — an admin filtering "where did this come from"
          shouldn't have to look in two places for the answer. */}
      {(presentSources.length > 1 || presentLanes.length > 1) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {presentSources.length > 1 && (
            <>
              <button type="button" onClick={() => setSourceFilter("all")} className={filterChipClass(sourceFilter === "all")}>
                All sources
              </button>
              {presentSources.map((source) => (
                <button key={source} type="button" onClick={() => setSourceFilter(source)} className={filterChipClass(sourceFilter === source)}>
                  {source === "public" ? "The public" : (SOURCE_BADGE[source as ProposalSourceValue]?.label ?? source)}
                </button>
              ))}
            </>
          )}
          {presentLanes.length > 1 && (
            <>
              <span className="mx-1 h-4 w-px bg-[var(--color-bone-300)]" aria-hidden />
              <button type="button" onClick={() => setLaneFilter("all")} className={filterChipClass(laneFilter === "all")}>
                All lanes
              </button>
              {presentLanes.map((lane) => (
                <button key={lane} type="button" onClick={() => setLaneFilter(lane)} className={filterChipClass(laneFilter === lane)}>
                  {LANE_BADGE[lane].label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Search + category filter */}
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

      {sorted.length === 0 ? (
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
                  To review
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
              {sorted.map((row) => (
                <VenueRow key={row.kind === "venue" ? row.venue.id : reviewItemKey(row.item)} row={row} statusByVenueId={statusByVenueId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--color-ink-400)]">
        {sorted.length} of {rows.length} {rows.length === 1 ? "place" : "places"}
      </p>
    </div>
  );
}

function VenueRow({ row, statusByVenueId }: { row: Row; statusByVenueId: Record<string, AdminDisplayStatus> }) {
  if (row.kind === "new") {
    const { item } = row;
    return (
      <tr className="border-b border-[var(--color-bone-200)] last:border-0 hover:bg-[var(--color-bone-100)]">
        <td className="px-4 py-3 font-medium">
          <Link
            href={newItemHref(item)}
            className={
              "text-[var(--color-sage-700)] underline underline-offset-2 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded"
            }
          >
            {rowName(row)}
          </Link>
        </td>
        <td className="px-4 py-3 text-[var(--color-ink-700)]">
          {(() => {
            const category = rowCategory(row);
            return category ? categoryLabels[category] : "—";
          })()}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center rounded-full bg-[var(--color-clay-100)] px-2 py-0.5 text-xs font-medium text-[var(--color-clay-700)]">
              Suggested new place
            </span>
            {item.kind === "submission" && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PUBLIC_BADGE_CLASS}`}>
                Public
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <ReviewCell items={[item]} />
        </td>
        <td className="px-4 py-3 text-[var(--color-ink-500)]">{rowAddress(row) || "—"}</td>
        <td className="px-4 py-3 text-[var(--color-ink-500)]">—</td>
      </tr>
    );
  }

  const { venue, items } = row;
  // #674: an archived venue's name is normally plain text (#568 review
  // finding — PATCH refuses to SAVE an archived edit with a 409, so a link
  // that always dead-ends there isn't a real action) — UNLESS it has a
  // pending review item, in which case the edit page's own "Suggestions to
  // review" box (SuggestionsBox.tsx) IS a real, independent action
  // (approve/reject a restore, mark done/reject a report — a totally
  // different write path from the PATCH that box's own save button would
  // 409 on).
  const isArchivedRowLinkable = venue.status !== "archived" || items.length > 0;

  return (
    <tr className="border-b border-[var(--color-bone-200)] last:border-0 hover:bg-[var(--color-bone-100)]">
      <td className="px-4 py-3 font-medium">
        {isArchivedRowLinkable ? (
          <Link
            href={`/admin/venues/${venue.id}/edit`}
            className={
              "text-[var(--color-sage-700)] underline underline-offset-2 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded"
            }
          >
            {venue.name}
          </Link>
        ) : (
          <span className="text-[var(--color-ink-700)]">{venue.name}</span>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--color-ink-700)]">{categoryLabels[venue.category]}</td>
      <td className="px-4 py-3">
        <StatusBadge status={statusByVenueId[venue.id]} />
      </td>
      <td className="px-4 py-3">
        <ReviewCell items={items} />
      </td>
      <td className="px-4 py-3 text-[var(--color-ink-500)]">{venue.address}</td>
      <td className="px-4 py-3 text-[var(--color-ink-500)]">{formatLastVerified(venue.last_verified)}</td>
    </tr>
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
