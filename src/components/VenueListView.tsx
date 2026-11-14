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
 * file directly, but SOURCE_BADGE/LANE_BADGE and
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
import { useMemo, useRef, useState } from "react";
import { categoryLabels } from "@/lib/categories";
import CategoryLabel from "@/components/CategoryLabel";
import { inputClass } from "@/components/formClasses";
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
  tableRowClass,
  tableWrapClass,
  tagClass,
  type TagTone,
} from "@/lib/adminCardStyles";
import { DISPLAY_STATUS_KEY, DISPLAY_STATUS_LABELS, formatLastVerified, type AdminDisplayStatus } from "@/lib/adminVenues";
import { SOURCE_BADGE, LANE_BADGE } from "@/components/ProposalCard";
import { fieldLabel } from "@/lib/fieldLabels";
import { openRowLink } from "@/lib/rowLinkClick";
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

// Draft is the yellow caution tag (DESIGN.md "Lists and tables").
const STATUS_TONE: Record<AdminDisplayStatus, TagTone> = {
  live: "calm",
  draft: "caution",
  live_edits_waiting: "attention",
  removed: "quiet",
};

// A public item carries the same "needs a look" tone as SubmissionCard's
// "Public report" tag, so it reads the same everywhere it appears.
const PUBLIC_TONE: TagTone = "attention";

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
 * (fieldLabel, src/lib/fieldLabels.ts) so a field name never reads
 * differently in the two places it's shown.
 */
const REVIEW_FIELD_WORD: Record<string, string> = {
  phone: "phone number",
  url: "website",
  address: "address",
  hours_weekly: "hours",
  hours_irregular: "monthly hours",
  // fieldLabel's "Accepts SNAP" lowercased would read "New accepts snap".
  accepts_snap: "SNAP status",
  accepts_wic: "WIC status",
  category: "category",
  name: "name",
  operator: "operator",
};

export function summarizeProposalForRow(p: Extract<ReviewItem, { kind: "proposal" }>["proposal"]): string {
  if (p.parseError) return "Suggested change: couldn't read details";
  const { row, diff } = p;
  if (row.source === "link_health") return "Website link broken";
  if (renameMetaOf(diff)) return "Listed under a new name";
  if (row.change_type === "remove") return "Looks closed: suggests removal";
  if (row.change_type === "add") return "Suggested new place";
  const fields = reviewableDiffFields(diff);
  // Care and Share review-only cards (scripts/refresh/careAndShare.ts) — not "still current".
  // SNAP/WIC "not on the list" check (scripts/refresh/benefitLists.ts): it also carries needs_review, so before the hours line.
  const list = diff.meta?.benefit_list as { field?: unknown; finding?: unknown } | undefined;
  if (fields.length === 0 && list?.finding === "not_listed") {
    return `Not on the ${list.field === "accepts_wic" ? "WIC" : "SNAP"} list: please check`;
  }
  // A ticked venue's "maybe" card (a list record that also looks like another of our places) changes no field.
  if (fields.length === 0 && list?.finding === "maybe_listed") return `${list.field === "accepts_wic" ? "WIC" : "SNAP"} list: same place?`;
  if (fields.length === 0 && diff.meta?.match) return "Care and Share listing: same place?";
  if (fields.length === 0 && diff.meta?.needs_review) return "Hours need a look";
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
  // ink 500, not 400: the row's hover tint (sage 100) needs ink 500 or darker.
  if (items.length === 0) return <span className="text-[var(--color-ink-500)]">—</span>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const lane = itemLane(item);
        const badge = lane ? LANE_BADGE[lane] : { label: "Public", tone: PUBLIC_TONE };
        return (
          <li key={reviewItemKey(item)} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--color-ink-700)]">{summarizeItemForRow(item)}</span>
            <span className={tagClass(badge.tone)}>{badge.label}</span>
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
  const searchRef = useRef<HTMLInputElement>(null);

  const hasFilters =
    query.trim() !== "" || quickFilter !== "all" || categoryFilter !== "all" || sourceFilter !== "all" || laneFilter !== "all";

  // Clear filters (DESIGN.md Patterns, empty after a filter): resets the
  // search box too, then puts focus on it, since the button itself goes away.
  function clearFilters() {
    setQuery("");
    setQuickFilter("all");
    setCategoryFilter("all");
    setSourceFilter("all");
    setLaneFilter("all");
    searchRef.current?.focus();
  }

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
      <div role="group" aria-label="Filter places by status" className="mb-3 flex flex-wrap items-center gap-2">
        {QUICK_FILTER_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setQuickFilter(value)}
            aria-pressed={quickFilter === value}
            className={chipClass(quickFilter === value)}
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
          item) is one more value in the source row, not a separate filter
          group — an admin filtering "where did this come from" shouldn't
          have to look in two places for the answer. Sources and lanes are
          two rows that wrap on their own (#926), not one row split by a
          divider that ended up orphaned or mid-row. */}
      {presentSources.length > 1 && (
        <div role="group" aria-label="Filter by source" className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSourceFilter("all")}
            aria-pressed={sourceFilter === "all"}
            className={chipClass(sourceFilter === "all")}
          >
            All sources
          </button>
          {presentSources.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setSourceFilter(source)}
              aria-pressed={sourceFilter === source}
              className={chipClass(sourceFilter === source)}
            >
              {source === "public" ? "The public" : (SOURCE_BADGE[source as ProposalSourceValue]?.label ?? source)}
            </button>
          ))}
        </div>
      )}
      {presentLanes.length > 1 && (
        <div role="group" aria-label="Filter by lane" className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLaneFilter("all")}
            aria-pressed={laneFilter === "all"}
            className={chipClass(laneFilter === "all")}
          >
            All lanes
          </button>
          {presentLanes.map((lane) => (
            <button
              key={lane}
              type="button"
              onClick={() => setLaneFilter(lane)}
              aria-pressed={laneFilter === lane}
              className={chipClass(laneFilter === lane)}
            >
              {LANE_BADGE[lane].label}
            </button>
          ))}
        </div>
      )}

      {/* Search + category filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="venue-search" className={controlLabelClass}>
            Search
          </label>
          <input
            ref={searchRef}
            id="venue-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or address"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="venue-category-filter" className={controlLabelClass}>
            Category
          </label>
          <select
            id="venue-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className={inputClass}
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
        <div className={emptyStateClass}>
          <p>{hasFilters ? "No places match your search or filters." : "No places yet."}</p>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={tableWrapClass}>
          {/* WHY 1080 with a 240 name and a 200 address column: at 680 the name
              was squeezed to 125 on a phone and wrapped to four lines, and the
              address to 101 and five lines. Now a name takes two lines at most
              and the table scrolls sideways inside its box (#926). */}
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className={tableHeadRowClass}>
                <th scope="col" className={`${tableHeadCellClass} min-w-[240px]`}>
                  Name
                </th>
                <th scope="col" className={tableHeadCellClass}>
                  Category
                </th>
                <th scope="col" className={tableHeadCellClass}>
                  Status
                </th>
                <th scope="col" className={tableHeadCellClass}>
                  To review
                </th>
                <th scope="col" className={`${tableHeadCellClass} min-w-[200px]`}>
                  Address
                </th>
                <th scope="col" className={tableHeadCellClass}>
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

/** The kind of place in its public colored words (CategoryLabel, R3); SNAP and WIC only when the row says so. */
function CategoryCell({ category, snap = false, wic = false }: { category: VenueCategory | null; snap?: boolean; wic?: boolean }) {
  if (!category) return <span className="text-[var(--color-ink-500)]">—</span>;
  const benefits = [snap && "SNAP", wic && "WIC"].filter((b): b is string => typeof b === "string");
  return <CategoryLabel category={category} label={categoryLabels[category]} benefits={benefits} className={CATEGORY_ON_ROW_CLASS} />;
}

// While the row is tinted sage 100 under the pointer (tableLinkRowClass is a
// `group`), every word in the label turns ink 700 (10.2 to 1) and returns to
// its colour when the pointer leaves, at the row's own 150 ms. WHY: on sage
// 100 the category colours fall to 3.4-4.1 to 1 and the ink 400 dots to 4.2
// (DESIGN.md Colors: category words never sit on the hover fill). WHY `!`:
// CategoryLabel sets the category colour as an inline style, which only an
// important rule beats; `*:` reaches its spans, which are direct children.
const CATEGORY_ON_ROW_CLASS =
  "text-sm *:transition-colors *:duration-150 group-hover:*:text-[var(--color-ink-700)]!";

function VenueRow({ row, statusByVenueId }: { row: Row; statusByVenueId: Record<string, AdminDisplayStatus> }) {
  if (row.kind === "new") {
    const { item } = row;
    return (
      <tr className={tableLinkRowClass} onClick={openRowLink}>
        <td className={`${tableCellClass} font-medium`}>
          <Link href={newItemHref(item)} data-row-link className={linkClass}>
            {rowName(row)}
          </Link>
        </td>
        <td className={`${tableCellClass} text-[var(--color-ink-700)]`}>
          <CategoryCell category={rowCategory(row)} />
        </td>
        <td className={tableCellClass}>
          <div className="flex flex-wrap items-center gap-1">
            <span className={tagClass("attention")}>Suggested new place</span>
            {item.kind === "submission" && <span className={tagClass(PUBLIC_TONE)}>Public</span>}
          </div>
        </td>
        <td className={tableCellClass}>
          <ReviewCell items={[item]} />
        </td>
        <td className={`${tableCellClass} text-[var(--color-ink-500)]`}>{rowAddress(row) || "—"}</td>
        <td className={`${tableCellClass} text-[var(--color-ink-500)]`}>—</td>
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
    // The row tint, and a click anywhere on the row, only where the name
    // links somewhere (#926 decision 1; src/lib/rowLinkClick.ts).
    <tr
      className={isArchivedRowLinkable ? tableLinkRowClass : tableRowClass}
      onClick={isArchivedRowLinkable ? openRowLink : undefined}
    >
      <td className={`${tableCellClass} font-medium`}>
        {isArchivedRowLinkable ? (
          <Link href={`/admin/venues/${venue.id}/edit`} data-row-link className={linkClass}>
            {venue.name}
          </Link>
        ) : (
          <span className="text-[var(--color-ink-700)]">{venue.name}</span>
        )}
      </td>
      <td className={`${tableCellClass} text-[var(--color-ink-700)]`}>
        <CategoryCell category={venue.category} snap={venue.accepts_snap === 1} wic={venue.accepts_wic === 1} />
      </td>
      <td className={tableCellClass}>
        <StatusBadge status={statusByVenueId[venue.id]} />
      </td>
      <td className={tableCellClass}>
        <ReviewCell items={items} />
      </td>
      <td className={`${tableCellClass} text-[var(--color-ink-500)]`}>{venue.address}</td>
      <td className={`${tableCellClass} whitespace-nowrap text-[var(--color-ink-500)]`}>{formatLastVerified(venue.last_verified)}</td>
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
  return <span className={tagClass(STATUS_TONE[status])}>{DISPLAY_STATUS_LABELS[status]}</span>;
}
