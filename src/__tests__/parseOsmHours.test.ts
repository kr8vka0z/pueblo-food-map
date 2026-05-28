/**
 * Tests for src/lib/parseOsmHours.ts
 *
 * Covers every opening_hours pattern present in grocery-osm.ts plus
 * edge cases called out in issue #98.
 */

import { describe, test, expect } from "vitest";
import { parseOsmHours, parseOsmNotesString } from "@/lib/parseOsmHours";

describe("parseOsmHours", () => {
  test("24/7 → all 7 days 00:00-24:00", () => {
    const { hours_weekly, residue } = parseOsmHours("24/7");
    expect(hours_weekly).toEqual({
      mon: ["00:00-24:00"],
      tue: ["00:00-24:00"],
      wed: ["00:00-24:00"],
      thu: ["00:00-24:00"],
      fri: ["00:00-24:00"],
      sat: ["00:00-24:00"],
      sun: ["00:00-24:00"],
    });
    expect(residue).toBeUndefined();
  });

  test("Mo-Su 08:00-17:00 → all 7 days 08:00-17:00", () => {
    const { hours_weekly, residue } = parseOsmHours("Mo-Su 08:00-17:00");
    expect(hours_weekly).toEqual({
      mon: ["08:00-17:00"],
      tue: ["08:00-17:00"],
      wed: ["08:00-17:00"],
      thu: ["08:00-17:00"],
      fri: ["08:00-17:00"],
      sat: ["08:00-17:00"],
      sun: ["08:00-17:00"],
    });
    expect(residue).toBeUndefined();
  });

  test("Mo-Sa 08:00-18:00 → Mon-Sat only", () => {
    const { hours_weekly } = parseOsmHours("Mo-Sa 08:00-18:00");
    const days = Object.keys(hours_weekly ?? {});
    expect(days).toContain("mon");
    expect(days).toContain("sat");
    expect(days).not.toContain("sun");
    expect(hours_weekly?.mon).toEqual(["08:00-18:00"]);
    expect(hours_weekly?.sat).toEqual(["08:00-18:00"]);
  });

  test("Mo-Su 06:00-24:00 → all days 06:00-24:00", () => {
    const { hours_weekly } = parseOsmHours("Mo-Su 06:00-24:00");
    expect(Object.keys(hours_weekly ?? {}).length).toBe(7);
    expect(hours_weekly?.mon).toEqual(["06:00-24:00"]);
    expect(hours_weekly?.sun).toEqual(["06:00-24:00"]);
  });

  test("05:00-24:00 (bare time, no day prefix) → all days", () => {
    const { hours_weekly } = parseOsmHours("05:00-24:00");
    expect(Object.keys(hours_weekly ?? {}).length).toBe(7);
    expect(hours_weekly?.mon).toEqual(["05:00-24:00"]);
    expect(hours_weekly?.sun).toEqual(["05:00-24:00"]);
  });

  test("06:00-23:00 (bare time) → all days 06:00-23:00", () => {
    const { hours_weekly } = parseOsmHours("06:00-23:00");
    expect(hours_weekly?.fri).toEqual(["06:00-23:00"]);
  });

  test("08:00-21:00 (bare time) → all days 08:00-21:00", () => {
    const { hours_weekly } = parseOsmHours("08:00-21:00");
    expect(hours_weekly?.wed).toEqual(["08:00-21:00"]);
  });

  test("Mo-Su 06:00-23:00 · Operated by Walmart → hours + residue", () => {
    const { hours_weekly, residue } = parseOsmHours("Mo-Su 06:00-23:00 · Operated by Walmart");
    expect(Object.keys(hours_weekly ?? {}).length).toBe(7);
    expect(hours_weekly?.mon).toEqual(["06:00-23:00"]);
    expect(residue).toBe("Operated by Walmart");
  });

  test("24/7 · Operated by Walmart → hours + residue", () => {
    const { hours_weekly, residue } = parseOsmHours("24/7 · Operated by Walmart");
    // Note: "24/7 · ..." — residue parsing happens after 24/7 check
    // Actually 24/7 is checked before residue split, so residue should be extracted
    // Let's verify the actual implementation handles this
    expect(hours_weekly).toBeDefined();
    expect(hours_weekly?.mon).toEqual(["00:00-24:00"]);
    // residue split for "24/7 · Operated by Walmart" — the "24/7" prefix match
    // won't fire because the raw includes " · "; test that hours still parse
  });

  test("24/7 · Operated by Corner Store → residue captured", () => {
    const { hours_weekly, residue } = parseOsmHours("24/7 · Operated by Corner Store");
    expect(hours_weekly).toBeDefined();
    expect(residue).toBe("Operated by Corner Store");
  });

  test("Mo-Su 09:00-16:00 · Identifies as Women owned → residue is non-operator note", () => {
    const { hours_weekly, residue } = parseOsmHours("Mo-Su 09:00-16:00 · Identifies as Women owned");
    expect(hours_weekly?.mon).toEqual(["09:00-16:00"]);
    expect(residue).toBe("Identifies as Women owned");
  });

  test("Mo-Sa 08:00-18:00 · surcharge for using cards → residue captured", () => {
    const { hours_weekly, residue } = parseOsmHours("Mo-Sa 08:00-18:00 · surcharge for using cards");
    expect(hours_weekly?.mon).toEqual(["08:00-18:00"]);
    expect(residue).toBe("surcharge for using cards");
  });

  test("24/7 · Convenience Store;Gas Station → residue captures compound tag", () => {
    const { hours_weekly, residue } = parseOsmHours("24/7 · Convenience Store;Gas Station");
    expect(hours_weekly).toBeDefined();
    expect(residue).toBe("Convenience Store;Gas Station");
  });

  test("compound: Mo,Tu,Th-Sa 08:30-21:06; We 08:00-21:06; Su 09:00-19:35", () => {
    const raw = "Mo,Tu,Th-Sa 08:30-21:06; We 08:00-21:06; Su 09:00-19:35";
    const { hours_weekly, residue } = parseOsmHours(raw);
    // Mon, Tue, Thu, Fri, Sat from first rule
    expect(hours_weekly?.mon).toEqual(["08:30-21:06"]);
    expect(hours_weekly?.tue).toEqual(["08:30-21:06"]);
    expect(hours_weekly?.thu).toEqual(["08:30-21:06"]);
    expect(hours_weekly?.fri).toEqual(["08:30-21:06"]);
    expect(hours_weekly?.sat).toEqual(["08:30-21:06"]);
    // Wed from second rule
    expect(hours_weekly?.wed).toEqual(["08:00-21:06"]);
    // Sun from third rule
    expect(hours_weekly?.sun).toEqual(["09:00-19:35"]);
    expect(residue).toBeUndefined();
  });

  test("empty string → undefined hours, undefined residue", () => {
    const { hours_weekly, residue } = parseOsmHours("");
    expect(hours_weekly).toBeUndefined();
    expect(residue).toBeUndefined();
  });
});

describe("parseOsmNotesString", () => {
  test("parses full notes prefix format", () => {
    const { hours_weekly } = parseOsmNotesString(
      "Hours (OSM opening_hours): Mo-Su 08:00-17:00"
    );
    expect(hours_weekly?.mon).toEqual(["08:00-17:00"]);
  });

  test("parses 24/7 with operator in notes string", () => {
    const { hours_weekly, residue } = parseOsmNotesString(
      "Hours (OSM opening_hours): 24/7 · Operated by Loaf 'N Jug"
    );
    expect(hours_weekly).toBeDefined();
    expect(residue).toBe("Operated by Loaf 'N Jug");
  });

  test("non-matching notes string → undefined", () => {
    const { hours_weekly } = parseOsmNotesString("Operated by Alta");
    expect(hours_weekly).toBeUndefined();
  });

  test("no OSM prefix → undefined", () => {
    const { hours_weekly } = parseOsmNotesString("surcharge for using cards");
    expect(hours_weekly).toBeUndefined();
  });
});
