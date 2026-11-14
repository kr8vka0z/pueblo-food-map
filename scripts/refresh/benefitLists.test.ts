// @vitest-environment node
// SNAP/WIC list check (Venue Data Rebuild step 4) — risky behaviour only: a
// failed, refused or partial download writes nothing; a store missing from a
// list never becomes "doesn't accept"; a dropped chain store is not hidden by
// a same-name sibling; a pinned tick shows the pin; rejection memory holds.
import { describe, expect, test, vi } from "vitest";
import { buildProposalWriteStatements, type PinRow } from "./proposalSql";
import { rejectionKey } from "./diffEngine";
import { dropAlreadyReviewed } from "./careAndShare";
import { sqlText } from "./sql";
import {
  buildBenefitListProposals,
  fetchSnapList,
  fetchWicList,
  SNAP_SOURCE,
  WIC_MAP_ID,
  WIC_SOURCE,
  type BenefitVenueRow,
  type ListEntry,
} from "./benefitLists";

const TODAY = "2026-11-13";
const FETCHED = "2026-11-13T07:00:00.000Z";

// ─── Fetchers ───────────────────────────────────────────────────────────────

function snapFeature(id: number, overrides: Record<string, unknown> = {}) {
  return {
    attributes: {
      Record_ID: id,
      Store_Name: "Loaf N Jug 750038",
      Store_Street_Address: "1002 Bonforte Blvd",
      City: "Pueblo",
      Zip_Code: "81001",
      Latitude: 38.287191,
      Longitude: -104.59641,
      ...overrides,
    },
  };
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const log = () => {};

describe("fetchSnapList", () => {
  test("a good read returns the Pueblo County rows from ONE request", async () => {
    const fetch = vi.fn().mockResolvedValue(okJson({ features: [snapFeature(1), snapFeature(2)] }));
    const r = await fetchSnapList({ fetch, log });
    expect(r.ok && r.entries.map((e) => e.upstreamId)).toEqual(["usda-1", "usda-2"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["the request throws", () => Promise.reject(new Error("ECONNRESET"))],
    ["a non-2xx answer", () => Promise.resolve(new Response("busy", { status: 503 }))],
    ["a body that isn't JSON", () => Promise.resolve(new Response("<html>", { status: 200 }))],
    ["an ArcGIS error inside a 200", () => Promise.resolve(okJson({ error: { code: 400, message: "Invalid query" } }))],
    ["a truncated read (exceededTransferLimit)", () => Promise.resolve(okJson({ features: [snapFeature(1)], exceededTransferLimit: true }))],
    ["zero rows", () => Promise.resolve(okJson({ features: [] }))],
    ["a row missing its coordinates", () => Promise.resolve(okJson({ features: [snapFeature(1, { Latitude: null })] }))],
  ])("%s -> ok:false (the source writes nothing)", async (_label, impl) => {
    const r = await fetchSnapList({ fetch: vi.fn().mockImplementation(impl), log });
    expect(r.ok).toBe(false);
  });
});

function placemark(name: string, street: string, city: string, zip: string): string {
  return `<Placemark><name>${name}</name><ExtendedData>
    <Data name="StreetAddrLine1"><value>${street}</value></Data>
    <Data name="City"><value>${city}</value></Data>
    <Data name="State"><value>CO</value></Data>
    <Data name="ZipCode"><value>${zip}</value></Data></ExtendedData></Placemark>`;
}

/** A statewide KML: `extra` placemarks plus enough Denver filler to clear the statewide floor. */
function kml(extra: string[]): string {
  const filler = Array.from({ length: 150 }, (_, i) => placemark(`STORE #${i}`, `${i} MAIN ST`, "DENVER", "80202"));
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>WIC Stores</name><Folder><name>WIC Vendors</name>${[...extra, ...filler].join("")}</Folder></Document></kml>`;
}

const PAGE = `<a href="https://www.google.com/maps/d/u/0/viewer?mid=${WIC_MAP_ID}&amp;hl=en">map</a>`;

function wicFetch(page: string | Response, kmlBody: string | Response) {
  return vi.fn().mockImplementation((url: string) => {
    const r = url.includes("coloradowic.gov") ? page : kmlBody;
    return Promise.resolve(typeof r === "string" ? new Response(r, { status: 200 }) : r);
  });
}

describe("fetchWicList", () => {
  test("a good read keeps only Pueblo County stores and unwraps CDATA names", async () => {
    const fetch = wicFetch(
      PAGE,
      kml([placemark("<![CDATA[MESA LAGREE'S]]>", "27050 E Highway 50", "PUEBLO", "81006"), placemark("SAFEWAY #1760", "1017 N MARKET PLAZA", "PUEBLO WEST", "81007")]),
    );
    const r = await fetchWicList({ fetch, log });
    expect(r.ok && r.entries.map((e) => e.name)).toEqual(["MESA LAGREE'S", "SAFEWAY #1760"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["the page links no map", "<p>no map</p>", kml([placemark("A", "1 B St", "PUEBLO", "81001")])],
    ["the page links a different map", PAGE.replace(WIC_MAP_ID, "someOtherMap123"), kml([placemark("A", "1 B St", "PUEBLO", "81001")])],
    ["the page links two maps", `${PAGE} ${PAGE.replace(WIC_MAP_ID, "someOtherMap123")}`, kml([placemark("A", "1 B St", "PUEBLO", "81001")])],
    ["the page is down", new Response("", { status: 500 }), kml([placemark("A", "1 B St", "PUEBLO", "81001")])],
    ["the KML is down", PAGE, new Response("", { status: 404 })],
    ["Google answers with an HTML page", PAGE, "<html><body>Sign in</body></html>"],
    ["far fewer placemarks than a statewide list", PAGE, kml([]).replace(/<Placemark>[\s\S]*<\/Placemark>/, placemark("A", "1 B St", "PUEBLO", "81001"))],
    ["a placemark with no street", PAGE, kml([placemark("A", "", "PUEBLO", "81001")])],
    ["zero Pueblo County stores", PAGE, kml([])],
  ])("%s -> ok:false (the source writes nothing)", async (_label, page, body) => {
    const r = await fetchWicList({ fetch: wicFetch(page, body), log });
    expect(r.ok).toBe(false);
  });
});

// ─── Cards ──────────────────────────────────────────────────────────────────

function venue(id: string, overrides: Partial<BenefitVenueRow> = {}): BenefitVenueRow {
  return {
    id,
    name: "Loaf 'N Jug",
    category: "convenience",
    lat: 38.287191,
    lng: -104.59641,
    address: "1002 Bonforte Boulevard, Pueblo, CO 81001",
    hours_weekly: null,
    hours_irregular: null,
    phone: null,
    url: null,
    operator: null,
    last_verified: "2026-05-14",
    accepts_snap: null,
    accepts_wic: null,
    ...overrides,
  };
}

function entry(id: string, overrides: Partial<ListEntry> = {}): ListEntry {
  return { upstreamId: id, name: "Loaf N Jug 750038", street: "1002 Bonforte Blvd", city: "Pueblo", zip: "81001", lat: 38.287191, lng: -104.59641, ...overrides };
}

function build(source: typeof SNAP_SOURCE | typeof WIC_SOURCE, entries: ListEntry[], venues: BenefitVenueRow[]) {
  return buildBenefitListProposals({ source, entries, venues, runId: "r1", today: TODAY, fetchedAt: FETCHED });
}

/** Ten agreeing SNAP stores, far apart, so a test's own venue never trips the sanity guardrail. */
const agreeing = Array.from({ length: 10 }, (_, i) => {
  const lat = 38.1 + i * 0.05;
  return {
    v: venue(`ok-${i}`, { name: `Store ${i}`, address: `${100 + i} Elm Street, Pueblo, CO 81001`, lat, lng: -104.9, accepts_snap: 1 }),
    e: entry(`usda-ok-${i}`, { name: `STORE ${i}`, street: `${100 + i} Elm St`, lat, lng: -104.9 }),
  };
});
const withAgreeing = (es: ListEntry[], vs: BenefitVenueRow[]) => build(SNAP_SOURCE, [...agreeing.map((a) => a.e), ...es], [...agreeing.map((a) => a.v), ...vs]);
const cardFor = (r: ReturnType<typeof build>, id: string) => r.proposals.filter((p) => p.targetVenueId === id);

describe("buildBenefitListProposals", () => {
  test.each([
    ["unknown", null],
    ["no", 0],
  ])("list says yes, map says %s -> a card proposing the tick", (_label, current) => {
    const [card] = cardFor(withAgreeing([entry("usda-1")], [venue("v", { accepts_snap: current })]), "v");
    expect(card.proposedDiff.before).toMatchObject({ accepts_snap: current });
    expect(card.proposedDiff.after).toMatchObject({ accepts_snap: 1 });
    expect(card.proposedDiff.fields_changed).toEqual(["accepts_snap", "last_verified"]);
    expect(card.proposedDiff.meta?.needs_review).toBeUndefined();
  });

  test("map says yes, store not on the list -> a review card that changes NO field (never 'doesn't accept')", () => {
    const [card] = cardFor(withAgreeing([], [venue("v", { accepts_snap: 1 })]), "v");
    expect(card.proposedDiff.fields_changed).toEqual(["last_verified"]);
    expect(JSON.stringify(card.proposedDiff.after)).not.toContain("accepts_snap");
    expect(card.proposedDiff.meta?.needs_review).toBeTruthy();
  });

  test("a same-name chain sibling 1.4 km away does not hide a store's own drop-off", () => {
    const sibling = entry("usda-2", { name: "Loaf N Jug 750078", street: "2120 Oakshire Ln", lat: 38.284965, lng: -104.5804 });
    const [card] = cardFor(withAgreeing([sibling], [venue("v", { accepts_snap: 1 })]), "v");
    expect(card.proposedDiff.meta?.needs_review).toBeTruthy();
    expect(card.proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("a list record another venue already matches strongly is never offered to a second venue", () => {
    const owner = venue("owner", { accepts_snap: 1 });
    // Our second Loaf 'N Jug, 900 m away with no house number: name alone would make it an uncertain match.
    const other = venue("other", { address: "Lucille Street, Pueblo, CO 81005", lat: 38.2795, lng: -104.59641 });
    const r = withAgreeing([entry("usda-1")], [owner, other]);
    expect(cardFor(r, "other")).toEqual([]);
  });

  test("an uncertain match on a no/unknown tick -> a needs-a-look card, never a plain change", () => {
    // Same address, different name (a store that changed hands).
    const [card] = cardFor(
      withAgreeing([entry("usda-1", { name: "Alta 6135", street: "3201 Lake Ave", lat: 38.2186, lng: -104.6256 })], [venue("v", { name: "Western Convenience Store", address: "3201 Lake Avenue, Pueblo, CO 81004", lat: 38.218303, lng: -104.625608 })]),
      "v",
    );
    expect(card.proposedDiff.after).toMatchObject({ accepts_snap: 1 });
    expect(card.proposedDiff.meta?.needs_review).toBeTruthy();
  });

  test.each([
    ["map yes, list yes", 1, [entry("usda-1")]],
    ["map no, not on the list", 0, []],
    ["map unknown, not on the list", null, []],
  ])("%s -> nothing to review", (_label, current, es) => {
    const r = withAgreeing(es as ListEntry[], [venue("v", { accepts_snap: current as number | null })]);
    expect(cardFor(r, "v").filter((p) => p.proposedDiff.fields_changed.length > 1 || p.proposedDiff.meta?.needs_review)).toEqual([]);
  });

  test("an approved 'maybe' match counts as the same place next month (no false 'not on the list' card)", () => {
    const valley = entry("wic-valley", { name: "VALLEY MARKET", street: "4493 Bent Brothers Blvd", city: "COLORADO CITY", zip: "81019", lat: null, lng: null });
    const ours = (wic: number | null) => venue("v", { name: "Valley Market", category: "grocery", address: "Address not in OpenStreetMap", accepts_wic: wic });
    const [maybe] = cardFor(build(WIC_SOURCE, [valley], [ours(null)]), "v");
    expect(maybe.proposedDiff.meta?.match).toEqual({ upstream_id: "wic-valley" });
    // Approving it records the alias (applyApprovedProposal) and ticks the box; next month:
    const next = buildBenefitListProposals({
      source: WIC_SOURCE, entries: [valley], venues: [ours(1)], runId: "r2", today: "2026-12-15", fetchedAt: FETCHED,
      aliases: [{ source: WIC_SOURCE, upstream_id: "wic-valley", venue_id: "v" }],
    });
    expect(cardFor(next, "v").filter((p) => p.proposedDiff.meta?.needs_review)).toEqual([]);
  });

  test("WIC (no coordinates) matches on name and the same street number", () => {
    const r = build(WIC_SOURCE, [entry("wic-1", { name: "ALBERTSONS #816", street: "1601 HIGHWAY 50 WEST", lat: null, lng: null })], [venue("v", { name: "Albertsons", address: "1601 US 50, Pueblo, CO 81008", category: "grocery" })]);
    const [card] = cardFor(r, "v");
    expect(card.proposedDiff.after).toMatchObject({ accepts_wic: 1 });
    expect(card.proposedDiff.meta?.needs_review).toBeUndefined();
  });

  test("a list missing many map-yes stores is treated as a bad read: abort, no cards", () => {
    const venues = Array.from({ length: 10 }, (_, i) => venue(`y${i}`, { accepts_snap: 1, lat: 38 + i * 0.05 }));
    const r = build(SNAP_SOURCE, [entry("usda-far", { name: "Far Away", street: "1 Nowhere Rd", lat: 37, lng: -103 })], venues);
    expect(r.aborted).toBeTruthy();
    expect(r.proposals).toEqual([]);
  });

  test("stores whose 'not on the list' card Kyle already decided don't trip the bad-download guardrail", () => {
    // Five ticked stores off the list trip the guardrail (floor 5) — unless each card was decided before.
    const gone = Array.from({ length: 5 }, (_, i) => venue(`gone-${i}`, { accepts_snap: 1, lat: 37 + i * 0.05, lng: -103 }));
    const first = withAgreeing([], gone);
    expect(first.aborted).toBeTruthy();
    // Each card as an earlier month wrote it (one at a time, so that month's guardrail didn't trip).
    const decided = new Set(
      gone.map((g) => {
        const [p] = withAgreeing([], [g]).proposals.filter((x) => x.targetVenueId === g.id);
        return rejectionKey(p.source, p.targetVenueId, p.diffHash);
      }),
    );
    expect(decided.size).toBe(5);
    const next = buildBenefitListProposals({
      source: SNAP_SOURCE, entries: agreeing.map((a) => a.e), venues: [...agreeing.map((a) => a.v), ...gone],
      runId: "r1", today: "2026-12-15", fetchedAt: FETCHED, decidedKeys: decided,
    });
    expect(next.aborted).toBeUndefined();
    expect(next.proposals.filter((p) => p.targetVenueId.startsWith("gone-"))).toEqual([]);
  });

  test("an APPROVED 'not on the list' card stays quiet the next month (existing approval memory)", () => {
    const [card] = cardFor(withAgreeing([], [venue("v", { accepts_snap: 1 })]), "v");
    const approved = new Set([rejectionKey(card.source, card.targetVenueId, card.diffHash)]);
    // Next month, still off the list; the tick is still yes and last_verified moved on approve.
    const next = buildBenefitListProposals({
      source: SNAP_SOURCE, entries: agreeing.map((a) => a.e), venues: [...agreeing.map((a) => a.v), venue("v", { accepts_snap: 1, last_verified: TODAY })],
      runId: "r2", today: "2026-12-15", fetchedAt: "2026-12-15T07:00:00.000Z",
    });
    // refresh-ingest.ts drops it through the same call Care and Share uses.
    expect(dropAlreadyReviewed(cardFor(next, "v"), approved)).toEqual([]);
  });

  test("the same finding hashes the same next month, so a rejected card stays rejected", () => {
    const a = cardFor(withAgreeing([], [venue("v", { accepts_snap: 1 })]), "v")[0];
    const b = cardFor(
      buildBenefitListProposals({ source: SNAP_SOURCE, entries: agreeing.map((x) => x.e), venues: [...agreeing.map((x) => x.v), venue("v", { accepts_snap: 1 })], runId: "r2", today: "2026-12-13", fetchedAt: "2026-12-13T07:00:00.000Z" }),
      "v",
    )[0];
    expect(rejectionKey(b.source, b.targetVenueId, b.diffHash)).toBe(rejectionKey(a.source, a.targetVenueId, a.diffHash));
  });
});

describe("benefit-list cards through the real write path", () => {
  test("a 'not on the list' card is written pending, never auto-recorded as still listed", () => {
    const [card] = cardFor(withAgreeing([], [venue("v", { accepts_snap: 1 })]), "v");
    const built = buildProposalWriteStatements(card, FETCHED, sqlText, { observationsReady: true });
    expect(built.autoApplied).toBe(false);
    expect(built.statements.join("\n")).not.toContain("venue_observations");
  });

  test("an agreeing store is recorded as still listed without a card", () => {
    const [card] = cardFor(withAgreeing([entry("usda-1")], [venue("v", { accepts_snap: 1 })]), "v");
    expect(buildProposalWriteStatements(card, FETCHED, sqlText, { observationsReady: true }).autoApplied).toBe(true);
  });

  test.each([
    ["a tick change", entry("usda-1"), 0],
    ["a 'not on the list' check", null, 1],
  ])("a venue_direct pin on the tick is shown on %s", (_label, e, current) => {
    const pins: PinRow[] = [{ venue_id: "v", field: "accepts_snap", fetched_at: "2026-10-01T00:00:00.000Z", pinned_by: "kyle", pin_note: "owner said" }];
    const [card] = cardFor(withAgreeing(e ? [e] : [], [venue("v", { accepts_snap: current })]), "v");
    const built = buildProposalWriteStatements(card, FETCHED, sqlText, { pins, observationsReady: true });
    expect(built.autoApplied).toBe(false);
    expect(built.statements[0]).toContain('"pins":[{"field":"accepts_snap"');
  });
});
