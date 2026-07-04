/**
 * adminVenues.ts — small pure helpers for the read-only admin venue list
 * (#253: src/app/admin/page.tsx, src/components/VenueListView.tsx).
 *
 * Kept separate from VenueListView.tsx so the status label map and the
 * unpublished-changes predicate are unit-testable without mounting a
 * component (see adminVenues.test.ts).
 */

import type { AdminVenueRow, AdminVenueStatus } from "@/types/venue";

/** Human labels for each admin venue status — Status column badge + status filter select. */
export const STATUS_LABELS: Record<AdminVenueStatus, string> = {
  published: "Live",
  draft: "Draft",
  archived: "Removed",
};

/**
 * True when a row carries changes the public map hasn't seen yet: every
 * draft (by definition never published), or a published row edited since
 * its last publish. `published_at` is NULL until first publish (schema
 * comment, migrations/0001_init_admin_schema.sql) — the explicit
 * `!== null` guard means a draft can never accidentally match the second
 * clause via how `>` happens to coerce a null operand; the status check
 * already covers drafts on its own.
 */
export function hasUnpublishedChanges(row: AdminVenueRow): boolean {
  if (row.status === "draft") return true;
  return row.published_at !== null && row.updated_at > row.published_at;
}

export interface PublishChangeSummary {
  newDrafts: number;
  editedSincePublish: number;
  archived: number;
}

/**
 * Change-summary counts for the admin's Publish panel (#256): what a Publish
 * click would actually do, computed from the same `SELECT *` rows
 * src/app/admin/page.tsx already loads for VenueListView — no second query.
 *
 * - `newDrafts`: every `draft` row (never been on the public map).
 * - `editedSincePublish`: `published` rows edited since their last publish
 *   (`updated_at > published_at`) — the published branch of
 *   `hasUnpublishedChanges` above, but explicitly gated on
 *   `status === 'published'` here (that function's second branch isn't
 *   status-gated at all) so an archived row can never double-count into
 *   this bucket too.
 * - `archived`: `archived` rows that were PREVIOUSLY PUBLISHED
 *   (`published_at !== null`) — these are what will actually disappear from
 *   the public map on the next publish. A draft that got archived
 *   (`published_at` still null) was never live, so archiving it changes
 *   nothing the public map shows; it must not inflate this count.
 */
export function summarizePublishChanges(rows: AdminVenueRow[]): PublishChangeSummary {
  let newDrafts = 0;
  let editedSincePublish = 0;
  let archived = 0;

  for (const row of rows) {
    switch (row.status) {
      case "draft":
        newDrafts += 1;
        break;
      case "published":
        if (row.published_at !== null && row.updated_at > row.published_at) editedSincePublish += 1;
        break;
      case "archived":
        if (row.published_at !== null) archived += 1;
        break;
    }
  }

  return { newDrafts, editedSincePublish, archived };
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
