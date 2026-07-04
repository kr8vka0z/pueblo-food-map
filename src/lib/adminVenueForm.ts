/**
 * adminVenueForm.ts — maps a full D1 `venues` row to AddVenueForm's
 * `initialValues` shape (#255, "Edit or remove a venue").
 *
 * Kept as a plain, framework-free function (no "use client") so both the
 * Server Component edit page (src/app/admin/venues/[id]/edit/page.tsx,
 * which cannot import runtime code from a "use client" module) and this
 * file's own unit tests can call it directly — same lib/component split as
 * adminVenueValidation.ts vs. AddVenueForm.tsx's client-side validateClient().
 *
 * This is the inverse of AddVenueForm.tsx's own buildHoursWeekly(): that
 * function goes form-draft -> WeeklyHours JSON for a POST/PATCH body; this
 * one goes a stored `hours_weekly` JSON column -> form-draft text so an
 * existing venue's hours pre-fill the same per-day text inputs a fresh
 * create form uses.
 */

import type { AddVenueFormValues } from "@/components/AddVenueForm";
import { DISPLAY_DAY_KEYS, type DayKey } from "@/lib/hours";
import type { AdminVenueRow, WeeklyHours } from "@/types/venue";

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
