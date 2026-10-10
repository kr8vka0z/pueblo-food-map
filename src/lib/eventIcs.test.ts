/**
 * eventIcs.test.ts — the .ics output (#759): RFC 5545 escaping, 75-octet
 * folding, CRLF endings and absolute UTC instants across a daylight-saving
 * change. A calendar app silently drops or mangles a malformed file, so these
 * are the behaviors worth pinning.
 */

import { describe, expect, test } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine } from "@/lib/eventIcs";
import { puebloLocalToUtcIso } from "@/lib/eventTime";

const base = {
  id: "abc-123",
  summary: "Produce giveaway",
  description: "Free produce",
  location: "1 Main St, Pueblo, CO",
  startsAt: "2026-11-21T17:00:00.000Z",
  endsAt: "2026-11-21T21:00:00.000Z",
  url: "https://pueblofoodmap.com/?event=abc-123",
};
const NOW = new Date("2026-10-10T12:00:00.000Z");

describe("escapeIcsText", () => {
  test("escapes backslash, semicolon, comma and newlines (backslash first, so escapes aren't doubled)", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldIcsLine", () => {
  test("leaves a short line alone and folds a long one at 75 octets with a leading space", () => {
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
    const folded = foldIcsLine("DESCRIPTION:" + "x".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts[0]).toHaveLength(75);
    for (const cont of parts.slice(1)) {
      expect(cont.startsWith(" ")).toBe(true);
      expect(cont.length).toBeLessThanOrEqual(75);
    }
    // Unfolding (drop each CRLF+space) restores the original line.
    expect(parts.join("").replace(/ /g, "").length).toBe(("DESCRIPTION:" + "x".repeat(200)).length);
  });

  test("never splits a multi-byte character: every folded line is at most 75 bytes and decodes cleanly", () => {
    const line = "DESCRIPTION:" + "ñá€😀".repeat(40);
    const parts = foldIcsLine(line).split("\r\n");
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    const unfolded = parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("");
    expect(unfolded).toBe(line);
  });
});

describe("buildIcs", () => {
  test("uses CRLF for every line break and ends with one", () => {
    const ics = buildIcs(base, NOW);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  test("writes absolute UTC instants, a stable UID, and the location and link", () => {
    const ics = buildIcs(base, NOW);
    expect(ics).toContain("DTSTART:20261121T170000Z\r\n");
    expect(ics).toContain("DTEND:20261121T210000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261010T120000Z\r\n");
    expect(ics).toContain("UID:event-abc-123@pueblofoodmap.com\r\n");
    expect(ics).toContain("LOCATION:1 Main St\\, Pueblo\\, CO\r\n");
    expect(ics).toContain("URL:https://pueblofoodmap.com/?event=abc-123\r\n");
    expect(buildIcs(base, new Date("2027-01-01T00:00:00.000Z"))).toContain("UID:event-abc-123@pueblofoodmap.com");
  });

  test("keeps the true instant across the fall-back change: 10 AM Denver is 16:00Z on Oct 31 (MDT) and 17:00Z on Nov 1 (MST)", () => {
    // Denver falls back on 2026-11-01: Oct 31 is MDT (UTC-6), Nov 1 and later MST (UTC-7).
    const beforeStart = puebloLocalToUtcIso("2026-10-31T10:00")!;
    const afterStart = puebloLocalToUtcIso("2026-11-01T10:00")!;
    const across = buildIcs({ ...base, startsAt: beforeStart, endsAt: afterStart }, NOW);
    expect(across).toContain("DTSTART:20261031T160000Z\r\n");
    expect(across).toContain("DTEND:20261101T170000Z\r\n");
  });

  test("escapes text fields and omits DESCRIPTION when there is none", () => {
    const ics = buildIcs({ ...base, summary: "Eggs, milk; bread", description: "Line 1\nLine 2" }, NOW);
    expect(ics).toContain("SUMMARY:Eggs\\, milk\\; bread\r\n");
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2\r\n");
    expect(buildIcs({ ...base, description: "" }, NOW)).not.toContain("DESCRIPTION");
  });
});
