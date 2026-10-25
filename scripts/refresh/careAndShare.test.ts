// Care and Share reader (Venue Data Rebuild step 2) — the risky behaviour
// only: a refused or partial read writes nothing, contact details never
// survive the parse, schedules are never guessed, matching thresholds, and
// blessing boxes are never touched.
import { describe, expect, test, vi } from "vitest";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rejectionKey, type CurrentVenueRow } from "./diffEngine";
import {
  buildCareAndShareProposals,
  dropAlreadyReviewed,
  convertSchedules,
  fetchCareAndShare,
  REQUEST_GAP_MS,
  toCasLocation,
  type CasLocation,
  type CasSchedule,
} from "./careAndShare";

const TODAY = "2026-10-26";
const FETCHED = "2026-10-26T12:00:00.000Z";

function rawLocation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    locationId: 1,
    locationName: "Praise Assembly of God",
    address1: "2000 Troy Avenue",
    address2: "",
    city: "Pueblo",
    state: "CO",
    zipCode: "81001    ",
    phone: "719-555-0100",
    website: "",
    latitude: 38.2701,
    longitude: -104.5807,
    contactName: "Jane Volunteer",
    contactEmail: "jane@example.org",
    contactPhone: "719-555-9999",
    ...overrides,
  };
}

function loc(overrides: Record<string, unknown> = {}): CasLocation {
  return toCasLocation(rawLocation(overrides))!;
}

function sched(overrides: Partial<CasSchedule> = {}): CasSchedule {
  return {
    locationId: 1,
    dayOfWeek: 2,
    startTime: "1900-01-01T10:00:00",
    endTime: "1900-01-01T12:00:00",
    weekDayDescr: "Monday",
    startTimeDescr: "10:00 AM",
    endTimeDescr: "12:00 PM",
    notes: "",
    weeksOfMonth: "",
    daysOfMonth: "",
    contactForHoursMessage: null,
    everyOtherWeekInd: false,
    ...overrides,
  };
}

function venue(overrides: Partial<CurrentVenueRow> = {}): CurrentVenueRow {
  return {
    id: "plentiful-praise",
    name: "Praise Assembly of God",
    category: "pantry",
    lat: 38.2701,
    lng: -104.5807,
    address: "2000 Troy Ave, Pueblo, CO 81001",
    hours_weekly: JSON.stringify({ mon: ["10:00 AM - 12:00 PM"] }),
    hours_irregular: null,
    phone: "(719) 555-0100",
    url: null,
    operator: null,
    last_verified: "2026-10-01",
    ...overrides,
  };
}

function build(params: {
  locations: CasLocation[];
  schedules?: CasSchedule[];
  venues: CurrentVenueRow[];
  aliases?: { source: string; upstream_id: string; venue_id: string }[];
}) {
  return buildCareAndShareProposals({
    locations: params.locations,
    schedules: params.schedules ?? [],
    venues: params.venues,
    aliases: params.aliases ?? [],
    runId: "run-1",
    today: TODAY,
    fetchedAt: FETCHED,
  });
}

// ─── Fetching ───────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function page(locations: Record<string, unknown>[]) {
  return { item1: locations, item2: -1, item3: 0, item4: -1, item5: 15, item6: false };
}

describe("fetchCareAndShare — refusal stops the source with nothing to write", () => {
  test("a refused second page returns a failure and makes no further request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page([rawLocation()])))
      .mockRejectedValueOnce(new TypeError("fetch failed: connect ECONNREFUSED"));
    const result = await fetchCareAndShare({ fetch: fetchMock, sleep: async () => {}, log: () => {} });
    expect(result.ok).toBe(false);
    expect("locations" in result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("a non-2xx response is a failure, never an empty listing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 429 }));
    const result = await fetchCareAndShare({ fetch: fetchMock, sleep: async () => {}, log: () => {} });
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a failed schedule read fails the whole source (hours are never half-read)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page([rawLocation()])))
      .mockResolvedValueOnce(jsonResponse(page([])))
      .mockResolvedValueOnce(new Response("nope", { status: 503 }));
    const result = await fetchCareAndShare({ fetch: fetchMock, sleep: async () => {}, log: () => {} });
    expect(result.ok).toBe(false);
  });

  test("an empty first page is a failure (zero records never means everything closed)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(page([])));
    const result = await fetchCareAndShare({ fetch: fetchMock, sleep: async () => {}, log: () => {} });
    expect(result.ok).toBe(false);
  });

  test("waits at least REQUEST_GAP_MS before every request after the first, and REQUEST_GAP_MS is >= 3 s", async () => {
    const sleep = vi.fn(async () => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page([rawLocation()])))
      .mockResolvedValueOnce(jsonResponse(page([])))
      .mockResolvedValueOnce(jsonResponse([sched()]));
    const result = await fetchCareAndShare({ fetch: fetchMock, sleep, log: () => {} });
    expect(result.ok).toBe(true);
    expect(REQUEST_GAP_MS).toBeGreaterThanOrEqual(3000);
    expect(sleep).toHaveBeenCalledTimes(fetchMock.mock.calls.length - 1);
    for (const call of sleep.mock.calls as unknown as number[][]) expect(call[0]).toBeGreaterThanOrEqual(REQUEST_GAP_MS);
  });

  test("keeps Pueblo County only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(page([rawLocation(), rawLocation({ locationId: 2, latitude: 38.44, longitude: -105.23, city: "Florence" })])),
      )
      .mockResolvedValueOnce(jsonResponse(page([])))
      .mockResolvedValueOnce(jsonResponse([]));
    const result = await fetchCareAndShare({ fetch: fetchMock, sleep: async () => {}, log: () => {} });
    expect(result.ok && result.locations.map((l) => l.locationId)).toEqual([1]);
  });
});

describe("contact fields are never stored", () => {
  test("toCasLocation drops contactName / contactEmail / contactPhone", () => {
    const parsed = JSON.stringify(toCasLocation(rawLocation()));
    expect(parsed).not.toMatch(/Jane Volunteer|jane@example\.org|555-9999|contact/i);
  });

  test("the per-run raw cache never contains them either", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "cas-test-"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page([rawLocation()])))
      .mockResolvedValueOnce(jsonResponse(page([])))
      .mockResolvedValueOnce(jsonResponse([{ ...sched(), contactName: "Jane Volunteer" }]));
    await fetchCareAndShare({ fetch: fetchMock, sleep: async () => {}, log: () => {}, cacheDir });
    const files = readdirSync(cacheDir);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(join(cacheDir, f), "utf-8")).not.toMatch(/Jane Volunteer|jane@example\.org|555-9999/);
  });

  test("no proposal carries them", () => {
    const { proposals } = build({ locations: [loc()], schedules: [sched()], venues: [] });
    expect(JSON.stringify(proposals)).not.toMatch(/Jane Volunteer|jane@example\.org|555-9999/);
  });
});

// ─── Schedule conversion ───────────────────────────────────────────────────

describe("convertSchedules — never guesses", () => {
  test("plain weekly rows convert exactly", () => {
    const r = convertSchedules([sched(), sched({ dayOfWeek: 4, startTime: "1900-01-01T13:30:00", endTime: "1900-01-01T15:00:00" })]);
    expect(r).toEqual({ ok: true, hours_weekly: { mon: ["10:00-12:00"], wed: ["13:30-15:00"] }, hours_irregular: [] });
  });

  test("an ordinal in daysOfMonth becomes a monthly_ordinal entry (dayOfWeek 1 = Sunday)", () => {
    const r = convertSchedules([sched({ dayOfWeek: 7, daysOfMonth: " 3rd", startTime: "2026-06-08T09:00:00", endTime: "2026-06-08T11:00:00" })]);
    expect(r).toEqual({
      ok: true,
      hours_weekly: {},
      hours_irregular: [{ recurrence: "monthly_ordinal", ordinal: 3, weekday: "sat", slots: ["09:00-11:00"] }],
    });
    expect(convertSchedules([sched({ dayOfWeek: 1 })])).toMatchObject({ hours_weekly: { sun: ["10:00-12:00"] } });
  });

  test.each([
    ["a free-text note", { notes: "And 4 to 6" }],
    ["every other week", { everyOtherWeekInd: true }],
    ["weeksOfMonth", { weeksOfMonth: "1,3" }],
    ["a day-of-month it can't read", { daysOfMonth: "15th and 30th" }],
    ["call for hours", { contactForHoursMessage: "Call for hours" }],
  ])("%s -> not convertible", (_label, overrides) => {
    expect(convertSchedules([sched(), sched(overrides as Partial<CasSchedule>)]).ok).toBe(false);
  });
});

// ─── Matching ───────────────────────────────────────────────────────────────

describe("matching — strong vs ambiguous", () => {
  test("name + distance + same phone is a strong match: alias recorded, no review needed", () => {
    const r = build({ locations: [loc()], schedules: [sched()], venues: [venue()] });
    expect(r.stats.strong).toBe(1);
    expect(r.aliasWrites).toEqual([{ upstreamId: "cas-1", venueId: "plentiful-praise" }]);
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]); // identical -> "still listed"
    expect(r.proposals[0].proposedDiff.meta?.match).toBeUndefined();
  });

  test("name + distance but no phone on the Care and Share side is only ambiguous", () => {
    const r = build({ locations: [loc({ phone: "" })], schedules: [sched()], venues: [venue()] });
    expect(r.stats.strong).toBe(0);
    expect(r.stats.ambiguous).toBe(1);
    expect(r.aliasWrites).toEqual([]);
    expect(r.proposals[0].targetVenueId).toBe("plentiful-praise");
    expect(r.proposals[0].proposedDiff.meta?.match).toMatchObject({ upstream_id: "cas-1" });
  });

  test("same phone and name but 1 km away is only ambiguous", () => {
    const r = build({ locations: [loc({ latitude: 38.2791 })], schedules: [sched()], venues: [venue()] });
    expect(r.stats.strong).toBe(0);
    expect(r.stats.ambiguous).toBe(1);
  });

  test("a different name at the same spot with the same phone is only ambiguous", () => {
    const r = build({ locations: [loc({ locationName: "Troy Avenue Outreach" })], schedules: [sched()], venues: [venue()] });
    expect(r.stats.strong).toBe(0);
    expect(r.stats.ambiguous).toBe(1);
  });

  test("an alias already on file matches without any fuzzy check", () => {
    const r = build({
      locations: [loc({ locationName: "Something else entirely", phone: "", latitude: 38.3 })],
      venues: [venue()],
      aliases: [{ source: "care_and_share", upstream_id: "cas-1", venue_id: "plentiful-praise" }],
    });
    expect(r.stats.strong).toBe(1);
    expect(r.aliasWrites).toEqual([]);
  });

  test("two listings on one of our venues -> one review proposal, no field changes, no alias", () => {
    const r = build({
      locations: [loc(), loc({ locationId: 2, locationName: "Praise assembly of god" })],
      schedules: [sched(), sched({ locationId: 2, dayOfWeek: 3 })],
      venues: [venue()],
    });
    expect(r.aliasWrites).toEqual([]);
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
    // Approving it records every listing as this venue (adminProposals' alias write).
    expect(r.proposals[0].proposedDiff.meta?.match).toMatchObject({ upstream_ids: ["cas-1", "cas-2"] });
  });

  test("once both listings are on file they read as one: diffed against the lower id, no review card", () => {
    const r = build({
      locations: [loc(), loc({ locationId: 2 })],
      schedules: [sched(), sched({ locationId: 2, dayOfWeek: 3 })],
      venues: [venue()],
      aliases: [
        { source: "care_and_share", upstream_id: "cas-1", venue_id: "plentiful-praise" },
        { source: "care_and_share", upstream_id: "cas-2", venue_id: "plentiful-praise" },
      ],
    });
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
    expect(r.proposals[0].proposedDiff.meta?.match).toBeUndefined();
    expect(r.proposals[0].proposedDiff.meta?.also_listed_as).toEqual([2]);
  });

  test("no candidate at all -> an 'add' proposal for Kyle", () => {
    const r = build({ locations: [loc({ locationName: "New Hope Pantry", phone: "", latitude: 38.31 })], venues: [venue()] });
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].changeType).toBe("add");
    expect(r.proposals[0].targetVenueId).toBe("cas-1");
  });

  test("our venues missing from Care and Share get nothing (no remove)", () => {
    const r = build({ locations: [loc()], venues: [venue(), venue({ id: "other", name: "Elsewhere", lat: 38.2, phone: null })] });
    expect(r.proposals.some((p) => p.targetVenueId === "other")).toBe(false);
    expect(r.proposals.some((p) => p.changeType === "remove")).toBe(false);
  });

  test("blessing boxes and non-food-bank categories are never matched or changed", () => {
    const box = venue({ id: "box-1", category: "blessing_box" });
    const store = venue({ id: "store-1", category: "grocery" });
    const r = build({ locations: [loc()], schedules: [sched({ dayOfWeek: 5 })], venues: [box, store] });
    expect(r.proposals.some((p) => p.targetVenueId === "box-1" || p.targetVenueId === "store-1")).toBe(false);
    expect(r.aliasWrites).toEqual([]);
    // an add whose id collides with a box is dropped too
    const r2 = build({ locations: [loc()], venues: [venue({ id: "cas-1", category: "blessing_box" })] });
    expect(r2.proposals).toEqual([]);
  });
});

// ─── Diffs ──────────────────────────────────────────────────────────────────

describe("diffs for matched venues", () => {
  test("a real hours change is an update with the raw schedule text in meta", () => {
    const r = build({ locations: [loc()], schedules: [sched({ dayOfWeek: 3, weekDayDescr: "Tuesday" })], venues: [venue()] });
    const p = r.proposals[0];
    expect(p.proposedDiff.fields_changed).toEqual(["hours_weekly", "last_verified"]);
    expect(p.proposedDiff.after?.hours_weekly).toBe(JSON.stringify({ tue: ["10:00-12:00"] }));
    expect(p.proposedDiff.meta).toMatchObject({ locationId: 1, fetched_at: FETCHED });
    expect(String(p.proposedDiff.meta?.schedule_text)).toContain("Tuesday");
  });

  test("12h vs 24h slot spelling and address abbreviations are not changes", () => {
    const r = build({
      locations: [loc({ address1: "2000 Troy Avenue" })],
      schedules: [sched()],
      venues: [venue({ hours_weekly: JSON.stringify({ mon: ["10:00-12:00"] }), address: "2000 Troy Ave., Pueblo, CO 81001" })],
    });
    expect(r.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("an unconvertible schedule proposes NO hours change and goes to review with the raw text", () => {
    const r = build({ locations: [loc()], schedules: [sched({ dayOfWeek: 3, notes: "And 4 to 6" })], venues: [venue()] });
    const p = r.proposals[0];
    expect(p.proposedDiff.fields_changed).not.toContain("hours_weekly");
    expect(p.proposedDiff.meta?.needs_review).toBeDefined();
    expect(String(p.proposedDiff.meta?.schedule_text)).toContain("And 4 to 6");
  });

  test("a listing with no schedule at all proposes no hours change (missing is not closed)", () => {
    const r = build({ locations: [loc()], schedules: [], venues: [venue()] });
    expect(r.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("an empty Care and Share phone or website never clears ours", () => {
    const r = build({ locations: [loc({ website: "None" })], schedules: [sched()], venues: [venue({ url: "https://praise.example" })] });
    expect(r.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });
});

describe("review cards Kyle already approved don't come back every week", () => {
  test("an approved schedule-review card with the same content is dropped; a changed schedule comes back", () => {
    const first = build({ locations: [loc()], schedules: [sched({ notes: "And 4 to 6" })], venues: [venue()] }).proposals;
    const approved = new Set(first.map((p) => rejectionKey(p.source, p.targetVenueId, p.diffHash)));
    expect(dropAlreadyReviewed(first, approved)).toEqual([]);
    const changed = build({ locations: [loc()], schedules: [sched({ notes: "And 5 to 7" })], venues: [venue()] }).proposals;
    expect(dropAlreadyReviewed(changed, approved)).toHaveLength(1);
  });

  test("real field changes are never dropped by an earlier approval", () => {
    const p = build({ locations: [loc()], schedules: [sched({ dayOfWeek: 3 })], venues: [venue()] }).proposals;
    const approved = new Set(p.map((x) => rejectionKey(x.source, x.targetVenueId, x.diffHash)));
    expect(dropAlreadyReviewed(p, approved)).toHaveLength(1);
  });
});
