// @vitest-environment node
// Regression tests for the two blockers left open in round 2 of the Codex
// review of PR #939: compound street directions ("North East" vs "North
// West") read as one address, and a list record shared by two of our venues
// silently covering an already-ticked one.
import { describe, expect, test } from "vitest";
import { dropAlreadyReviewed } from "./careAndShare";
import { rejectionKey } from "./diffEngine";
import { buildProposalWriteStatements } from "./proposalSql";
import { sqlText } from "./sql";
import { summarizeProposalForRow } from "@/components/VenueListView";
import type { ChangeProposalRow } from "@/lib/adminProposals";
import { buildBenefitListProposals, sameStreet, SNAP_SOURCE, WIC_SOURCE, type BenefitVenueRow, type ListEntry } from "./benefitLists";

const TODAY = "2026-11-13";
const FETCHED = "2026-11-13T07:00:00.000Z";

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
const agreeing = Array.from({ length: 10 }, (_, i) => ({
  v: venue(`ok-${i}`, { name: `Store ${i}`, address: `${100 + i} Elm Street, Pueblo, CO 81001`, lat: 38.1 + i * 0.05, lng: -104.9, accepts_snap: 1 }),
  e: entry(`usda-ok-${i}`, { name: `STORE ${i}`, street: `${100 + i} Elm St`, lat: 38.1 + i * 0.05, lng: -104.9 }),
}));
const build = (es: ListEntry[], vs: BenefitVenueRow[], today = TODAY) =>
  buildBenefitListProposals({ source: SNAP_SOURCE, entries: [...agreeing.map((a) => a.e), ...es], venues: [...agreeing.map((a) => a.v), ...vs], runId: "r1", today, fetchedAt: FETCHED });
const cardsFor = (r: ReturnType<typeof build>, id: string) => r.proposals.filter((p) => p.targetVenueId === id);
const plainTick = (r: ReturnType<typeof build>, id: string) =>
  cardsFor(r, id).filter((p) => p.proposedDiff.fields_changed.includes("accepts_snap") && !p.proposedDiff.meta?.needs_review);

describe("A: compound and placed street directions", () => {
  test.each([
    ["100 N Main St", "100 S Main St", false, "north vs south"],
    ["100 E 4th St", "100 W 4th St", false, "east vs west"],
    ["100 NE Main St", "100 NW Main St", false, "NE vs NW: east contradicts west"],
    ["100 NE Main St", "100 SE Main St", false, "NE vs SE: north contradicts south"],
    ["100 North East Main Street", "100 North West Main Street", false, "the reviewer's case"],
    ["100 North East Main Street", "100 Northeast Main St", true, "two spellings of one direction"],
    ["100 NE Main St", "100 Main St Northeast", true, "abbreviation vs suffix word"],
    ["100 NE Main St", "100 N Main St", true, "a component missing on one side doesn't contradict"],
    ["100 N Main St", "100 Main St N", true, "prefix vs suffix"],
    ["100 N Main St", "100 Main St S", false, "prefix vs contradicting suffix"],
    ["1601 HIGHWAY 50 WEST", "1601 US 50, Pueblo, CO 81008", true, "the highway alias still matches"],
  ])("sameStreet(%s, %s) -> %s (%s)", (a, b, same) => {
    expect(sameStreet(a, b)).toBe(same);
  });

  test("the reviewer's WIC case no longer proposes a plain tick", () => {
    const r = buildBenefitListProposals({
      source: WIC_SOURCE, runId: "r1", today: TODAY, fetchedAt: FETCHED,
      entries: [entry("wic-nw", { name: "CORNER MARKET", street: "100 NORTH WEST MAIN STREET", lat: null, lng: null })],
      venues: [venue("v", { name: "Corner Market", category: "grocery", address: "100 North East Main Street, Pueblo, CO 81003" })],
    });
    expect(r.proposals.filter((p) => p.proposedDiff.fields_changed.includes("accepts_wic") && !p.proposedDiff.meta?.needs_review)).toEqual([]);
  });
});

describe("B: a record shared by two of our venues", () => {
  // One record, equally strong for A (0 m) and B (68 m); at neither's address.
  const rec = entry("usda-x", { street: "9 Elsewhere Rd" });
  const a = (tick: number | null) => venue("A", { accepts_snap: tick });
  const b = (tick: number | null) => venue("B", { lat: 38.2878, lng: -104.59641, address: "1080 Bonforte Boulevard, Pueblo, CO 81001", accepts_snap: tick });

  test.each([
    ["neither ticked", null, null],
    ["only A ticked", 1, null],
    ["only B ticked", null, 1],
    ["both ticked", 1, 1],
  ] as const)("%s -> each venue gets a needs-a-look card, never a plain tick or silence", (_l, ta, tb) => {
    const r = build([rec], [a(ta), b(tb)]);
    for (const [id, tick] of [["A", ta], ["B", tb]] as const) {
      const cards = cardsFor(r, id);
      expect(cards.some((p) => p.proposedDiff.meta?.needs_review)).toBe(true);
      expect(plainTick(r, id)).toEqual([]);
      // An already-ticked venue's card changes no field.
      if (tick === 1) expect(cards.every((p) => p.proposedDiff.fields_changed.join() === "last_verified")).toBe(true);
    }
  });

  test("a near-by record with no strong owner, beside two ticked venues, doesn't silently cover both", () => {
    // A Walgreens-style record 30-40 m from both of our ticked stores: location evidence for each, owned by neither.
    const near = entry("usda-near", { name: "Some Other Shop 12", street: "1040 Bonforte Blvd", lat: 38.2875, lng: -104.59641 });
    const r = build([near], [a(1), b(1)]);
    for (const id of ["A", "B"]) expect(cardsFor(r, id).some((p) => p.proposedDiff.meta?.needs_review)).toBe(true);
  });

  test("an already-ticked venue's shared card stays quiet after Kyle approves or rejects it", () => {
    const [card] = cardsFor(build([rec], [a(1), b(1)]), "A");
    expect(buildProposalWriteStatements(card, FETCHED, sqlText, { observationsReady: true }).autoApplied).toBe(false);
    const decided = new Set([rejectionKey(card.source, card.targetVenueId, card.diffHash)]);
    const next = cardsFor(build([rec], [a(1), b(1)], "2026-12-15"), "A");
    expect(next.filter((p) => !decided.has(rejectionKey(p.source, p.targetVenueId, p.diffHash)))).toEqual([]); // rejection memory
    expect(dropAlreadyReviewed(next, decided)).toEqual([]); // approval memory
  });

  test("the queue line for that card reads as a same-place question about the list", () => {
    const [card] = cardsFor(build([rec], [a(1), b(1)]), "A");
    const row = { id: 1, source: SNAP_SOURCE, target_venue_id: "A", change_type: "update" } as unknown as ChangeProposalRow;
    expect(summarizeProposalForRow({ row, parseError: false, diff: card.proposedDiff })).toBe("SNAP list: same place?");
  });
});
