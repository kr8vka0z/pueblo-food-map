import { describe, test, expect } from "vitest";
import { haversineDistanceKm, normalizedPhoneTail, findRenamePairCandidates } from "./renamePairs";
import type { CurrentVenueRow, ProposalDraft } from "./diffEngine";

function currentRow(overrides: Partial<CurrentVenueRow> = {}): CurrentVenueRow {
  return {
    id: "plentiful-old-name",
    name: "Old Name Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St",
    hours_weekly: null,
    phone: "719-555-0100",
    url: null,
    operator: null,
    last_verified: "2026-08-01",
    ...overrides,
  };
}

function removeProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    source: "plentiful",
    targetVenueId: "plentiful-old-name",
    changeType: "remove",
    proposedDiff: { before: { id: "plentiful-old-name", name: "Old Name Pantry" }, after: null, fields_changed: [] },
    diffHash: "hash-remove",
    runId: "run-1",
    ...overrides,
  };
}

function addProposal(overrides: Partial<ProposalDraft> = {}, afterOverrides: Record<string, unknown> = {}): ProposalDraft {
  return {
    source: "plentiful",
    targetVenueId: "plentiful-new-name",
    changeType: "add",
    proposedDiff: {
      before: null,
      after: {
        id: "plentiful-new-name",
        name: "New Name Pantry",
        category: "pantry",
        lat: 38.2545,
        lng: -104.6092,
        address: "123 Main St",
        phone: "719-555-0100",
        last_verified: "2026-09-15",
        ...afterOverrides,
      },
      fields_changed: ["id", "name", "category", "lat", "lng", "address", "phone", "last_verified"],
    },
    diffHash: "hash-add",
    runId: "run-1",
    ...overrides,
  };
}

describe("haversineDistanceKm", () => {
  test("zero distance between identical points", () => {
    expect(haversineDistanceKm({ lat: 38.25, lng: -104.6 }, { lat: 38.25, lng: -104.6 })).toBe(0);
  });

  test("~11m apart for a tiny lat/lng nudge (well under the 100m threshold)", () => {
    const d = haversineDistanceKm({ lat: 38.2544, lng: -104.6091 }, { lat: 38.2545, lng: -104.6092 });
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(0.1);
  });

  test("~1.1km apart for a 0.01 degree lat nudge (over the threshold)", () => {
    const d = haversineDistanceKm({ lat: 38.25, lng: -104.6 }, { lat: 38.26, lng: -104.6 });
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(1.2);
  });
});

describe("normalizedPhoneTail", () => {
  test("strips formatting to the last 10 digits", () => {
    expect(normalizedPhoneTail("(719) 555-0100")).toBe("7195550100");
    expect(normalizedPhoneTail("+1 719-555-0100")).toBe("7195550100");
  });

  test("fewer than 10 digits is never a match signal", () => {
    expect(normalizedPhoneTail("555-0100")).toBeNull();
  });

  test("null/empty is never a match signal", () => {
    expect(normalizedPhoneTail(null)).toBeNull();
    expect(normalizedPhoneTail("")).toBeNull();
  });
});

describe("findRenamePairCandidates", () => {
  test("pairs a same-source remove+add within 100m", () => {
    const removed = currentRow();
    const rm = removeProposal();
    const add = addProposal();
    const pairs = findRenamePairCandidates([rm, add], [removed]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchedBy).toBe("coordinates");
    expect(pairs[0].removeProposal).toBe(rm);
    expect(pairs[0].addProposal).toBe(add);
    expect(pairs[0].removedRow).toBe(removed);
  });

  test("does not pair across different sources", () => {
    const removed = currentRow({ id: "osm-old" });
    const rm = removeProposal({ source: "osm", targetVenueId: "osm-old" });
    const add = addProposal({ source: "plentiful" });
    expect(findRenamePairCandidates([rm, add], [removed])).toHaveLength(0);
  });

  test("does not pair when far apart and phone differs", () => {
    const removed = currentRow();
    const rm = removeProposal();
    const add = addProposal({}, { lat: 38.9, lng: -104.9, phone: "719-555-9999" });
    expect(findRenamePairCandidates([rm, add], [removed])).toHaveLength(0);
  });

  test("pairs via matching phone when far apart geographically", () => {
    const removed = currentRow();
    const rm = removeProposal();
    const add = addProposal({}, { lat: 38.9, lng: -104.9, phone: "(719) 555-0100" });
    const pairs = findRenamePairCandidates([rm, add], [removed]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchedBy).toBe("phone");
  });

  test("greedy pairing: each add is used at most once, closest remove wins", () => {
    const removedNear = currentRow({ id: "plentiful-old-1" });
    const removedFar = currentRow({ id: "plentiful-old-2", lat: 38.2600, lng: -104.6150 });
    const rm1 = removeProposal({ targetVenueId: "plentiful-old-1" });
    const rm2 = removeProposal({ targetVenueId: "plentiful-old-2" });
    const add = addProposal();

    const pairs = findRenamePairCandidates([rm1, rm2, add], [removedNear, removedFar]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].removeProposal.targetVenueId).toBe("plentiful-old-1");
  });

  test("a remove whose target has no matching currentRows entry is skipped, not thrown", () => {
    const rm = removeProposal({ targetVenueId: "missing-id" });
    const add = addProposal();
    expect(() => findRenamePairCandidates([rm, add], [])).not.toThrow();
    expect(findRenamePairCandidates([rm, add], [])).toHaveLength(0);
  });

  test("link_health proposals are never candidates", () => {
    const removed = currentRow();
    const rm = removeProposal();
    const linkHealthUpdate: ProposalDraft = {
      source: "link_health",
      targetVenueId: "plentiful-new-name",
      changeType: "update",
      proposedDiff: { before: { url: "https://dead.example" }, after: { url: null as unknown as string }, fields_changed: ["url"] },
      diffHash: "hash-lh",
      runId: "run-1",
    };
    expect(findRenamePairCandidates([rm, linkHealthUpdate], [removed])).toHaveLength(0);
  });
});
