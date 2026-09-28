/**
 * Unit tests for src/lib/venueSummary.ts — issue #704 (SEO/AEO plan Phase 2).
 *
 * Every fixture here is synthetic (never a real venue's name/hours/phone —
 * AGENTS.md / this repo's coder-agent convention: a test pinned to today's
 * published data breaks the first admin Publish). Title/description budget
 * tests below run over the REAL published venue set, but only assert a
 * length invariant, never a literal string.
 */

import { describe, test, expect } from "vitest";
import {
  buildVenueSummary,
  buildVenueMetaDescription,
  buildVenueTitle,
  parseVenueCity,
  parseVenueCityCore,
  nearbyVenues,
  FREE_CATEGORIES,
  PLACEHOLDER_ADDRESS,
} from "@/lib/venueSummary";
import { venues } from "@/data/venues";
import { SITE_NAME } from "@/lib/site";
import type { Venue } from "@/types/venue";

function fixture(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test-fixture-venue",
    name: "Test Fixture Pantry",
    category: "pantry",
    lat: 38.27,
    lng: -104.61,
    address: "100 Test St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-05-12",
    ...overrides,
  };
}

// ─── Truth rules ─────────────────────────────────────────────────────────────

describe("buildVenueSummary — truth rules", () => {
  test("'free' wording appears only for the 4 free categories (EN)", () => {
    for (const category of [
      "pantry",
      "meal_site",
      "garden",
      "edible_landscape",
      "grocery",
      "convenience",
      "farm",
    ] as const) {
      const v = fixture({ category });
      const summary = buildVenueSummary(v, "en").join(" ");
      expect(summary.toLowerCase().includes("free")).toBe(FREE_CATEGORIES.has(category));
    }
  });

  test("'free'/'gratuit-' wording appears only for the 4 free categories (ES)", () => {
    for (const category of [
      "pantry",
      "meal_site",
      "garden",
      "edible_landscape",
      "grocery",
      "convenience",
      "farm",
    ] as const) {
      const v = fixture({ category });
      const summary = buildVenueSummary(v, "es").join(" ");
      expect(summary.toLowerCase().includes("gratuit")).toBe(FREE_CATEGORIES.has(category));
    }
  });

  test("SNAP is mentioned only when accepts_snap === true", () => {
    expect(buildVenueSummary(fixture({ accepts_snap: true })).join(" ")).toContain("SNAP");
    expect(buildVenueSummary(fixture({ accepts_snap: false })).join(" ")).not.toContain("SNAP");
    expect(buildVenueSummary(fixture({ accepts_snap: undefined })).join(" ")).not.toContain("SNAP");
  });

  test("WIC is mentioned only when accepts_wic === true", () => {
    expect(buildVenueSummary(fixture({ accepts_wic: true })).join(" ")).toContain("WIC");
    expect(buildVenueSummary(fixture({ accepts_wic: false })).join(" ")).not.toContain("WIC");
    expect(buildVenueSummary(fixture({ accepts_wic: undefined })).join(" ")).not.toContain("WIC");
  });

  test("both SNAP and WIC in one sentence when both are confirmed", () => {
    const summary = buildVenueSummary(fixture({ accepts_snap: true, accepts_wic: true })).join(" ");
    expect(summary).toContain("SNAP/EBT and WIC");
  });

  test("no hours sentence when neither hours_weekly nor hours_irregular is set", () => {
    const v = fixture({ hours_weekly: undefined, hours_irregular: undefined });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary.toLowerCase()).not.toContain("open");
    expect(summary.toLowerCase()).not.toContain("hours unknown");
  });

  test("weekly hours are covered in words: 'Hours: {range}, {times}.' — single day plural, range as full weekday names", () => {
    const v = fixture({
      hours_weekly: {
        mon: ["09:00-17:00"],
        tue: ["09:00-17:00"],
        wed: ["09:00-17:00"],
        sat: ["10:00-14:00"],
      },
    });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary).toContain("Hours: Monday to Wednesday, 9am – 5pm; Saturdays, 10am – 2pm.");
  });

  test("ES hours prefix is gender-neutral 'Horario:' regardless of the venue's gendered 'what' phrase", () => {
    const v = fixture({ category: "meal_site", hours_weekly: { fri: ["11:00-14:00"] } });
    const summary = buildVenueSummary(v, "es").join(" ");
    expect(summary).toContain("Horario: los viernes, 11am – 2pm.");
    expect(summary).not.toContain("Está abierto");
  });

  test("a day's own multiple slots are SORTED by start time and joined with 'and', not left in data order", () => {
    // Real-data regression (Pueblo Community Soup Kitchen): slots stored as
    // [10:30am-12pm, 8:30am-9:30am] — out of order — previously rendered as
    // nonsense prose. Sorted, the earlier slot comes first.
    const v = fixture({ hours_weekly: { mon: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"] } });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary).toContain("Hours: Mondays, 8:30am – 9:30am and 10:30am – 12pm.");
  });

  test("multiple day-groups are separated by '; ', never ambiguous with the intra-day 'and'/comma", () => {
    // Real-data regression (The Pueblo Shelter/SafeSide Recovery): weekday
    // group has ONE slot, Friday has TWO — old comma-only joining made the
    // whole thing read as one flat, ambiguous list.
    const v = fixture({
      hours_weekly: {
        mon: ["4:30 PM - 5:00 PM"],
        tue: ["4:30 PM - 5:00 PM"],
        wed: ["4:30 PM - 5:00 PM"],
        thu: ["4:30 PM - 5:00 PM"],
        fri: ["2:00 PM - 4:00 PM", "4:30 PM - 5:00 PM"],
        sat: ["4:30 PM - 5:00 PM"],
        sun: ["4:30 PM - 5:00 PM"],
      },
    });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary).toContain(
      "Hours: Monday to Thursday, 4:30pm – 5pm; Fridays, 2pm – 4pm and 4:30pm – 5pm; Saturday to Sunday, 4:30pm – 5pm.",
    );
  });

  test("all 7 days, all the SAME time → 'every day', not 'Mon–Sun'", () => {
    const v = fixture({
      hours_weekly: {
        mon: ["09:00-17:00"],
        tue: ["09:00-17:00"],
        wed: ["09:00-17:00"],
        thu: ["09:00-17:00"],
        fri: ["09:00-17:00"],
        sat: ["09:00-17:00"],
        sun: ["09:00-17:00"],
      },
    });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary).toContain("Hours: every day, 9am – 5pm.");
  });

  test("all 7 days, literal 24-hour slot → the fixed 'Open 24 hours, every day.' phrase, not the general template", () => {
    // Real-data regression: ~8 convenience stores render every day as
    // "00:00-24:00" — the old grouper produced "Mon–Sun, Open 24 hours."
    const allDays24h = {
      mon: ["00:00-24:00"],
      tue: ["00:00-24:00"],
      wed: ["00:00-24:00"],
      thu: ["00:00-24:00"],
      fri: ["00:00-24:00"],
      sat: ["00:00-24:00"],
      sun: ["00:00-24:00"],
    };
    const v = fixture({ hours_weekly: allDays24h });
    expect(buildVenueSummary(v, "en").join(" ")).toContain("Hours: Open 24 hours, every day.");
    // ES: routed through localizedSlot, so no English literal leaks in.
    const summaryEs = buildVenueSummary(v, "es").join(" ");
    expect(summaryEs).toContain("Horario: Abierto las 24 horas, todos los días.");
    expect(summaryEs).not.toContain("Open 24 hours");
  });

  test("hours_irregular (monthly_ordinal) is covered in words, with the admin note stripped", () => {
    const v = fixture({
      hours_weekly: undefined,
      hours_irregular: [
        {
          recurrence: "monthly_ordinal",
          ordinal: 2,
          weekday: "fri",
          slots: ["10:00-15:45"],
          note: "Unverified admin note that must never appear in an answer-first summary",
        },
      ],
    });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary).toContain("Hours: the 2nd Friday of each month, 10am – 3:45pm.");
    expect(summary).not.toContain("Unverified admin note");
  });

  test("hours_irregular 'last' ordinal renders lowercase mid-sentence ('last', not 'Last')", () => {
    const v = fixture({
      hours_irregular: [
        { recurrence: "monthly_ordinal", ordinal: "last", weekday: "tue", slots: ["11:00-12:00"] },
      ],
    });
    expect(buildVenueSummary(v, "en").join(" ")).toContain("the last Tuesday of each month, 11am – 12pm.");
    expect(buildVenueSummary(v, "es").join(" ")).toContain("el último martes de cada mes, 11am – 12pm.");
  });

  test("hours_irregular (monthly_date)", () => {
    const v = fixture({ hours_irregular: [{ recurrence: "monthly_date", day_of_month: 15, slots: ["09:00-11:00"] }] });
    expect(buildVenueSummary(v, "en").join(" ")).toContain("Hours: the 15 of each month, 9am – 11am.");
  });

  test("hours_irregular recurrence 'other' (no computable date, note untrusted) contributes nothing", () => {
    const v = fixture({
      hours_weekly: undefined,
      hours_irregular: [{ recurrence: "other", slots: [], note: "call ahead, unverified" }],
    });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary.toLowerCase()).not.toContain("open");
    expect(summary).not.toContain("call ahead");
  });

  test("last verified renders as 'Month YYYY' from last_verified, no Intl on the client path", () => {
    const v = fixture({ last_verified: "2026-09-15" });
    expect(buildVenueSummary(v, "en").join(" ")).toContain("Last verified September 2026.");
    expect(buildVenueSummary(v, "es").join(" ")).toContain("septiembre 2026");
  });

  test("never claims eligibility, ID, or income requirements", () => {
    const summary = buildVenueSummary(fixture()).join(" ").toLowerCase();
    for (const forbidden of ["eligib", "id required", "no id", "income", "immigration"]) {
      expect(summary).not.toContain(forbidden);
    }
  });
});

// ─── Main sentence: address option + OSM placeholder guard (#705 review) ───

describe("buildVenueSummary — main sentence address handling", () => {
  test("default (includeAddress unset) includes the full street address", () => {
    const summary = buildVenueSummary(fixture()).join(" ");
    expect(summary).toContain("at 100 Test St, Pueblo, CO 81003.");
  });

  test("includeAddress: false omits the street address and uses the city instead", () => {
    const summary = buildVenueSummary(fixture(), "en", { includeAddress: false }).join(" ");
    expect(summary).not.toContain("100 Test St");
    expect(summary).toContain("Test Fixture Pantry is a free food pantry in Pueblo, CO.");
  });

  test("the OSM placeholder address never reaches the summary, even with includeAddress: true (the default)", () => {
    const v = fixture({ address: PLACEHOLDER_ADDRESS });
    const summary = buildVenueSummary(v, "en", { includeAddress: true }).join(" ");
    expect(summary).not.toContain(PLACEHOLDER_ADDRESS);
    // No parseable city in a bare placeholder string → falls back to "Pueblo County".
    expect(summary).toContain("Test Fixture Pantry is a free food pantry in Pueblo County, CO.");
  });

  test("ES: includeAddress false / placeholder guard produce the gender-agreeing no-address template", () => {
    const v = fixture({ address: PLACEHOLDER_ADDRESS });
    expect(buildVenueSummary(v, "es").join(" ")).toContain(
      "Test Fixture Pantry es una despensa de alimentos gratuita en el Condado de Pueblo, CO.",
    );
  });
});

// ─── City parsing ────────────────────────────────────────────────────────────

describe("parseVenueCityCore (no locale, no fallback text)", () => {
  test("returns the parsed city", () => {
    expect(parseVenueCityCore("215 Canal St, Pueblo, CO 81004")).toBe("Pueblo");
  });

  test("returns null when no city can be parsed (never fallback prose)", () => {
    expect(parseVenueCityCore("Mineral Palace Park")).toBeNull();
    expect(parseVenueCityCore("West Carrizo Springs Avenue, CO")).toBeNull();
  });
});

describe("parseVenueCity", () => {
  test("street, city, CO zip", () => {
    expect(parseVenueCity("215 Canal St, Pueblo, CO 81004")).toBe("Pueblo");
  });

  test("street, city, CO (no zip)", () => {
    expect(parseVenueCity("136 S Purcell Blvd, Pueblo West, CO")).toBe("Pueblo West");
  });

  test("street, city zip (no CO segment)", () => {
    expect(parseVenueCity("1242 S Prairie Ave, Pueblo 81004")).toBe("Pueblo");
  });

  test("street, city (no state or zip)", () => {
    expect(parseVenueCity("410 Main Street, Boone")).toBe("Boone");
  });

  test("street, CO with no city segment falls back", () => {
    expect(parseVenueCity("West Carrizo Springs Avenue, CO")).toBe("Pueblo County");
  });

  test("a bare landmark name (no comma) falls back", () => {
    expect(parseVenueCity("Mineral Palace Park")).toBe("Pueblo County");
  });

  test("ES fallback is Spanish", () => {
    expect(parseVenueCity("Mineral Palace Park", "es")).toBe("el Condado de Pueblo");
  });
});

// ─── Title budget (real published venues, length invariant only) ───────────

describe("buildVenueTitle — length budget over all published venues", () => {
  test("full rendered <title> (title + ' · Pueblo Food Map') is <= 70 chars, EN and ES, and the name is never truncated", () => {
    let longest = 0;
    let longestTitle = "";
    for (const v of venues) {
      const nameOnlyLen = `${v.name} · ${SITE_NAME}`.length;
      for (const locale of ["en", "es"] as const) {
        const title = buildVenueTitle(v, locale);
        const rendered = `${title} · ${SITE_NAME}`;
        // The budget is unreachable ONLY when the venue's own name plus the
        // brand suffix already exceeds 70 chars — "never truncate the name"
        // (issue #704 Decisions) forces the ladder to bottom out at the bare
        // name in that case, which is the best achievable result, not a bug.
        if (nameOnlyLen > 70) {
          expect(title, `${locale} ${v.id}`).toBe(v.name);
        } else {
          expect(rendered.length, `${locale} ${v.id}: "${rendered}"`).toBeLessThanOrEqual(70);
        }
        // The name itself must appear somewhere in the title — never cut.
        expect(title, `${locale} ${v.id}`).toContain(v.name);
        if (rendered.length > longest) {
          longest = rendered.length;
          longestTitle = rendered;
        }
      }
    }
    // Sanity: at least confirms the loop ran and recorded something.
    expect(longest).toBeGreaterThan(0);
    console.log(`Longest rendered venue <title> (${longest} chars): ${longestTitle}`);
  });
});

// ─── Meta description budget (real published venues) ───────────────────────

describe("buildVenueMetaDescription — length budget over all published venues", () => {
  test("description is <= 160 chars for every venue, EN and ES", () => {
    for (const v of venues) {
      for (const locale of ["en", "es"] as const) {
        const description = buildVenueMetaDescription(v, locale);
        expect(description.length, `${locale} ${v.id}`).toBeLessThanOrEqual(160);
      }
    }
  });

  test("description is built from whole sentences (ends with a period)", () => {
    for (const v of venues.slice(0, 15)) {
      const description = buildVenueMetaDescription(v);
      expect(description.endsWith(".")).toBe(true);
    }
  });

  test("a synthetic venue whose first sentence alone exceeds 160 chars falls back to a word-boundary trim", () => {
    const v = fixture({
      name: "A".repeat(140),
      address: "200 Very Long Street Name That Pushes This Sentence Well Past The Description Budget, Pueblo, CO 81003",
    });
    const description = buildVenueMetaDescription(v);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith(" ")).toBe(false);
  });

  test("a sentence too long to fit is SKIPPED, not a hard stop — a later, shorter sentence still gets included", () => {
    // Real-data regression (Natural Grocers): main + a long multi-group
    // hours sentence together exceed 160, dropping the short "It accepts
    // SNAP/EBT." sentence that would otherwise fit. `continue` (not
    // `break`) keeps trying every remaining sentence.
    const v = fixture({
      name: "A Fairly Long Grocery Store Name For This Test Fixture",
      category: "grocery",
      address: "9999 A Reasonably Long Street Name, Pueblo, CO 81003",
      accepts_snap: true,
      hours_weekly: {
        mon: ["08:30-21:06"],
        tue: ["08:30-21:06"],
        wed: ["08:00-21:06"],
        thu: ["08:30-21:06"],
        fri: ["08:30-21:06"],
        sat: ["08:30-21:06"],
        sun: ["09:00-19:35"],
      },
    });
    const description = buildVenueMetaDescription(v);
    expect(description).not.toContain("Hours:"); // too long to fit — skipped
    expect(description).toContain("It accepts SNAP/EBT.");
  });
});

// ─── Nearby ───────────────────────────────────────────────────────────────

describe("nearbyVenues", () => {
  const base = fixture({ id: "origin", lat: 38.27, lng: -104.61, category: "pantry" });

  test("returns same-category venues, nearest first, excluding self", () => {
    const all = [
      base,
      fixture({ id: "far", name: "Far Pantry", category: "pantry", lat: 38.5, lng: -104.9 }),
      fixture({ id: "near", name: "Near Pantry", category: "pantry", lat: 38.271, lng: -104.611 }),
      fixture({ id: "wrong-category", name: "Grocery", category: "grocery", lat: 38.271, lng: -104.611 }),
    ];
    const result = nearbyVenues(base, all);
    expect(result.map((r) => r.id)).toEqual(["near", "far"]);
    expect(result.every((r) => r.id !== "origin")).toBe(true);
  });

  test("caps at max (default 5)", () => {
    const all = [
      base,
      ...Array.from({ length: 8 }, (_, i) =>
        fixture({
          id: `p${i}`,
          name: `Pantry ${i}`,
          category: "pantry",
          lat: 38.27 + i * 0.001,
          lng: -104.61,
        }),
      ),
    ];
    expect(nearbyVenues(base, all)).toHaveLength(5);
  });

  test("fewer than 3 available: returns what exists", () => {
    const all = [base, fixture({ id: "only-other", name: "Only Other", category: "pantry" })];
    expect(nearbyVenues(base, all)).toHaveLength(1);
  });

  test("zero same-category venues: returns an empty array", () => {
    const all = [base, fixture({ id: "g", category: "grocery" })];
    expect(nearbyVenues(base, all)).toEqual([]);
  });
});
