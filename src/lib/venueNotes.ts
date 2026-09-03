/**
 * Selects which venues' `notes` field is worth showing a user.
 *
 * Two failure modes in the raw data collapse to "don't render":
 *   1. OSM raw-tag artifacts (e.g. "Hours (OSM opening_hours): ...") — #98.
 *   2. Plentiful's auto-generated boilerplate (board review finding #3):
 *      the directory scraper writes a note that just restates the venue's
 *      own name/address/phone in prose — e.g. "Center Toward Self-Reliance.
 *      in Pueblo, CO. Phone: (719) 546-1271." — pure filler, zero information
 *      beyond what the card already shows in its name/phone fields.
 *
 * WHY a shared selector, not per-render regex: BottomSheet and
 * DesktopVenueWindow (collapsed body + expanded "About" section) each render
 * notes independently — duplicating this logic three times risks the guards
 * drifting apart, which is exactly how the #98 OSM guard almost happened
 * twice. The fix lives here instead of the data file because
 * published-venues.ts is regenerated from D1 on every admin publish — a
 * hand-edit there is silently overwritten on the next publish.
 */
import type { Venue } from "@/types/venue";

const OSM_ARTIFACT_PATTERN = /osm/i;

/**
 * True when `notes` is exactly Plentiful's auto-generated filler shape:
 * "{name}. in Pueblo, CO." optionally followed by " Phone: {phone}." or
 * " Hours and directions available." — every clause either repeats a field
 * already shown elsewhere on the card (name, phone) or carries no
 * information at all.
 *
 * Conservative by construction (spec: "when in doubt, show the note") —
 * matches only these exact known suffixes via strict equality, not a fuzzy
 * prefix match. A genuinely informative note that happens to start with the
 * venue's own name (plausible, never seen in the current data) still
 * renders: it fails the strict suffix check below and falls through.
 */
function isBoilerplatePlentifulNote(venue: Venue): boolean {
  if (!venue.notes) return false;
  const prefix = `${venue.name}. in Pueblo, CO.`;
  if (!venue.notes.startsWith(prefix)) return false;
  const rest = venue.notes.slice(prefix.length);
  if (rest === "") return true;
  if (rest === " Hours and directions available.") return true;
  if (venue.phone && rest === ` Phone: ${venue.phone}.`) return true;
  return false;
}

/**
 * Returns `notes` if it carries real information, or `undefined` if it
 * should be suppressed (OSM artifact or Plentiful boilerplate). Callers
 * render conditionally on this return value instead of re-deriving the guard.
 */
export function getDisplayNotes(venue: Venue): string | undefined {
  if (!venue.notes) return undefined;
  if (OSM_ARTIFACT_PATTERN.test(venue.notes)) return undefined;
  if (isBoilerplatePlentifulNote(venue)) return undefined;
  return venue.notes;
}
