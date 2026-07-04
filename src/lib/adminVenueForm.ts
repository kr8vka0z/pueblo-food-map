/**
 * adminVenueForm.ts — maps a full D1 `venues` row to AddVenueForm's
 * `initialValues` shape (#255, "Edit or remove a venue"); also maps a
 * pending `public_submissions` "new_venue" payload to that same shape
 * (#259, the review queue's "Approve" -> pre-filled create form).
 *
 * Kept as a plain, framework-free function (no "use client") so both the
 * Server Component pages (src/app/admin/venues/[id]/edit/page.tsx and
 * src/app/admin/venues/new/page.tsx, neither of which can import runtime
 * code from a "use client" module) and this file's own unit tests can call
 * these mappers directly — same lib/component split as
 * adminVenueValidation.ts vs. AddVenueForm.tsx's client-side validateClient().
 *
 * mapVenueRowToFormValues() is the inverse of AddVenueForm.tsx's own
 * buildHoursWeekly(): that function goes form-draft -> WeeklyHours JSON for
 * a POST/PATCH body; this one goes a stored `hours_weekly` JSON column ->
 * form-draft text so an existing venue's hours pre-fill the same per-day
 * text inputs a fresh create form uses.
 */

import type { AddVenueFormValues } from "@/components/AddVenueForm";
import { DISPLAY_DAY_KEYS, type DayKey } from "@/lib/hours";
import { categoryLabels } from "@/data/venues";
import type { AdminVenueRow, VenueCategory, WeeklyHours } from "@/types/venue";
import type { NewVenuePayload } from "@/lib/publicSubmissions";

// Same technique adminVenueValidation.ts's VALID_CATEGORIES and
// VenueListView.tsx's ALL_CATEGORIES already use: the category labels map's
// own keys as the 7-value enum source of truth, rather than a 5th
// hand-maintained copy of the list.
const VALID_CATEGORIES = new Set(Object.keys(categoryLabels) as VenueCategory[]);

/** D1 tri-state (NULL=unknown, 0=no, 1=yes) -> the form's select value. */
function triStateToFormValue(value: number | null): "" | "1" | "0" {
  if (value === 1) return "1";
  if (value === 0) return "0";
  return "";
}

/**
 * `hours_weekly` JSON text (or null) -> one comma-joined text field per day,
 * matching the shape AddVenueForm's per-day inputs edit directly. Malformed
 * stored JSON degrades to every day blank rather than throwing — a data
 * problem in an existing row should never crash the edit page itself.
 */
function hoursWeeklyJsonToDraft(json: string | null): Record<DayKey, string> {
  const draft = {} as Record<DayKey, string>;
  for (const day of DISPLAY_DAY_KEYS) draft[day] = "";
  if (!json) return draft;

  let parsed: WeeklyHours;
  try {
    parsed = JSON.parse(json) as WeeklyHours;
  } catch {
    return draft;
  }

  for (const day of DISPLAY_DAY_KEYS) {
    const slots = parsed[day];
    if (slots && slots.length > 0) draft[day] = slots.join(", ");
  }
  return draft;
}

/**
 * Maps a full `AdminVenueRow` to `Partial<AddVenueFormValues>` — the exact
 * shape AddVenueForm's `initialValues` prop already accepts, so the edit
 * page can pass this straight through with no adapter step in the page
 * itself.
 */
export function mapVenueRowToFormValues(row: AdminVenueRow): Partial<AddVenueFormValues> {
  return {
    name: row.name,
    category: row.category,
    address: row.address,
    lastVerified: row.last_verified,
    lat: String(row.lat),
    lng: String(row.lng),
    hours: hoursWeeklyJsonToDraft(row.hours_weekly),
    acceptsSnap: triStateToFormValue(row.accepts_snap),
    acceptsWic: triStateToFormValue(row.accepts_wic),
    phone: row.phone ?? "",
    email: row.email ?? "",
    url: row.url ?? "",
    operator: row.operator ?? "",
    notes: row.notes ?? "",
    source: row.source,
    outsideCounty: row.outside_county === 1,
  };
}

/**
 * Maps a pending `public_submissions` "new_venue" payload (#258's write
 * shape, src/lib/publicSubmissions.ts's NewVenuePayload) to
 * `Partial<AddVenueFormValues>` — the same target shape
 * mapVenueRowToFormValues() above produces, so /admin/venues/new can render
 * `<AddVenueForm initialValues={...} />` identically regardless of which
 * mapper filled it in.
 *
 * Category reconciliation: the public suggest form's category comes from
 * VENUE_CATEGORIES / VenueCategoryKey (src/lib/suggestTypes.ts) — a
 * separately-maintained 7-value map that happens to match VenueCategory
 * (src/types/venue.ts) key-for-key today (both files' own comments say so),
 * but the two are independent sources with no shared import, so nothing
 * stops them from drifting apart later. Passing through blindly risks
 * validateCreateVenuePayload() (src/lib/adminVenueValidation.ts) rejecting
 * the create outright the moment they ever do — checking against
 * VALID_CATEGORIES and falling back to "" (the form's own "select a
 * category" empty state) instead means a future drift degrades to "admin
 * picks the category," never a broken pre-fill.
 *
 * ponytail: the notes prefill is lossy-but-safe — hours/contact/
 * submitterEmail have no dedicated AddVenueForm fields of their own (hours
 * here is unstructured submitter text, not the per-day WeeklyHours shape
 * the form's own hours grid edits), so they're folded into the free-text
 * notes field under a labeled separator rather than silently dropped. The
 * admin reads and edits notes before saving either way. Upgrade path if this
 * ever proves lossy in practice: parse the submitter's free-text hours into
 * the structured per-day grid instead of leaving that to prose.
 */
export function mapSubmissionPayloadToFormValues(payload: NewVenuePayload): Partial<AddVenueFormValues> {
  const category = VALID_CATEGORIES.has(payload.category as VenueCategory)
    ? (payload.category as VenueCategory)
    : "";

  const notes = [
    payload.notes,
    "",
    "— From public submission —",
    payload.hours && `Hours: ${payload.hours}`,
    payload.contact && `Contact: ${payload.contact}`,
    `Submitted by: ${payload.submitterEmail}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return {
    name: payload.venueName,
    address: payload.address,
    category,
    acceptsSnap: payload.acceptsSnap ? "1" : "0",
    acceptsWic: payload.acceptsWic ? "1" : "0",
    notes,
    source: "Public suggestion",
  };
}
