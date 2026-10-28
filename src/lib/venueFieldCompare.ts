/**
 * venueFieldCompare.ts — the one field-equality rule shared by the refresh
 * pipeline's diff engine (scripts/refresh/diffEngine.ts) and the admin
 * stale-apply, edit and source-switch checks (adminProposals.ts,
 * adminVenueEditSql.ts, sourceSwitch.ts). Both sides must compare a venue
 * field exactly the same way, so there is one copy.
 *
 * WHY its own file (#722): it used to live in diffEngine.ts, which imports
 * node:crypto, so every admin page that imported these few pure functions
 * also bundled the refresh pipeline into the browser. Keep this file free of
 * Node-only imports.
 */

import type { IrregularSchedule, Venue, WeeklyHours } from "@/types/venue";

/** The subset of a D1 `venues` row (migrations/0001_init_admin_schema.sql) this engine reads. */
export interface CurrentVenueRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  hours_weekly: string | null; // JSON string, matches D1 storage — not a parsed object
  hours_irregular: string | null; // JSON IrregularSchedule[] text (#400, migrations/0015) — same storage convention as hours_weekly
  phone: string | null;
  url: string | null;
  operator: string | null;
  last_verified: string;
}

/** Normalizes a WeeklyHours-shaped value (object OR its JSON-string D1 form) for equality comparison. */
export function normalizeHours(value: string | WeeklyHours | undefined | null): string {
  // "" too: a proposal's stored `before` snapshot records an absent hours value as ""
  // (this function's own output), and the stale-apply guard feeds it back in here —
  // JSON.parse("") threw, so approving any "venue had no hours" proposal crashed.
  if (value === null || value === undefined || value === "") return "";
  const parsed = typeof value === "string" ? (JSON.parse(value) as WeeklyHours) : value;
  const sortedDays = Object.keys(parsed).sort();
  const stable: Record<string, string[]> = {};
  for (const day of sortedDays) stable[day] = [...(parsed[day as keyof WeeklyHours] ?? [])];
  return JSON.stringify(stable);
}

/**
 * Normalizes an IrregularSchedule[] (array OR its JSON-string D1 form) for
 * equality (#400). Stricter than normalizeHours above: every entry's keys
 * are sorted, its slots are sorted, and the entries themselves are sorted —
 * the scraper emits entries in page order and an admin-entered or approved
 * row may carry any key order, so without this a re-scrape of an unchanged
 * monthly schedule would propose a noise update every run. An empty list
 * normalizes to "" (same as absent), so the destructive-clear guard below
 * treats `[]` from a scraper hiccup exactly like a missing value.
 */
export function normalizeIrregular(value: string | IrregularSchedule[] | undefined | null): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = typeof value === "string" ? (JSON.parse(value) as IrregularSchedule[]) : value;
  if (!Array.isArray(parsed) || parsed.length === 0) return "";
  const entries = parsed.map((entry) => {
    const record = entry as unknown as Record<string, unknown>;
    const stable: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] === undefined) continue;
      stable[key] = key === "slots" ? [...(record[key] as string[])].sort() : record[key];
    }
    return JSON.stringify(stable);
  });
  return `[${entries.sort().join(",")}]`;
}

// Exported (WHY, #390): src/lib/adminProposals.ts's stale-apply guard (§6.10c)
// needs to re-compare a fresh D1 row against a proposal's `before` snapshot
// using EXACTLY this same equality semantics (same hours_weekly
// normalization, same null-coalescing) — reimplementing it in the admin
// route would let the two comparisons silently drift apart over time.
export function currentFieldValue(row: CurrentVenueRow, field: keyof Venue): unknown {
  if (field === "hours_weekly") return normalizeHours(row.hours_weekly);
  if (field === "hours_irregular") return normalizeIrregular(row.hours_irregular);
  return (row as unknown as Record<string, unknown>)[field] ?? null;
}

/** Same reuse reason as currentFieldValue() above. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a ?? "") === String(b ?? "");
}
