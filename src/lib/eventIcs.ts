/**
 * eventIcs.ts — builds and downloads the "Add to calendar" .ics file for a
 * special event (#759, umbrella #156), entirely in the browser, no dependency.
 *
 * WHY UTC instants (`...Z`): an event happens at one fixed moment in Pueblo.
 * Writing DTSTART/DTEND as absolute UTC lets the visitor's calendar app show it
 * in their own zone correctly, with no VTIMEZONE block and no daylight-saving
 * arithmetic on our side (the feed already stores absolute UTC).
 *
 * RFC 5545 rules this file honors: CRLF line endings, TEXT values escape
 * backslash / semicolon / comma / newline, and content lines are folded at 75
 * octets (bytes, not characters, so "ñ" and "á" in Spanish text are never
 * split mid-sequence). UID is stable per event so re-adding updates the entry
 * instead of duplicating it.
 */

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

export interface IcsEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  /** ISO-8601 UTC instants, as stored. */
  startsAt: string;
  endsAt: string;
  /** The map link that opens this event's card. */
  url: string;
}

/** "2026-11-21T17:00:00.000Z" -> "20261121T170000Z". */
function utcStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes an RFC 5545 TEXT value. Backslash first, or the escapes added after it would be doubled. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds one content line at 75 octets; continuation lines start with a space (which counts toward their 75). */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let currentOctets = 0;
  // Iterating a string yields whole code points, so a surrogate pair is never split.
  for (const ch of line) {
    const octets = encoder.encode(ch).length;
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (currentOctets + octets > limit) {
      parts.push(current);
      current = "";
      currentOctets = 0;
    }
    current += ch;
    currentOctets += octets;
  }
  parts.push(current);
  return parts.join(CRLF + " ");
}

/** The complete .ics document (one VEVENT). `now` is only the DTSTAMP, injectable for tests. */
export function buildIcs(event: IcsEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pueblo Food Map//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@pueblofoodmap.com`,
    `DTSTAMP:${utcStamp(now.getTime())}`,
    `DTSTART:${utcStamp(Date.parse(event.startsAt))}`,
    `DTEND:${utcStamp(Date.parse(event.endsAt))}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    // URL is a URI value, not TEXT: it is not escaped.
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/** Saves `content` as a .ics download. Browser-only; a click on a temporary link, then the object URL is released. */
export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
