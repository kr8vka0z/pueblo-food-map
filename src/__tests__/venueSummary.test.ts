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
  nearbyVenues,
  FREE_CATEGORIES,
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

  test("weekly hours are covered in words, grouped by consecutive identical days", () => {
    const v = fixture({
      hours_weekly: {
        mon: ["09:00-17:00"],
        tue: ["09:00-17:00"],
        wed: ["09:00-17:00"],
        sat: ["10:00-14:00"],
      },
    });
    const summary = buildVenueSummary(v, "en").join(" ");
    expect(summary).toContain("Mon–Wed, 9am – 5pm");
    expect(summary).toContain("Sat, 10am – 2pm");
  });

  test("hours_irregular is covered in words, with the admin note stripped", () => {
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
    // day.fri is the abbreviated form ("Fri") — matches every other hours
    // display in this app (HoursList, formatSlot's own day labels).
    expect(summary).toContain("2nd Fri of each month");
    expect(summary).not.toContain("Unverified admin note");
  });

  test("24-hour slots use the localized 'Open 24 hours' string, not the English literal, in ES", () => {
    const v = fixture({ hours_weekly: { mon: ["00:00-24:00"] } });
    const summary = buildVenueSummary(v, "es").join(" ");
    expect(summary).not.toContain("Open 24 hours");
    expect(summary).toContain("24 horas");
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

// ─── City parsing ────────────────────────────────────────────────────────────

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
