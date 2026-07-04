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
