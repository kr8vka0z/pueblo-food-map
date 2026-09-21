/**
 * boxHealth.test.ts — pure-function coverage for the admin box-triage
 * status computation (src/lib/boxHealth.ts). See that file's own header for
 * why this is deliberately independent of blessingBoxes.test.ts's
 * computeBoxStatus coverage.
 */

import { describe, expect, test } from "vitest";
import { computeBoxHealth, rankNeedsHelp, rankQuiet, type BoxHealthCheckin, type BoxHealthEntry } from "@/lib/boxHealth";

const NOW = new Date("2026-09-21T12:00:00.000Z");

function checkin(overrides: Partial<BoxHealthCheckin>): BoxHealthCheckin {
  return { kind: "filled", visibility: "visible", createdAt: "2026-09-20T12:00:00.000Z", ...overrides };
}

describe("computeBoxHealth", () => {
  test("no check-ins at all -> quiet, no days figure", () => {
    expect(computeBoxHealth([], NOW)).toEqual({ status: "quiet", latest: null, daysSinceLastReport: null });
  });

  test("latest visible check-in is 'filled' within 30 days -> ok", () => {
    const c = checkin({ kind: "filled", createdAt: "2026-09-20T12:00:00.000Z" }); // 1 day ago
    expect(computeBoxHealth([c], NOW)).toEqual({ status: "ok", latest: c, daysSinceLastReport: 1 });
  });

  test("latest visible check-in is 'took' within 30 days -> ok", () => {
    const c = checkin({ kind: "took", createdAt: "2026-09-19T12:00:00.000Z" });
    expect(computeBoxHealth([c], NOW).status).toBe("ok");
  });

  test("latest visible check-in is 'low' -> low, regardless of age", () => {
    const c = checkin({ kind: "low", createdAt: "2026-06-01T12:00:00.000Z" }); // ~112 days ago
    const result = computeBoxHealth([c], NOW);
    expect(result.status).toBe("low");
    expect(result.daysSinceLastReport).toBeGreaterThan(30);
  });

  test("latest visible check-in is 'empty' -> empty, no age cap", () => {
    const c = checkin({ kind: "empty", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(computeBoxHealth([c], NOW).status).toBe("empty");
  });

  test("latest visible check-in is 'problem' -> problem, no age cap", () => {
    const c = checkin({ kind: "problem", createdAt: "2026-09-01T00:00:00.000Z" });
    expect(computeBoxHealth([c], NOW).status).toBe("problem");
  });

  test("latest visible check-in is 'filled' but older than 30 days -> quiet", () => {
    const c = checkin({ kind: "filled", createdAt: "2026-08-01T00:00:00.000Z" }); // >30 days before NOW
    const result = computeBoxHealth([c], NOW);
    expect(result.status).toBe("quiet");
    expect(result.daysSinceLastReport).toBeGreaterThan(30);
  });

  test("hidden check-ins are ignored even when newest", () => {
    const hidden = checkin({ kind: "empty", visibility: "hidden", createdAt: "2026-09-21T00:00:00.000Z" });
    const visible = checkin({ kind: "filled", visibility: "visible", createdAt: "2026-09-20T00:00:00.000Z" });
    const result = computeBoxHealth([hidden, visible], NOW);
    expect(result.status).toBe("ok");
    expect(result.latest).toEqual(visible);
  });

  test("picks the most recent VISIBLE check-in among several", () => {
    const older = checkin({ kind: "filled", createdAt: "2026-09-01T00:00:00.000Z" });
    const newer = checkin({ kind: "low", createdAt: "2026-09-20T00:00:00.000Z" });
    const result = computeBoxHealth([older, newer], NOW);
    expect(result.status).toBe("low");
    expect(result.latest).toEqual(newer);
  });
});

function entry(overrides: Partial<BoxHealthEntry>): BoxHealthEntry {
  return {
    venueId: "v1",
    name: "Test Box",
    address: "123 Test St",
    lat: 38.25,
    lng: -104.6,
    health: { status: "quiet", latest: null, daysSinceLastReport: null },
    caretaker: null,
    ...overrides,
  };
}

describe("rankNeedsHelp", () => {
  test("filters to low/empty/problem only, newest report first", () => {
    const empty = entry({
      venueId: "empty",
      health: { status: "empty", latest: checkin({ kind: "empty", createdAt: "2026-09-21T00:00:00.000Z" }), daysSinceLastReport: 0 },
    });
    const low = entry({
      venueId: "low",
      health: { status: "low", latest: checkin({ kind: "low", createdAt: "2026-09-19T00:00:00.000Z" }), daysSinceLastReport: 2 },
    });
    const ok = entry({ venueId: "ok", health: { status: "ok", latest: checkin({}), daysSinceLastReport: 1 } });

    const result = rankNeedsHelp([low, ok, empty]);
    expect(result.map((e) => e.venueId)).toEqual(["empty", "low"]);
  });

  test("respects an optional limit", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      entry({
        venueId: `v${i}`,
        health: { status: "empty", latest: checkin({ kind: "empty", createdAt: `2026-09-${10 + i}T00:00:00.000Z` }), daysSinceLastReport: i },
      }),
    );
    expect(rankNeedsHelp(entries, 2)).toHaveLength(2);
  });
});

describe("rankQuiet", () => {
  test("filters to quiet only, longest-quiet first, never-reported sorts first", () => {
    const neverReported = entry({ venueId: "never", health: { status: "quiet", latest: null, daysSinceLastReport: null } });
    const quiet41 = entry({ venueId: "q41", health: { status: "quiet", latest: checkin({}), daysSinceLastReport: 41 } });
    const quiet33 = entry({ venueId: "q33", health: { status: "quiet", latest: checkin({}), daysSinceLastReport: 33 } });
    const ok = entry({ venueId: "ok", health: { status: "ok", latest: checkin({}), daysSinceLastReport: 1 } });

    const result = rankQuiet([quiet33, ok, quiet41, neverReported]);
    expect(result.map((e) => e.venueId)).toEqual(["never", "q41", "q33"]);
  });

  test("respects an optional limit", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      entry({ venueId: `v${i}`, health: { status: "quiet", latest: checkin({}), daysSinceLastReport: i } }),
    );
    expect(rankQuiet(entries, 3)).toHaveLength(3);
  });
});
