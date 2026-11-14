// @vitest-environment node
// Regression tests for the five blockers in the Codex review of PR #939
// (round 1): a cut-off KML read as complete, opposite street directions read
// as one address, one list record counted for two venues, a still-listed row
// treated as a "not on the list" check, and a body-read failure escaping one
// list's failure boundary and taking the other list down with it.
import { describe, expect, test, vi } from "vitest";
import { buildProposalWriteStatements, type PinRow } from "./proposalSql";
import { sqlText } from "./sql";
import { summarizeProposalForRow } from "@/components/VenueListView";
import type { ChangeProposalRow } from "@/lib/adminProposals";
import {
  buildBenefitListProposals,
  fetchSnapList,
  fetchWicList,
  readEachList,
  sameStreet,
  SNAP_SOURCE,
  WIC_MAP_ID,
  WIC_SOURCE,
  type BenefitVenueRow,
  type ListEntry,
} from "./benefitLists";

const TODAY = "2026-11-13";
const FETCHED = "2026-11-13T07:00:00.000Z";
const log = () => {};

function placemark(name: string, street: string, city: string, zip: string): string {
  return `<Placemark><name>${name}</name><ExtendedData>
    <Data name="StreetAddrLine1"><value>${street}</value></Data>
    <Data name="City"><value>${city}</value></Data>
    <Data name="ZipCode"><value>${zip}</value></Data></ExtendedData></Placemark>`;
}
const filler = Array.from({ length: 150 }, (_, i) => placemark(`STORE #${i}`, `${i} MAIN ST`, "DENVER", "80202")).join("");
const pueblo = placemark("SAFEWAY #1760", "1017 N MARKET PLAZA", "PUEBLO WEST", "81007");
const KML_HEAD = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>WIC Stores</name><Folder><name>WIC Vendors</name>`;
const PAGE = `<a href="https://www.google.com/maps/d/u/0/viewer?mid=${WIC_MAP_ID}&amp;hl=en">map</a>`;

function wicFetch(kml: string) {
  return vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(url.includes("coloradowic.gov") ? PAGE : kml, { status: 200 })));
}

function venue(id: string, overrides: Partial<BenefitVenueRow> = {}): BenefitVenueRow {
  return {
    id, name: "Loaf 'N Jug", category: "convenience", lat: 38.287191, lng: -104.59641,
    address: "1002 Bonforte Boulevard, Pueblo, CO 81001", hours_weekly: null, hours_irregular: null, phone: null, url: null,
    operator: null, last_verified: "2026-05-14", accepts_snap: null, accepts_wic: null, ...overrides,
  };
}
function entry(id: string, overrides: Partial<ListEntry> = {}): ListEntry {
  return { upstreamId: id, name: "Loaf N Jug 750038", street: "1002 Bonforte Blvd", city: "Pueblo", zip: "81001", lat: 38.287191, lng: -104.59641, ...overrides };
}
/** Ten agreeing stores far apart, so one test venue never trips the bad-download guardrail. */
const agreeing = Array.from({ length: 10 }, (_, i) => ({
  v: venue(`ok-${i}`, { name: `Store ${i}`, address: `${100 + i} Elm Street, Pueblo, CO 81001`, lat: 38.1 + i * 0.05, lng: -104.9, accepts_snap: 1 }),
  e: entry(`usda-ok-${i}`, { name: `STORE ${i}`, street: `${100 + i} Elm St`, lat: 38.1 + i * 0.05, lng: -104.9 }),
}));
const build = (es: ListEntry[], vs: BenefitVenueRow[]) =>
  buildBenefitListProposals({ source: SNAP_SOURCE, entries: [...agreeing.map((a) => a.e), ...es], venues: [...agreeing.map((a) => a.v), ...vs], runId: "r1", today: TODAY, fetchedAt: FETCHED });
const cardsFor = (r: ReturnType<typeof build>, id: string) => r.proposals.filter((p) => p.targetVenueId === id);

describe("1: a cut-off WIC KML is a partial read", () => {
  test("well past the statewide minimum, but missing its closing tags -> ok:false", async () => {
    const cut = `${KML_HEAD}${pueblo}${filler}<Placemark><name>HALF A STO`;
    expect((await fetchWicList({ fetch: wicFetch(cut), log })).ok).toBe(false);
  });
  test("the same document, complete -> ok:true", async () => {
    expect((await fetchWicList({ fetch: wicFetch(`${KML_HEAD}${pueblo}${filler}</Folder></Document></kml>\n`), log })).ok).toBe(true);
  });
});

describe("2: opposite street directions are different addresses", () => {
  test.each([
    ["100 North Main Street", "100 South Main Street", false],
    ["100 E 4th St", "100 W 4th St", false],
    ["1601 HIGHWAY 50 WEST", "1601 US 50, Pueblo, CO 81008", true],
    ["3050 WEST NORTHERN", "3050 West Northern Avenue, Pueblo, CO 81005", true],
    ["1017 N MARKET PLAZA", "1017 North Market Plaza, Pueblo, CO 81007", true],
  ])("sameStreet(%s, %s) -> %s", (a, b, same) => {
    expect(sameStreet(a, b)).toBe(same);
  });

  test("SNAP: a same-name record at the opposite-direction address 11 km away doesn't keep a dropped store 'still listed'", () => {
    const north = venue("v", { name: "Corner Market", address: "100 North Main Street, Pueblo, CO 81003", accepts_snap: 1 });
    const south = entry("usda-s", { name: "CORNER MARKET", street: "100 S Main St", lat: 38.187, lng: -104.59641 });
    const [card] = cardsFor(build([south], [north]), "v");
    expect(card.proposedDiff.meta?.needs_review).toBeTruthy();
    expect(card.proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("WIC (no distance): the opposite-direction address never proposes the tick", () => {
    const r = buildBenefitListProposals({
      source: WIC_SOURCE, runId: "r1", today: TODAY, fetchedAt: FETCHED,
      entries: [entry("wic-s", { name: "CORNER MARKET", street: "100 SOUTH MAIN ST", lat: null, lng: null })],
      venues: [venue("v", { name: "Corner Market", category: "grocery", address: "100 North Main Street, Pueblo, CO 81003" })],
    });
    expect(r.proposals.filter((p) => p.proposedDiff.fields_changed.includes("accepts_wic") && !p.proposedDiff.meta?.needs_review)).toEqual([]);
  });
});

describe("3: one list record belongs to one venue", () => {
  // The record's own store (A) and a same-name store of ours 89 m away at another address (B).
  const record = entry("usda-a");
  const a = (tick: number | null) => venue("A", { accepts_snap: tick });
  const b = (tick: number | null) => venue("B", { address: "1080 Bonforte Boulevard, Pueblo, CO 81001", lat: 38.287991, lng: -104.59641, accepts_snap: tick });

  test("B unticked -> no plain 'listed' card from A's record", () => {
    const r = build([record], [a(1), b(null)]);
    expect(cardsFor(r, "B").filter((p) => p.proposedDiff.fields_changed.includes("accepts_snap") && !p.proposedDiff.meta?.needs_review)).toEqual([]);
  });

  test("B ticked -> A's record doesn't hide B's drop-off", () => {
    const [card] = cardsFor(build([record], [a(1), b(1)]), "B");
    expect(card?.proposedDiff.meta?.needs_review).toBeTruthy();
    expect(card?.proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("an approved alias wins over an exact address", () => {
    const r = buildBenefitListProposals({
      source: SNAP_SOURCE, runId: "r1", today: TODAY, fetchedAt: FETCHED, entries: [...agreeing.map((x) => x.e), record],
      venues: [...agreeing.map((x) => x.v), a(null), b(null)], aliases: [{ source: SNAP_SOURCE, upstream_id: "usda-a", venue_id: "B" }],
    });
    expect(cardsFor(r, "B").some((p) => p.proposedDiff.fields_changed.includes("accepts_snap") && !p.proposedDiff.meta?.needs_review)).toBe(true);
    expect(cardsFor(r, "A").filter((p) => p.proposedDiff.fields_changed.includes("accepts_snap") && !p.proposedDiff.meta?.needs_review)).toEqual([]);
  });

  test("two venues equally strong for one record (neither at its address) -> review, never a plain change", () => {
    const rec = entry("usda-x", { street: "9 Elsewhere Rd" });
    const r = build([rec], [venue("A"), venue("B", { lat: 38.2878, lng: -104.59641, address: "1080 Bonforte Boulevard, Pueblo, CO 81001" })]);
    for (const id of ["A", "B"]) {
      expect(cardsFor(r, id).filter((p) => p.proposedDiff.fields_changed.includes("accepts_snap") && !p.proposedDiff.meta?.needs_review)).toEqual([]);
    }
  });
});

describe("4: a still-listed row is not a 'not on the list' check", () => {
  const [stillListed] = cardsFor(build([entry("usda-1")], [venue("v", { accepts_snap: 1 })]), "v");
  test("a pin on the tick doesn't turn an agreeing store's still-listed row into a pending card", () => {
    const pins: PinRow[] = [{ venue_id: "v", field: "accepts_snap", fetched_at: "2026-10-01T00:00:00.000Z", pinned_by: "kyle", pin_note: null }];
    expect(buildProposalWriteStatements(stillListed, FETCHED, sqlText, { pins, observationsReady: true }).autoApplied).toBe(true);
  });
  test("the queue never labels it 'Not on the list'", () => {
    const row = { id: 1, source: SNAP_SOURCE, target_venue_id: "v", change_type: "update" } as unknown as ChangeProposalRow;
    expect(summarizeProposalForRow({ row, parseError: false, diff: stillListed.proposedDiff })).not.toMatch(/Not on the/);
  });
});

describe("5: a failed body read stops only that list", () => {
  const brokenBody = () =>
    Promise.resolve({ ok: true, status: 200, text: () => Promise.reject(new Error("socket hang up")) } as unknown as Response);

  test.each([
    ["SNAP", () => fetchSnapList({ fetch: vi.fn().mockImplementation(brokenBody), log })],
    ["WIC page", () => fetchWicList({ fetch: vi.fn().mockImplementation(brokenBody), log })],
  ])("%s body fails mid-read -> ok:false, not a throw", async (_l, run) => {
    expect((await run()).ok).toBe(false);
  });

  test("SNAP's body failing still lets WIC's cards through", async () => {
    const wicGood = `${KML_HEAD}${pueblo}${filler}</Folder></Document></kml>`;
    const safeway = venue("safeway", { name: "Safeway", category: "grocery", address: "1017 North Market Plaza, Pueblo, CO 81007", accepts_wic: 0 });
    const out = await readEachList(
      [
        { source: SNAP_SOURCE, read: () => fetchSnapList({ fetch: vi.fn().mockImplementation(brokenBody), log }) },
        { source: WIC_SOURCE, read: () => fetchWicList({ fetch: wicFetch(wicGood), log }) },
      ],
      (source, got) => buildBenefitListProposals({ source, entries: got.entries, venues: [safeway], runId: "r1", today: TODAY, fetchedAt: got.fetchedAt }),
      { log, error: log },
    );
    expect(out.anyAborted).toBe(true);
    expect(out.proposals.map((p) => `${p.source}:${p.targetVenueId}`)).toEqual(["cdphe_wic:safeway"]);
  });

  test("an unexpected throw inside one list's read is contained the same way", async () => {
    const out = await readEachList(
      [
        { source: SNAP_SOURCE, read: () => Promise.reject(new Error("boom")) },
        { source: WIC_SOURCE, read: () => Promise.resolve({ ok: true, entries: [], fetchedAt: FETCHED, requests: 2 }) },
      ],
      () => ({ proposals: [] }),
      { log, error: log },
    );
    expect(out.anyAborted).toBe(true);
  });
});
