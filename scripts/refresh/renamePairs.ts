/**
 * renamePairs.ts — closes the rename/move gap (issue #543, AGENTS.md):
 * Plentiful ids embed the venue's name, so a renamed venue arrives as a
 * remove + an add, not an update (an OSM node→way remap does the same).
 *
 * Three pure pieces, all used by scripts/refresh-ingest.ts + triage.ts:
 *   - findRenamePairCandidates: which remove+add pairs are worth asking
 *     about — same source, within 100m, or the same phone number.
 *   - buildRenameProposal: ONE `update` proposal on the OLD id carrying the
 *     new listing's changed fields, with `meta.rename` naming both ids.
 *     Approving it (src/lib/adminProposals.ts) updates the old row in place
 *     — its id, public /venue/<id> link and audit history survive — and
 *     records the new upstream id in `venue_id_aliases` (migration 0016).
 *   - applyIdAliases: maps incoming records through that table BEFORE the
 *     diff, so the next scrape matches the old row instead of proposing the
 *     same remove+add pair every week.
 *
 * Same-source only: a cross-source pair (OSM remove + Plentiful add) widens
 * the false-positive surface for a case the issue doesn't name.
 */

import type { Venue } from "@/types/venue";
import {
  computeDiffHash,
  currentFieldValue,
  isGuardedClear,
  SOURCE_OWNED_FIELDS,
  valuesEqual,
  type CurrentVenueRow,
  type ProposalDraft,
  type RefreshSource,
} from "./diffEngine";

export interface RenamePairCandidate {
  matchedBy: "coordinates" | "phone";
  /** Metres between the removed row and the add; null when the add had no coordinates. */
  distanceM: number | null;
  removeProposal: ProposalDraft;
  addProposal: ProposalDraft;
  /** The removed venue's full current row — its remove proposal only carries {id, name}. */
  removedRow: CurrentVenueRow;
}

const COORDINATE_MATCH_KM = 0.1; // 100m — same building/block, not a coincidence
const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km. Standard haversine — no library for two points. */
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Last 10 digits (tolerates a leading "1" or any formatting); null under 10 digits — a short phone is no match signal. */
export function normalizedPhoneTail(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length < 10 ? null : digits.slice(-10);
}

/**
 * Every same-source remove×add match, best first (coordinate matches by
 * distance, then phone-only matches), assigned greedily so each remove and
 * each add pairs at most once. Sorting globally — not per remove in input
 * order — means an earlier remove with a phone-only match can't steal an
 * add that a later remove sits 10m from.
 */
export function findRenamePairCandidates(proposals: ProposalDraft[], currentRows: CurrentVenueRow[]): RenamePairCandidate[] {
  const currentById = new Map(currentRows.map((r) => [r.id, r]));
  const removes = proposals.filter((p) => p.changeType === "remove" && p.source !== "link_health");
  const adds = proposals.filter((p) => p.changeType === "add" && p.source !== "link_health");

  const matches: RenamePairCandidate[] = [];
  for (const removeProposal of removes) {
    const removedRow = currentById.get(removeProposal.targetVenueId);
    if (!removedRow) continue;
    for (const addProposal of adds) {
      if (addProposal.source !== removeProposal.source) continue;
      const after = (addProposal.proposedDiff.after ?? {}) as { lat?: number; lng?: number; phone?: string };
      const distanceKm =
        typeof after.lat === "number" && typeof after.lng === "number"
          ? haversineDistanceKm(removedRow, { lat: after.lat, lng: after.lng })
          : null;
      const phoneA = normalizedPhoneTail(removedRow.phone);
      let matchedBy: RenamePairCandidate["matchedBy"] | null = null;
      if (distanceKm !== null && distanceKm < COORDINATE_MATCH_KM) matchedBy = "coordinates";
      else if (phoneA !== null && phoneA === normalizedPhoneTail(after.phone)) matchedBy = "phone";
      if (!matchedBy) continue;
      matches.push({
        matchedBy,
        distanceM: distanceKm === null ? null : Math.round(distanceKm * 1000),
        removeProposal,
        addProposal,
        removedRow,
      });
    }
  }

  const rank = (m: RenamePairCandidate) => (m.matchedBy === "coordinates" ? 0 : 1);
  matches.sort((a, b) => rank(a) - rank(b) || (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));

  const usedRemoves = new Set<ProposalDraft>();
  const usedAdds = new Set<ProposalDraft>();
  const out: RenamePairCandidate[] = [];
  for (const m of matches) {
    if (usedRemoves.has(m.removeProposal) || usedAdds.has(m.addProposal)) continue;
    usedRemoves.add(m.removeProposal);
    usedAdds.add(m.addProposal);
    out.push(m);
  }
  return out;
}

/** `meta.rename` on a rename proposal's proposed_diff — read by the approve path and /admin/flags. */
export interface RenameMeta {
  from_id: string;
  to_id: string;
  matched_by: RenamePairCandidate["matchedBy"];
  distance_m: number | null;
}

/**
 * The single proposal that replaces a paired remove + add: an `update` of
 * the OLD id whose before/after hold only the source-owned fields that
 * differ (same field list, same value normalisation and same
 * destructive-clear guard as diffEngine's own update branch), plus
 * last_verified. `id` never appears in fields_changed — the row keeps its
 * id; the new upstream id is recorded as an alias on approval instead.
 * The hash includes the new id, so rejecting one rename doesn't suppress a
 * different one for the same venue.
 */
export function buildRenameProposal(candidate: RenamePairCandidate, today: string): ProposalDraft {
  const source = candidate.removeProposal.source as RefreshSource;
  const current = candidate.removedRow;
  const incoming = (candidate.addProposal.proposedDiff.after ?? {}) as Venue;
  const toId = candidate.addProposal.targetVenueId;

  const changed = SOURCE_OWNED_FIELDS[source].filter((f) => {
    const cur = currentFieldValue(current, f);
    const inc = currentFieldValue(incoming as unknown as CurrentVenueRow, f);
    return !valuesEqual(cur, inc) && !isGuardedClear(source, f, cur, inc);
  });

  const before: Partial<Venue> = { last_verified: current.last_verified };
  const after: Partial<Venue> = { last_verified: today };
  for (const f of changed) {
    (before as Record<string, unknown>)[f] = currentFieldValue(current, f);
    (after as Record<string, unknown>)[f] = currentFieldValue(incoming as unknown as CurrentVenueRow, f);
  }
  const fieldsChanged = [...changed, "last_verified"];
  const rename: RenameMeta = {
    from_id: current.id,
    to_id: toId,
    matched_by: candidate.matchedBy,
    distance_m: candidate.distanceM,
  };

  return {
    source,
    targetVenueId: current.id,
    changeType: "update",
    proposedDiff: { before, after, fields_changed: fieldsChanged, meta: { rename } },
    diffHash: computeDiffHash({ ...after, id: toId }, fieldsChanged),
    runId: candidate.removeProposal.runId,
  };
}

/** One venue_id_aliases row, as refresh-ingest.ts reads it. */
export interface IdAliasRow {
  source: string;
  upstream_id: string;
  venue_id: string;
}

/**
 * Re-keys incoming records whose upstream id an admin already approved as
 * a rename of an existing venue. A record whose own id is still a live row
 * is left alone — the row wins over a stale alias.
 */
export function applyIdAliases(
  source: RefreshSource,
  incoming: Venue[],
  aliases: IdAliasRow[],
  currentIds: ReadonlySet<string>,
): Venue[] {
  const map = new Map(aliases.filter((a) => a.source === source).map((a) => [a.upstream_id, a.venue_id]));
  if (map.size === 0) return incoming;
  return incoming.map((v) => {
    const target = map.get(v.id);
    return target && !currentIds.has(v.id) ? { ...v, id: target } : v;
  });
}
