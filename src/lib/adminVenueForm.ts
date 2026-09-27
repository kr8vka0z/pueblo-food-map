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

import type { AddVenueFormValues, IrregularEntryDraft } from "@/components/AddVenueForm";
import { DISPLAY_DAY_KEYS, type DayKey } from "@/lib/hours";
import { categoryLabels } from "@/data/venues";
import type { AdminVenueRow, IrregularSchedule, Venue, VenueCategory, WeeklyHours } from "@/types/venue";
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
 * A blank per-day draft — every day's text field empty. Shared starting
 * point for both hoursWeeklyJsonToDraft (below) and
 * mapAddProposalToFormValues's own hours_weekly handling (a proposal's
 * `after.hours_weekly` is an already-parsed WeeklyHours object, not JSON
 * text, so it skips the JSON.parse step but needs the same blank base).
 */
function emptyHoursDraft(): Record<DayKey, string> {
  const draft = {} as Record<DayKey, string>;
  for (const day of DISPLAY_DAY_KEYS) draft[day] = "";
  return draft;
}

/**
 * A parsed WeeklyHours object -> one comma-joined text field per day,
 * matching the shape AddVenueForm's per-day inputs edit directly. Extracted
 * from hoursWeeklyJsonToDraft (below) so mapAddProposalToFormValues can
 * reuse the exact same day-by-day mapping on an already-parsed object
 * (ProposedDiff.after carries Venue.hours_weekly as WeeklyHours, never as
 * D1's JSON-text column form) rather than a second hand-copied loop.
 */
function weeklyHoursObjectToDraft(parsed: WeeklyHours): Record<DayKey, string> {
  const draft = emptyHoursDraft();
  for (const day of DISPLAY_DAY_KEYS) {
    const slots = parsed[day];
    if (slots && slots.length > 0) draft[day] = slots.join(", ");
  }
  return draft;
}

/**
 * `hours_weekly` JSON text (or null) -> one comma-joined text field per day,
 * matching the shape AddVenueForm's per-day inputs edit directly. Malformed
 * stored JSON degrades to every day blank rather than throwing — a data
 * problem in an existing row should never crash the edit page itself.
 */
function hoursWeeklyJsonToDraft(json: string | null): Record<DayKey, string> {
  if (!json) return emptyHoursDraft();

  let parsed: WeeklyHours;
  try {
    parsed = JSON.parse(json) as WeeklyHours;
  } catch {
    return emptyHoursDraft();
  }

  return weeklyHoursObjectToDraft(parsed);
}

/**
 * A parsed IrregularSchedule[] -> editable draft rows. Extracted from
 * hoursIrregularJsonToDraft (below) for the same reuse reason
 * weeklyHoursObjectToDraft was split out above — mapAddProposalToFormValues
 * gets an already-parsed array (ProposedDiff.after's shape), not JSON text.
 * `day_of_month`/`ordinal` are converted to strings (String(1) not "1") to
 * match the select/input values IrregularEntryDraft's fields bind to.
 */
function irregularArrayToDraft(parsed: IrregularSchedule[]): IrregularEntryDraft[] {
  return parsed.map((entry) => ({
    recurrence: entry.recurrence,
    ordinal: entry.ordinal !== undefined ? (String(entry.ordinal) as IrregularEntryDraft["ordinal"]) : "",
    weekday: entry.weekday ?? "",
    dayOfMonth: entry.day_of_month !== undefined ? String(entry.day_of_month) : "",
    slots: (entry.slots ?? []).join(", "),
    note: entry.note ?? "",
  }));
}

/**
 * `hours_irregular` JSON text (or null) -> a list of editable draft rows,
 * mirroring hoursWeeklyJsonToDraft()'s own "malformed JSON degrades to
 * empty, never throws" contract — a data problem in an existing row must
 * never crash the edit page.
 */
function hoursIrregularJsonToDraft(json: string | null): IrregularEntryDraft[] {
  if (!json) return [];

  let parsed: IrregularSchedule[];
  try {
    parsed = JSON.parse(json) as IrregularSchedule[];
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return irregularArrayToDraft(parsed);
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
    hoursIrregular: hoursIrregularJsonToDraft(row.hours_irregular),
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

/**
 * Maps a pending `change_proposals` "add" row's `proposed_diff.after` (a
 * `Partial<Venue>` — scripts/refresh/diffEngine.ts's buildProposal for a
 * fresh add always writes the FULL incoming venue there, never a partial
 * one) to `Partial<AddVenueFormValues>` — the same target shape
 * mapVenueRowToFormValues()/mapSubmissionPayloadToFormValues() above
 * produce (issue #674, "fold Data refresh into Places": a genuinely-new
 * `add` proposal now opens /admin/venues/new?proposal=<id> prefilled from
 * here, instead of the old /admin/flags queue's one-click, unedited
 * Approve).
 *
 * Every field is read defensively (Partial<Venue>, not Venue) even though
 * diffEngine never emits a partial one today — a malformed or
 * hand-corrected proposed_diff row must degrade to a blank field the admin
 * fills in, never crash the pre-fill.
 *
 * category reconciliation mirrors mapSubmissionPayloadToFormValues()'s own
 * VALID_CATEGORIES check: `after.category` is trusted D1/scraper data, not
 * form input, but a category value outside VenueCategory (a schema
 * drift, a future source) must still degrade to the form's own "select a
 * category" empty state rather than crash validateCreateVenuePayload() at
 * save time with no chance for the admin to see why.
 */
export function mapAddProposalToFormValues(after: Partial<Venue>): Partial<AddVenueFormValues> {
  const category = after.category && VALID_CATEGORIES.has(after.category) ? after.category : "";

  return {
    name: after.name ?? "",
    category,
    address: after.address ?? "",
    lastVerified: after.last_verified ?? "",
    lat: after.lat !== undefined ? String(after.lat) : "",
    lng: after.lng !== undefined ? String(after.lng) : "",
    hours: after.hours_weekly ? weeklyHoursObjectToDraft(after.hours_weekly) : emptyHoursDraft(),
    hoursIrregular: after.hours_irregular ? irregularArrayToDraft(after.hours_irregular) : [],
    acceptsSnap: after.accepts_snap === undefined ? "" : after.accepts_snap ? "1" : "0",
    acceptsWic: after.accepts_wic === undefined ? "" : after.accepts_wic ? "1" : "0",
    phone: after.phone ?? "",
    email: after.email ?? "",
    url: after.url ?? "",
    operator: after.operator ?? "",
    notes: after.notes ?? "",
    source: after.source ?? "",
  };
}
