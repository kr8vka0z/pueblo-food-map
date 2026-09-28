/**
 * adminVenues.ts — small pure helpers for the read-only admin venue list
 * (#253: src/app/(site)/admin/page.tsx, src/components/VenueListView.tsx; #673
 * "one status per place" rework replaced the old status+"Unpublished
 * changes" pair with a single displayStatusOf()).
 *
 * Kept separate from VenueListView.tsx so the status logic and the
 * publish-change diffing are unit-testable without mounting a component
 * (see adminVenues.test.ts).
 */

import type { AdminVenueRow, AdminVenueStatus } from "@/types/venue";
import type { Venue } from "@/types/venue";
import { validateAndMapRow, type VenueRow } from "@/lib/publishVenues";
import { publishedVenues } from "@/data/published-venues";

/** Human labels for each admin venue status — Status column badge + status filter select. */
export const STATUS_LABELS: Record<AdminVenueStatus, string> = {
  published: "Live",
  draft: "Draft",
  archived: "Removed",
};

// ─── #673: one status per place ─────────────────────────────────────────────

/**
 * The four statuses a non-technical owner sees on the Places tab, replacing
 * the old status column + separate "Unpublished changes" column (which
 * disagreed with each other and flagged every Draft as also "unpublished").
 */
export type AdminDisplayStatus = "draft" | "live" | "live_edits_waiting" | "removed";

export const DISPLAY_STATUS_LABELS: Record<AdminDisplayStatus, string> = {
  draft: "Draft",
  live: "Live",
  live_edits_waiting: "Live · edits waiting",
  removed: "Removed",
};

/** One line per status for the Places tab's status key (#673 pt.2) — exact wording Kyle approved in the issue. */
export const DISPLAY_STATUS_KEY: ReadonlyArray<{ status: AdminDisplayStatus; description: string }> = [
  { status: "draft", description: "New, not on the public map yet." },
  { status: "live", description: "On the public map, exactly as shown." },
  { status: "live_edits_waiting", description: "Approved or saved changes the map doesn't show until Publish." },
  { status: "removed", description: "Taken off the map, kept for the record." },
];

/**
 * Every public-facing Venue field this admin diffs against what's actually
 * live — deliberately excludes `last_verified` (#673 pt.4: a "last checked"
 * bump alone must never flag a place as waiting) and every admin-only D1
 * column (status, source_type, audit columns), which never reach the public
 * Venue shape at all. Shared by displayStatusOf's diff check and
 * diffPublishedFields' "Waiting to publish" box below, so the two can never
 * disagree about what counts as a real change.
 */
const COMPARED_VENUE_FIELDS = [
  "name",
  "category",
  "lat",
  "lng",
  "address",
  "hours_weekly",
  "hours_irregular",
  "accepts_snap",
  "accepts_wic",
  "phone",
  "email",
  "url",
  "notes",
  "operator",
  "source",
] as const;

/** Serializes a Venue for equality comparison, with `last_verified` stripped. Both sides of every comparison below are produced by validateAndMapRow (this file's or a past publish's), so key order — and therefore this string — is deterministic between them. */
function venueSignature(venue: Pick<Venue, (typeof COMPARED_VENUE_FIELDS)[number]>): string {
  const ordered: Record<string, unknown> = {};
  for (const field of COMPARED_VENUE_FIELDS) ordered[field] = venue[field];
  return JSON.stringify(ordered);
}

/**
 * True when `row`'s current D1 state differs from `publishedVenue` (its
 * matching src/data/published-venues.ts entry — what the public map is
 * ACTUALLY serving right now) in any field other than `last_verified`.
 * `row` is run back through validateAndMapRow (publishVenues.ts) — the same
 * function that produced `publishedVenue` at its last publish — so both
 * sides are normalized identically before comparing.
 */
function hasNonTrivialDiff(row: AdminVenueRow, publishedVenue: Venue | undefined): boolean {
  if (!publishedVenue) return true; // published but no matching snapshot entry — can't confirm parity, so flag it rather than hide a real gap
  const mapped = validateAndMapRow(row as VenueRow);
  if (!mapped.ok) return true; // row doesn't even validate as a public Venue right now — certainly not what's live
  return venueSignature(mapped.venue) !== venueSignature(publishedVenue);
}

export interface DisplayStatusOptions {
  /** True on any non-production Worker (`!isProductionWorker(env)`, publishVenues.ts) — staging can never Publish, so "edits waiting" there is always a false alarm (#673 pt.6). */
  isStaging?: boolean;
}

/**
 * The single status a place shows on the Places tab and its edit page
 * (#673). Order matters: blessing boxes are checked first because they are
 * live without publishing regardless of their `status` column (the box
 * create route always inserts `status: 'draft'` as a DB default that's
 * meaningless for a category that never enters the publish pipeline — #673
 * pt.5, "no box ever shows edits waiting").
 */
export function displayStatusOf(
  row: AdminVenueRow,
  publishedVenue: Venue | undefined,
  options: DisplayStatusOptions = {},
): AdminDisplayStatus {
  if (row.category === "blessing_box") return "live";
  if (row.status === "archived") return "removed";
  if (row.status === "draft") return "draft";
  // row.status === "published" from here.
  if (options.isStaging) return "live";
  return hasNonTrivialDiff(row, publishedVenue) ? "live_edits_waiting" : "live";
}

/** Built once per read from the real published snapshot — the same file the public map serves from. */
function buildPublishedVenueById(): Map<string, Venue> {
  return new Map(publishedVenues.map((v) => [v.id, v]));
}

export interface PublishChangeSummary {
  newDrafts: number;
  editedSincePublish: number;
  archived: number;
}

/**
 * Change-summary counts for the admin's Publish panel (#256): what a Publish
 * click would actually do, computed from the same `SELECT *` rows
 * src/app/(site)/admin/page.tsx already loads for VenueListView — no second query.
 *
 * - `newDrafts`: every `draft` row (never been on the public map).
 * - `editedSincePublish`: `published` rows whose displayStatusOf() reads
 *   `live_edits_waiting` (#673) — i.e. actually differs from what's live,
 *   NOT merely `updated_at > published_at` (that old rule counted a
 *   `last_verified`-only bump as "edited," which is exactly the false alarm
 *   #673 was filed to fix). This keeps this count in lockstep with the
 *   Places tab's own per-row status — #673's Done-when criterion ("the
 *   Publish panel's counts match the number of Draft + Live · edits waiting
 *   rows") only holds if both read the same rule.
 * - `archived`: `archived` rows that were PREVIOUSLY PUBLISHED
 *   (`published_at !== null`) AND archived AFTER their last publish
 *   (`updated_at > published_at`) — these are what will actually disappear
 *   from the public map on the NEXT publish. A draft that got archived
 *   (`published_at` still null) was never live, so archiving it changes
 *   nothing the public map shows; it must not inflate this count. The
 *   `updated_at > published_at` half of the guard (bug found in review,
 *   admin dashboard build) matters just as much: without it, an archived row
 *   stayed counted "pending removal" FOREVER after the publish that actually
 *   removed it, because nothing ever advanced its `published_at` past the
 *   original publish date. publishVenues.ts's promotePublishedDrafts()
 *   re-stamps `published_at` on exactly these rows in the same batch a
 *   publish already ships, the same way it already does for
 *   `editedSincePublish` rows (#284) — see that file for the D1 half of this
 *   fix.
 */
export function summarizePublishChanges(rows: AdminVenueRow[]): PublishChangeSummary {
  let newDrafts = 0;
  let editedSincePublish = 0;
  let archived = 0;
  const publishedById = buildPublishedVenueById();

  for (const row of rows) {
    // Boxes never publish (Build Plan architecture call #1 — live, not
    // published) and their create route always inserts status='draft', so
    // without this skip every blessing_box row would count as "1 new
    // place" on the Publish panel forever, with no publish action able to
    // ever clear it.
    if (row.category === "blessing_box") continue;
    switch (row.status) {
      case "draft":
        newDrafts += 1;
        break;
      case "published":
        if (displayStatusOf(row, publishedById.get(row.id)) === "live_edits_waiting") editedSincePublish += 1;
        break;
      case "archived":
        if (row.published_at !== null && row.updated_at > row.published_at) archived += 1;
        break;
    }
  }

  return { newDrafts, editedSincePublish, archived };
}

// ─── #673 pt.3: the edit page's "Waiting to publish" box ───────────────────

/** Human labels for the fields diffPublishedFields() below can report — the field-level "on the map now" -> "after you publish" list. */
const FIELD_LABELS: Record<(typeof COMPARED_VENUE_FIELDS)[number], string> = {
  name: "Name",
  category: "Category",
  lat: "Latitude",
  lng: "Longitude",
  address: "Address",
  hours_weekly: "Hours",
  hours_irregular: "Special hours",
  accepts_snap: "SNAP/EBT",
  accepts_wic: "WIC",
  phone: "Phone",
  email: "Email",
  url: "Website",
  notes: "Notes",
  operator: "Operator",
  source: "Source",
};

/** Renders one Venue field's value as plain text for a non-technical admin — never a raw JSON blob or `undefined`. */
function formatFieldValue(field: string, value: unknown): string {
  // Checked BEFORE the generic "not set" fallback below: Venue.accepts_snap/
  // wic is OMITTED (undefined) rather than `false` for a "no" (tri-state
  // mapping, validateAndMapRow's own comment) — an absent value here means
  // "No," never "not set."
  if (field === "accepts_snap" || field === "accepts_wic") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "(not set)";
  if (field === "hours_weekly" || field === "hours_irregular") return JSON.stringify(value);
  return String(value);
}

export interface FieldDiff {
  /** The AdminVenueRow/Venue column name — also the key attributeFieldChange() below scans audit_log JSON with. */
  field: (typeof COMPARED_VENUE_FIELDS)[number];
  label: string;
  onMapNow: string;
  afterPublish: string;
}

/**
 * The field-level diff for the edit page's "Waiting to publish" box (#673
 * pt.3) — every COMPARED_VENUE_FIELDS entry that differs between `row`'s
 * current D1 state and `publishedVenue` (what the public map is actually
 * serving). Empty for a place displayStatusOf() reads as anything other
 * than `live_edits_waiting` — the box only ever renders when this is
 * non-empty (see the edit page for that gating).
 */
export function diffPublishedFields(row: AdminVenueRow, publishedVenue: Venue | undefined): FieldDiff[] {
  const mapped = validateAndMapRow(row as VenueRow);
  const current = (mapped.ok ? mapped.venue : {}) as Record<string, unknown>;
  const before = (publishedVenue ?? {}) as Record<string, unknown>;
  const diffs: FieldDiff[] = [];
  for (const field of COMPARED_VENUE_FIELDS) {
    if (JSON.stringify(before[field]) === JSON.stringify(current[field])) continue;
    diffs.push({
      field,
      label: FIELD_LABELS[field],
      onMapNow: formatFieldValue(field, before[field]),
      afterPublish: formatFieldValue(field, current[field]),
    });
  }
  return diffs;
}

/** One `audit_log` row for this venue, as read from D1 (SELECT actor_email, before_json, after_json, timestamp). */
export interface VenueAuditEntry {
  actor_email: string;
  before_json: string | null;
  after_json: string;
  timestamp: string;
}

/** One `change_proposals` row's approval — just enough to recognize "this audit_log entry IS that approval" (see attributeFieldChange). */
export interface ApprovedProposalMark {
  actor_email: string;
  applied_at: string;
}

// scripts/refresh/proposalSql.ts's AUTO_APPLY_ACTOR / AI_AUTO_APPLY_ACTOR —
// the refresh pipeline's own auto-apply writes (never a human), duplicated
// here as literals rather than imported because that script lives outside
// src/ (Node, not the Workers runtime) and this file must stay importable
// from both a Worker request and a plain Vitest run.
const AUTO_REFRESH_ACTORS = new Set(["refresh-pipeline", "refresh-pipeline-ai"]);

/**
 * Labels who changed one field, for the "Waiting to publish" box (#673
 * pt.3: "You" / the admin's email / "Automatic data refresh" / "Approved
 * from Data refresh by …").
 *
 * Finds the newest `auditEntries` row (expects newest-first order) whose
 * before/after JSON actually differs on `field`, then classifies its
 * `actor_email`:
 *   - the refresh pipeline's own auto-apply actor -> "Automatic data refresh"
 *   - an admin whose approval of a change_proposals row applied at that
 *     EXACT audit timestamp (`approvedProposalMarks`) -> "Approved from
 *     Data refresh by <email>" — the only D1 signal that tells a proposal
 *     approval apart from a plain hand-edit, since both write an identical
 *     audit_log shape (adminProposals.ts's approve path vs. PATCH
 *     /api/admin/venues/[id] — see that route's own header) with no shared
 *     marker column.
 *   - the viewer's own email -> "You"
 *   - anyone else -> their email, plainly
 * Falls back to `fallbackActorEmail` (the venue row's own `updated_by`) when
 * no audit entry actually shows this field changing — e.g. the audit table
 * doesn't go back far enough, or a data migration touched the column
 * outside the normal write paths.
 */
export function attributeFieldChange(
  field: string,
  auditEntries: VenueAuditEntry[],
  approvedProposalMarks: ApprovedProposalMark[],
  viewerEmail: string,
  fallbackActorEmail: string,
): string {
  const changingEntry = auditEntries.find((entry) => {
    if (!entry.before_json) return false; // create rows (before_json NULL) can't show a field "changing"
    try {
      const before = JSON.parse(entry.before_json) as Record<string, unknown>;
      const after = JSON.parse(entry.after_json) as Record<string, unknown>;
      return JSON.stringify(before[field]) !== JSON.stringify(after[field]);
    } catch {
      return false; // malformed stored JSON — treat as "didn't show this change"
    }
  });

  const actorEmail = changingEntry?.actor_email ?? fallbackActorEmail;
  if (AUTO_REFRESH_ACTORS.has(actorEmail)) return "Automatic data refresh";
  if (
    changingEntry &&
    approvedProposalMarks.some((mark) => mark.actor_email === actorEmail && mark.applied_at === changingEntry.timestamp)
  ) {
    return `Approved from Data refresh by ${actorEmail}`;
  }
  if (actorEmail.toLowerCase() === viewerEmail.toLowerCase()) return "You";
  return actorEmail;
}

/**
 * Formats an ISO date (or date-only "YYYY-MM-DD") string for the "Last
 * verified" column. Pinned to UTC: `last_verified` carries no time
 * component, and `new Date("YYYY-MM-DD")` parses as UTC midnight —
 * formatting in the host's LOCAL timezone (this admin can run from a
 * Mountain-time laptop, not just Cloudflare's UTC edge) would roll the
 * displayed date back a full day on any negative-offset host. Explicitly
 * formatting in UTC keeps the displayed date identical to what's stored.
 */
export function formatLastVerified(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso; // defensive: never crash the table on a malformed row
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
