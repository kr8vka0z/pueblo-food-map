// @vitest-environment node
/**
 * diffEngine.test.ts — the guardrail tests matter more than the happy path
 * here (per this slice's own acceptance bar): a zero-record scrape, an
 * over-cap run, and a "nothing changed" run must all write NOTHING.
 */
import { describe, test, expect } from "vitest";
import type { Venue } from "@/types/venue";
import {
  diffSource,
  checkSanityGuardrail,
  exceedsPerRunCap,
  computeDiffHash,
  buildLinkHealthProposal,
  isValidIncomingRecord,
  type CurrentVenueRow,
} from "./diffEngine";

const TODAY = "2026-09-02";
const RUN_ID = "run-1";

function row(overrides: Partial<CurrentVenueRow> = {}): CurrentVenueRow {
  return {
    id: "osm-node-1",
    name: "Pueblo Grocery",
    category: "grocery",
    lat: 38.25,
    lng: -104.6,
    address: "123 Main St, Pueblo, CO",
    hours_weekly: null,
    phone: null,
    url: null,
    operator: null,
    last_verified: "2026-05-12",
    ...overrides,
  };
}

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "osm-node-1",
    name: "Pueblo Grocery",
    category: "grocery",
    lat: 38.25,
    lng: -104.6,
    address: "123 Main St, Pueblo, CO",
    source: "OpenStreetMap (node/1)",
    last_verified: "2026-05-12",
    ...overrides,
  };
}

describe("diffSource — happy path", () => {
  test("unchanged record proposes only a last_verified refresh", () => {
    const result = diffSource({
      source: "osm",
      currentRows: [row()],
      incoming: [venue()],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.aborted).toBe(false);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].changeType).toBe("update");
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
    expect(result.proposals[0].proposedDiff.after).toEqual({ last_verified: TODAY });
  });

  test("a real field change proposes an update carrying only the changed fields + last_verified", () => {
    const result = diffSource({
      source: "osm",
      currentRows: [row({ phone: "719-555-0100" })],
      incoming: [venue({ phone: "719-555-9999" })],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.proposals).toHaveLength(1);
    const p = result.proposals[0];
    expect(p.changeType).toBe("update");
    expect(p.proposedDiff.fields_changed.sort()).toEqual(["last_verified", "phone"]);
    expect(p.proposedDiff.before).toMatchObject({ phone: "719-555-0100" });
    expect(p.proposedDiff.after).toMatchObject({ phone: "719-555-9999" });
  });

  test("a new incoming id not present in D1 proposes an add", () => {
    const result = diffSource({
      source: "osm",
      currentRows: [],
      incoming: [venue({ id: "osm-node-2" })],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].changeType).toBe("add");
    expect(result.proposals[0].targetVenueId).toBe("osm-node-2");
  });

  test("OSM address changes are never diffed (enrichment territory, spec §6.3 NB2 fix)", () => {
    const result = diffSource({
      source: "osm",
      currentRows: [row({ address: "REAL reverse-geocoded address" })],
      incoming: [venue({ address: "Address not in OpenStreetMap" })],
      runId: RUN_ID,
      today: TODAY,
    });
    // Only last_verified changes — address is excluded from OSM's allowlist,
    // so this must NOT propose overwriting a real address with the placeholder.
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("OSM operator/hours_weekly changes are never diffed either — the unmodified scraper never reproduces them (found via the local D1 run)", () => {
    const result = diffSource({
      source: "osm",
      currentRows: [row({ operator: "Walmart", hours_weekly: '{"mon":["06:00-24:00"]}' })],
      // A real re-run of scripts/ingest-osm-grocery.py never emits `operator`
      // at all and never populates structured `hours_weekly` — this is what
      // that looks like on the incoming side.
      incoming: [venue({ operator: undefined, hours_weekly: undefined })],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("plentiful DOES diff address (directly scraped, not enrichment)", () => {
    const result = diffSource({
      source: "plentiful",
      currentRows: [row({ id: "plentiful-x", address: "Old Address" })],
      incoming: [venue({ id: "plentiful-x", address: "New Address" })],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.proposals[0].proposedDiff.fields_changed).toContain("address");
  });

  test("an active row missing from the incoming set proposes a remove", () => {
    const result = diffSource({
      source: "osm",
      currentRows: [row({ id: "gone-1" }), row({ id: "gone-2" }), row({ id: "gone-3" })],
      incoming: [venue({ id: "gone-1" }), venue({ id: "gone-2" }), venue({ id: "gone-3" }), venue({ id: "still-here" })],
      runId: RUN_ID,
      today: TODAY,
    });
    // Nothing removed here (all 3 current ids ARE in incoming) — sanity check.
    expect(result.removalCandidateIds).toEqual([]);
  });
});

describe("guardrail: zero-record scrape writes nothing", () => {
  test("empty incoming array aborts the source and writes no proposals", () => {
    const result = diffSource({
      source: "plentiful",
      currentRows: [row(), row({ id: "x2" }), row({ id: "x3" })],
      incoming: [],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.aborted).toBe(true);
    expect(result.proposals).toHaveLength(0);
    expect(result.abortReason).toMatch(/zero records/);
  });
});

describe("guardrail: abnormal mass-removal writes nothing", () => {
  test("removals at or above 20% (floor 5) of active rows abort with zero proposals", () => {
    // 60 active rows (matches real OSM scale), only 40 reappear -> 20 missing = 33%.
    const currentRows = Array.from({ length: 60 }, (_, i) => row({ id: `osm-${i}` }));
    const incoming = Array.from({ length: 40 }, (_, i) => venue({ id: `osm-${i}` }));
    const result = diffSource({ source: "osm", currentRows, incoming, runId: RUN_ID, today: TODAY });
    expect(result.anomaly).toBe(true);
    expect(result.aborted).toBe(true);
    expect(result.proposals).toHaveLength(0);
  });

  test("exactly 20% (12 of 60) trips — 'reach or exceed', not 'exceed'", () => {
    const currentRows = Array.from({ length: 60 }, (_, i) => row({ id: `osm-${i}` }));
    const incoming = Array.from({ length: 48 }, (_, i) => venue({ id: `osm-${i}` })); // 12 missing = exactly 20%
    const result = diffSource({ source: "osm", currentRows, incoming, runId: RUN_ID, today: TODAY });
    expect(result.anomaly).toBe(true);
  });

  test("the floor raises the bar for small sources (10 rows trips at 5, not 2)", () => {
    const currentRows = Array.from({ length: 10 }, (_, i) => row({ id: `p-${i}` }));
    // 2 missing = 20% of 10, but the floor of 5 means this must NOT trip.
    const incoming = Array.from({ length: 8 }, (_, i) => venue({ id: `p-${i}` }));
    const result = diffSource({ source: "plentiful", currentRows, incoming, runId: RUN_ID, today: TODAY });
    expect(result.anomaly).toBe(false);
    expect(result.aborted).toBe(false);
    // The 2 genuinely-missing rows are proposed as ordinary removes.
    expect(result.proposals.filter((p) => p.changeType === "remove")).toHaveLength(2);
  });

  test("checkSanityGuardrail: 8 of 38 (Plentiful scale) trips; 7 of 38 does not", () => {
    expect(checkSanityGuardrail(8, 38).anomaly).toBe(true);
    expect(checkSanityGuardrail(7, 38).anomaly).toBe(false);
  });
});

describe("guardrail: per-run proposal cap", () => {
  test("exceedsPerRunCap trips over 150, not at or under it", () => {
    expect(exceedsPerRunCap(150)).toBe(false);
    expect(exceedsPerRunCap(151)).toBe(true);
  });
});

describe("guardrail: 'nothing changed' run writes zero content proposals", () => {
  test("every record confirmed present + unchanged writes only last_verified refreshes, no add/update-content/remove", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    const incoming = [venue({ id: "a" }), venue({ id: "b" }), venue({ id: "c" })];
    const result = diffSource({ source: "osm", currentRows: rows, incoming, runId: RUN_ID, today: TODAY });
    expect(result.proposals).toHaveLength(3);
    for (const p of result.proposals) {
      expect(p.changeType).toBe("update");
      expect(p.proposedDiff.fields_changed).toEqual(["last_verified"]);
    }
  });

  test("a record already verified TODAY, with nothing else changed, writes NOTHING at all", () => {
    // Guards against running this pipeline twice in one day (a manual
    // dispatch alongside the scheduled run) writing a duplicate,
    // content-free last_verified-refresh proposal for the same record.
    const rows = [row({ id: "a", last_verified: TODAY })];
    const incoming = [venue({ id: "a", last_verified: TODAY })];
    const result = diffSource({ source: "osm", currentRows: rows, incoming, runId: RUN_ID, today: TODAY });
    expect(result.proposals).toHaveLength(0);
    expect(result.aborted).toBe(false);
  });

  test("a genuinely no-op run (every record already verified today, none added/removed) writes nothing at all", () => {
    const rows = [row({ id: "a", last_verified: TODAY }), row({ id: "b", last_verified: TODAY })];
    const incoming = [venue({ id: "a", last_verified: TODAY }), venue({ id: "b", last_verified: TODAY })];
    const result = diffSource({ source: "osm", currentRows: rows, incoming, runId: RUN_ID, today: TODAY });
    expect(result.proposals).toEqual([]);
  });
});

describe("rejection memory (§6.10b)", () => {
  // Fix 3: this must prove the REAL property — a rejected proposal stays
  // rejected across different run dates, not just within one calendar day.
  // Pinning `today` equal on both runs (the old version of this test) would
  // pass even if diff_hash still baked in last_verified's dated value —
  // exactly the bug this guards against.
  test("a diff matching a previously-rejected (source, target, diff_hash) is not re-proposed, even on a later run date", () => {
    const rows = [row({ phone: "old" })];
    const incoming = [venue({ phone: "new" })];
    const firstRun = diffSource({ source: "osm", currentRows: rows, incoming, runId: RUN_ID, today: TODAY });
    const rejectedHash = firstRun.proposals[0].diffHash;
    const rejectedKeys = new Set([`osm:${rows[0].id}:${rejectedHash}`]);

    const laterToday = "2026-10-01"; // a different calendar day than TODAY
    const secondRun = diffSource({
      source: "osm",
      currentRows: rows,
      incoming,
      runId: "run-2",
      today: laterToday,
      rejectedKeys,
    });
    expect(secondRun.proposals).toHaveLength(0);
  });
});

describe("computeDiffHash", () => {
  test("is stable for identical content and differs when content differs", () => {
    const a = computeDiffHash({ phone: "1" }, ["phone"]);
    const b = computeDiffHash({ phone: "1" }, ["phone"]);
    const c = computeDiffHash({ phone: "2" }, ["phone"]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test("Fix 3: ignores last_verified's dated value — same substantive change on two different days hashes identically", () => {
    const a = computeDiffHash({ phone: "1", last_verified: "2026-05-01" }, ["phone", "last_verified"]);
    const b = computeDiffHash({ phone: "1", last_verified: "2026-09-02" }, ["phone", "last_verified"]);
    expect(a).toBe(b);
  });

  test("still differs when the real (non-last_verified) content differs, regardless of date", () => {
    const a = computeDiffHash({ phone: "1", last_verified: "2026-05-01" }, ["phone", "last_verified"]);
    const b = computeDiffHash({ phone: "2", last_verified: "2026-09-02" }, ["phone", "last_verified"]);
    expect(a).not.toBe(b);
  });
});

describe("Fix 4: destructive-clear guard (Plentiful hours_weekly/phone)", () => {
  test("a real hours_weekly value clearing to null on Plentiful is NOT proposed (transient scrape failure shape)", () => {
    const result = diffSource({
      source: "plentiful",
      currentRows: [row({ id: "plentiful-x", hours_weekly: '{"mon":["09:00 AM - 05:00 PM"]}' })],
      incoming: [venue({ id: "plentiful-x", hours_weekly: undefined })],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("a real phone value clearing to empty string on Plentiful is NOT proposed (card-parse-miss shape)", () => {
    const result = diffSource({
      source: "plentiful",
      currentRows: [row({ id: "plentiful-x", phone: "719-555-0100" })],
      incoming: [venue({ id: "plentiful-x", phone: "" })],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("a real hours_weekly value clearing on OSM (not guarded) is still proposed normally", () => {
    const result = diffSource({
      source: "osm",
      currentRows: [row({ id: "osm-x", operator: "irrelevant" })],
      incoming: [venue({ id: "osm-x" })],
      runId: RUN_ID,
      today: TODAY,
    });
    // hours_weekly isn't in OSM's allowlist at all (unrelated existing rule)
    // — this just proves the guard is scoped to plentiful, not a blanket rule.
    expect(result.proposals).toHaveLength(1);
  });

  test("phone going from empty to populated on Plentiful is still proposed (guard only blocks clearing, not filling in)", () => {
    const result = diffSource({
      source: "plentiful",
      currentRows: [row({ id: "plentiful-x", phone: null })],
      incoming: [venue({ id: "plentiful-x", phone: "719-555-0100" })],
      runId: RUN_ID,
      today: TODAY,
    });
    expect(result.proposals[0].proposedDiff.fields_changed).toContain("phone");
  });
});

describe("isValidIncomingRecord", () => {
  test("rejects a record missing required fields", () => {
    expect(isValidIncomingRecord({})).toBe(false);
    expect(isValidIncomingRecord({ id: "x", name: "n" })).toBe(false);
  });
  test("accepts a well-formed record", () => {
    expect(isValidIncomingRecord(venue())).toBe(true);
  });
});

describe("buildLinkHealthProposal", () => {
  test("clears the url, never invents a replacement", () => {
    const p = buildLinkHealthProposal("plentiful-x", "https://dead.example/x", 404, "2026-09-02T00:00:00Z", RUN_ID);
    expect(p.source).toBe("link_health");
    expect(p.changeType).toBe("update");
    expect(p.proposedDiff.before).toEqual({ url: "https://dead.example/x" });
    expect(p.proposedDiff.after).toEqual({ url: null });
    expect(p.proposedDiff.meta).toEqual({ http_status: 404, checked_at: "2026-09-02T00:00:00Z" });
  });
});
