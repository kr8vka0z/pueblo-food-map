/**
 * renamePairs.ts — closes the rename/move gap AGENTS.md and issue #543 both
 * name: "Plentiful ids embed the venue's name, so a renamed venue shows up
 * as a remove + an add, not an update" (diffEngine.ts's own
 * SOURCE_OWNED_FIELDS comment says the same for OSM node ids). Pure
 * candidate-finding only — deliberately NOT inside diffEngine.ts or its
 * test file: this runs as a SEPARATE pass over one diffSource() run's own
 * proposals plus that run's currentRows, so diffEngine.ts's existing
 * add/remove shapes and its own test suite stay untouched (a removed
 * venue's before-state — lat/lng/phone — isn't in ITS OWN remove proposal,
 * diffEngine's buildProposal only stores {id, name} for a remove — so this
 * needs the raw currentRows too, which only refresh-ingest.ts's caller has).
 *
 * Deterministic matching only (haversine distance or a shared phone number)
 * — Jev's `same_place` noul (scripts/refresh/triage.ts) is what actually
 * CONFIRMS a candidate; this module only narrows "which remove+add pairs
 * are even worth asking Jev about" so a run with, say, a real close and an
 * unrelated real new venue a mile away never gets treated as a pair.
 *
 * Same-source only (a remove and an add from DIFFERENT sources, e.g. an OSM
 * remove paired with a Plentiful add, isn't attempted here) — the issue's
 * own example (Plentiful ids) and AGENTS.md's are both single-source; a
 * cross-source pairing widens the false-positive surface for a case nobody
 * asked for. Flagged in this slice's report as a narrower scope than the
 * issue's prose technically allows.
 */

import type { CurrentVenueRow, ProposalDraft } from "./diffEngine";

export interface RenamePairCandidate {
  pairId: string;
  matchedBy: "coordinates" | "phone";
  removeProposal: ProposalDraft;
  addProposal: ProposalDraft;
  /** The removed venue's full current row — diffEngine's own remove proposal only carries {id, name}, so this is the only source of its lat/lng/phone for matching + the Jev state. */
  removedRow: CurrentVenueRow;
}

const COORDINATE_MATCH_KM = 0.1; // 100m — close enough to be "the same building/block," not "a coincidence"
const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in km. Standard haversine — no library needed for two points (ponytail rung 6). */
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const PHONE_DIGITS = /\D/g;

/** Last 10 digits (US-format-agnostic — tolerates a leading "1" or formatting) — null if fewer than 10 digits present, since a short/empty phone is never a reliable match signal. */
export function normalizedPhoneTail(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(PHONE_DIGITS, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizedPhoneTail(a);
  const nb = normalizedPhoneTail(b);
  return na !== null && na === nb;
}

/**
 * Greedy nearest-match pairing: for each remove (in input order), the
 * closest still-unpaired add from the SAME source within the coordinate
 * threshold, falling back to a phone match if no coordinate match exists.
 * Each remove and each add pairs at most once — a run with, say, two
 * genuinely unrelated removes near the same new venue only pairs the
 * nearer one; the other stays an ordinary remove proposal for a human.
 */
export function findRenamePairCandidates(proposals: ProposalDraft[], currentRows: CurrentVenueRow[]): RenamePairCandidate[] {
  const currentById = new Map(currentRows.map((r) => [r.id, r]));
  const removes = proposals.filter((p) => p.changeType === "remove" && p.source !== "link_health");
  const adds = proposals.filter((p) => p.changeType === "add" && p.source !== "link_health");
  const pairedAddIds = new Set<string>();
  const candidates: RenamePairCandidate[] = [];

  for (const removeProposal of removes) {
    const removedRow = currentById.get(removeProposal.targetVenueId);
    if (!removedRow) continue; // defensive — every remove proposal's target came from currentRows in the first place

    let best: { addProposal: ProposalDraft; matchedBy: "coordinates" | "phone"; distanceKm: number } | null = null;

    for (const addProposal of adds) {
      if (addProposal.source !== removeProposal.source) continue;
      if (pairedAddIds.has(addProposal.targetVenueId)) continue;
      const after = (addProposal.proposedDiff.after ?? {}) as { lat?: number; lng?: number; phone?: string };

      let matchedBy: "coordinates" | "phone" | null = null;
      let distanceKm = Infinity;
      if (typeof after.lat === "number" && typeof after.lng === "number") {
        distanceKm = haversineDistanceKm(removedRow, { lat: after.lat, lng: after.lng });
        if (distanceKm < COORDINATE_MATCH_KM) matchedBy = "coordinates";
      }
      if (!matchedBy && samePhone(removedRow.phone, after.phone)) {
        matchedBy = "phone";
      }
      if (!matchedBy) continue;

      if (!best || (matchedBy === "coordinates" && distanceKm < best.distanceKm)) {
        best = { addProposal, matchedBy, distanceKm };
      }
    }

    if (best) {
      pairedAddIds.add(best.addProposal.targetVenueId);
      candidates.push({
        pairId: `${removeProposal.source}:${removeProposal.targetVenueId}->${best.addProposal.targetVenueId}`,
        matchedBy: best.matchedBy,
        removeProposal,
        addProposal: best.addProposal,
        removedRow,
      });
    }
  }

  return candidates;
}
