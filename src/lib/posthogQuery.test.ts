/**
 * posthogQuery.test.ts — pure `build*` mappers (fixture rows shaped exactly
 * like the real HogQL result rows verified live against project 630731 —
 * see posthogQuery.ts's own header) plus loadMapUsageAnalytics' failure
 * fallback (issue #681's "Done when": missing key/project id or a PostHog
 * outage -> null, never throws). The live query SHAPES themselves were
 * proven with real `curl` calls against the Query API (both real sparse
 * traffic and synthetic `$host: "coder-test"` events) during this issue's
 * build, not guessed from the issue text alone.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildHeadline,
  buildTopPlaces,
  buildTopSearches,
  buildCardActions,
  buildFilters,
  buildLocationPermission,
  buildUtmSources,
  loadMapUsageAnalytics,
  _clearMapUsageAnalyticsCacheForTests,
} from "@/lib/posthogQuery";
import { EVENTS } from "@/lib/analytics";

describe("buildHeadline", () => {
  test("maps each headline event's current/previous count; the locale_switched 'to: es' split is a separate argument, not one of the event rows", () => {
    const rows = [
      [EVENTS.NEAR_ME_CLICKED, 10, 4],
      [EVENTS.SEARCH_USED, 25, 20],
      [EVENTS.VENUE_OPENED, 40, 30],
    ];
    const headline = buildHeadline(rows, 3, 1);
    expect(headline).toEqual({
      nearMeTaps: 10,
      previousNearMeTaps: 4,
      searches: 25,
      previousSearches: 20,
      cardsOpened: 40,
      previousCardsOpened: 30,
      localeSwitchedToEs: 3,
      previousLocaleSwitchedToEs: 1,
    });
  });

  test("an event with zero rows this period -> zeros, never undefined", () => {
    const headline = buildHeadline([], 0, 0);
    expect(headline.nearMeTaps).toBe(0);
    expect(headline.previousCardsOpened).toBe(0);
  });
});

describe("buildTopPlaces", () => {
  test("maps venueId/count rows, drops a null/blank venueId", () => {
    expect(buildTopPlaces([["v1", 8], [null, 2]])).toEqual([{ venueId: "v1", count: 8 }]);
  });

  test("empty rows -> empty list", () => {
    expect(buildTopPlaces([])).toEqual([]);
  });
});

describe("buildTopSearches", () => {
  test("flags a term as 'zeroResults' only when EVERY search for it returned 0 results", () => {
    const rows = [
      ["tamales", 5, 5], // every search found nothing -> tag it
      ["free food", 4, 1], // one dud among several hits -> not tagged
    ];
    expect(buildTopSearches(rows)).toEqual([
      { term: "tamales", count: 5, zeroResults: true },
      { term: "free food", count: 4, zeroResults: false },
    ]);
  });

  test("a zero-count row never reads as zeroResults (would be a divide-by-zero-shaped false positive)", () => {
    expect(buildTopSearches([["ghost", 0, 0]])[0].zeroResults).toBe(false);
  });

  test("drops a blank term", () => {
    expect(buildTopSearches([[null, 3, 0]])).toEqual([]);
  });
});

describe("buildCardActions", () => {
  test("splits directions_clicked by mode, sums the rest by event", () => {
    const rows = [
      [EVENTS.DIRECTIONS_CLICKED, "walk", 5],
      [EVENTS.DIRECTIONS_CLICKED, "bus", 2],
      [EVENTS.DIRECTIONS_CLICKED, "drive", 1],
      [EVENTS.CALL_CLICKED, null, 3],
      [EVENTS.WEBSITE_CLICKED, null, 4],
      [EVENTS.FAVORITE_ADDED, null, 6],
      [EVENTS.SHARE_CLICKED, null, 2],
      [EVENTS.REPORT_OPENED, null, 1],
    ];
    expect(buildCardActions(rows)).toEqual({
      directionsWalk: 5,
      directionsBus: 2,
      directionsDrive: 1,
      call: 3,
      website: 4,
      save: 6,
      share: 2,
      report: 1,
    });
  });

  test("empty rows -> every count zero", () => {
    expect(buildCardActions([])).toEqual({ directionsWalk: 0, directionsBus: 0, directionsDrive: 0, call: 0, website: 0, save: 0, share: 0, report: 0 });
  });
});

describe("buildFilters", () => {
  test("maps filter/count rows sorted by count desc", () => {
    expect(buildFilters([["wic", 2], ["snap", 9]])).toEqual([
      { filter: "snap", count: 9 },
      { filter: "wic", count: 2 },
    ]);
  });
});

describe("buildLocationPermission", () => {
  test("sums granted and denied, ignores an unrecognized result value", () => {
    expect(buildLocationPermission([["granted", 7], ["denied", 2], ["prompt", 100]])).toEqual({ granted: 7, denied: 2 });
  });

  test("empty rows -> both zero", () => {
    expect(buildLocationPermission([])).toEqual({ granted: 0, denied: 0 });
  });
});

describe("buildUtmSources", () => {
  test("maps source/campaign/sessions rows, a null campaign stays null", () => {
    expect(buildUtmSources([["flyer", "downtown", 12], ["newsletter", null, 3]])).toEqual([
      { source: "flyer", campaign: "downtown", sessions: 12 },
      { source: "newsletter", campaign: null, sessions: 3 },
    ]);
  });
});

describe("loadMapUsageAnalytics — failure fallback", () => {
  const originalToken = process.env.POSTHOG_PERSONAL_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    _clearMapUsageAnalyticsCacheForTests();
    if (originalToken === undefined) delete process.env.POSTHOG_PERSONAL_API_KEY;
    else process.env.POSTHOG_PERSONAL_API_KEY = originalToken;
  });

  test("no key -> null, no fetch attempted", async () => {
    delete process.env.POSTHOG_PERSONAL_API_KEY;
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const result = await loadMapUsageAnalytics("30d", "630731", undefined);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("key present but no project id -> null, no fetch attempted", async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = "test-key";
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const result = await loadMapUsageAnalytics("30d", undefined, undefined);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("key and project id present, PostHog call fails -> null, never throws", async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    const result = await loadMapUsageAnalytics("30d", "630731", undefined);

    expect(result).toBeNull();
  });

  test("success -> shapes every block from the fetch responses, caches per period", async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = "test-key";
    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const result = await loadMapUsageAnalytics("7d", "630731", "https://us.posthog.com");

    expect(result).not.toBeNull();
    expect(result?.headline).toEqual({
      nearMeTaps: 0,
      previousNearMeTaps: 0,
      searches: 0,
      previousSearches: 0,
      cardsOpened: 0,
      previousCardsOpened: 0,
      localeSwitchedToEs: 0,
      previousLocaleSwitchedToEs: 0,
    });
    expect(result?.topPlaces).toEqual([]);
    // 8 queries: headline, locale-es, top places, top searches, card actions, filters, location, utm.
    expect(mockFetch).toHaveBeenCalledTimes(8);

    mockFetch.mockClear();
    await loadMapUsageAnalytics("7d", "630731", "https://us.posthog.com");
    expect(mockFetch).not.toHaveBeenCalled(); // served from the 1h cache
  });
});
