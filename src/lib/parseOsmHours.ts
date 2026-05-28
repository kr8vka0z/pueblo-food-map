/**
 * parseOsmHours — convert OSM `opening_hours` strings to the app's WeeklyHours
 * schema and extract an optional notes/operator residue.
 *
 * Handles:
 *   "24/7"
 *   "Mo-Su 08:00-17:00"
 *   "Mo-Sa 08:00-18:00"
 *   "Mo-Su 06:00-24:00"
 *   "05:00-24:00"   (no day prefix → all days)
 *   "Mo,Tu,Th-Sa 08:30-21:06; We 08:00-21:06; Su 09:00-19:35"
 *
 * Does NOT handle month-qualified rules (Jan-Dec), PH (public holidays),
 * or sunrise/sunset offsets — these fall through to best-effort.
 */

import type { WeeklyHours } from "@/types/venue";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const ALL_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// OSM abbreviation → index (0=Mon … 6=Sun)
const OSM_DAY_INDEX: Record<string, number> = {
  Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6,
};

const INDEX_TO_KEY: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Expand an OSM day selector like "Mo", "Mo-Sa", "Mo,Tu,Th-Sa" into an array of DayKey. */
function expandDaySelector(selector: string): DayKey[] {
  const days = new Set<DayKey>();
  // Split by comma first (handles Mo,Tu,Th-Sa)
  for (const part of selector.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startAbbr, endAbbr] = trimmed.split("-");
      const start = OSM_DAY_INDEX[startAbbr.trim()];
      const end = OSM_DAY_INDEX[endAbbr.trim()];
      if (start !== undefined && end !== undefined) {
        for (let i = start; i <= end; i++) {
          days.add(INDEX_TO_KEY[i]);
        }
      }
    } else {
      const idx = OSM_DAY_INDEX[trimmed];
      if (idx !== undefined) {
        days.add(INDEX_TO_KEY[idx]);
      }
    }
  }
  return [...days];
}

export interface ParseResult {
  /** The parsed weekly hours, or undefined if nothing could be parsed. */
  hours_weekly: WeeklyHours | undefined;
  /**
   * Any residue text that was NOT a day/time specification.
   * Stripped of leading "·" and whitespace.
   */
  residue: string | undefined;
}

/**
 * Parse an OSM `opening_hours` value into WeeklyHours + leftover residue.
 *
 * @param raw  The raw OSM opening_hours string (e.g. "Mo-Su 08:00-17:00").
 * @returns    { hours_weekly, residue }
 */
export function parseOsmHours(raw: string): ParseResult {
  if (!raw || !raw.trim()) {
    return { hours_weekly: undefined, residue: undefined };
  }

  const trimmed = raw.trim();

  // Strip any trailing "· ..." residue before parsing hours
  // Residue separator is " · " (OSM convention for taginfo extras)
  const bulletIdx = trimmed.indexOf(" · ");
  let hoursStr = bulletIdx >= 0 ? trimmed.slice(0, bulletIdx).trim() : trimmed;
  const residueRaw = bulletIdx >= 0 ? trimmed.slice(bulletIdx + 3).trim() : undefined;

  // "24/7" shorthand → all days 00:00-24:00
  if (hoursStr === "24/7") {
    const hours_weekly: WeeklyHours = {};
    for (const d of ALL_DAYS) hours_weekly[d] = ["00:00-24:00"];
    return { hours_weekly, residue: residueRaw || undefined };
  }

  const hours_weekly: WeeklyHours = {};
  let parseFailed = false;

  // Split into semicolon-separated rules (for compound expressions)
  const rules = hoursStr.split(";").map((r) => r.trim()).filter(Boolean);

  for (const rule of rules) {
    // Patterns:
    //   "Mo-Su 08:00-17:00"  → day selector + time range
    //   "Mo,Tu 09:00-17:00"  → comma list day selector + time range
    //   "08:00-21:00"         → bare time range (no day prefix) → all days
    const m = rule.match(
      /^([A-Z][a-z](?:[,-][A-Z][a-z])*(?:,[A-Z][a-z](?:[,-][A-Z][a-z])*)*)\s+(\d{2}:\d{2}-\d{2}:\d{2})$/
    );
    if (m) {
      const daySel = m[1];
      const timeRange = m[2];
      const days = expandDaySelector(daySel);
      if (days.length > 0) {
        for (const d of days) {
          hours_weekly[d] = [timeRange];
        }
      } else {
        parseFailed = true;
      }
    } else {
      // Try bare time range (no day prefix)
      const bareTime = rule.match(/^(\d{2}:\d{2}-\d{2}:\d{2})$/);
      if (bareTime) {
        const timeRange = bareTime[1];
        for (const d of ALL_DAYS) {
          hours_weekly[d] = [timeRange];
        }
      } else {
        // Unrecognized rule — mark parse as partial but keep what we have
        parseFailed = true;
      }
    }
  }

  const hasAnyHours = Object.keys(hours_weekly).length > 0;

  return {
    hours_weekly: hasAnyHours ? hours_weekly : undefined,
    residue: residueRaw || undefined,
  };
}

/**
 * Parse the full OSM notes string as used in grocery-osm.ts:
 *   "Hours (OSM opening_hours): <value>"
 *
 * Returns the same ParseResult as parseOsmHours.
 * Returns { hours_weekly: undefined, residue: undefined } for non-matching input.
 */
export function parseOsmNotesString(notes: string): ParseResult {
  const prefix = "Hours (OSM opening_hours): ";
  if (!notes.startsWith(prefix)) {
    return { hours_weekly: undefined, residue: undefined };
  }
  const inner = notes.slice(prefix.length);
  return parseOsmHours(inner);
}
