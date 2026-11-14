/**
 * benefitLists.ts — the monthly SNAP and WIC check (Venue Data Rebuild step
 * 4, issue #938): compares the map's "Accepts SNAP" / "Accepts WIC" ticks on
 * stores and farms against two official lists and writes review cards only.
 * The ticks were matched once from official data (migration 0014, #597) and
 * never refreshed before this.
 *
 * Sources (checked 2026-11-13):
 *   - SNAP (`usda_snap`): USDA's own retailer-locator feature service on
 *     ArcGIS ("Location data for currently authorized SNAP retailers", the
 *     data behind fns.usda.gov/snap/retailer-locator; refreshed about
 *     weekly — last edit 2026-11-05). One query, State CO + County PUEBLO,
 *     125 rows. Chosen over the zip on /snap/retailer-locator/data: that file
 *     is the HISTORICAL list (authorized at any point in 20 years, "current
 *     as of Dec. 31, 2025", 23 MB, renamed each year), so it is up to a year
 *     stale and needs end-date filtering. The feature service only holds
 *     currently authorized stores, so a row on it is authorized today.
 *   - WIC (`cdphe_wic`): the Google "My Maps" map coloradowic.gov/find-wic-store
 *     links, downloaded as KML (444 placemarks statewide, 12 in Pueblo
 *     County). Its placemarks carry name and street address but NO
 *     coordinates, so WIC matches on name + street number only.
 *
 * Two pieces, the same split as careAndShare.ts:
 *   - fetchSnapList / fetchWicList (the only I/O; `fetch` injected): one
 *     request per file per run, and ANY failure — network, non-2xx, bad
 *     body, a truncated or empty read, the WIC page linking a different map —
 *     returns ok:false, so the caller writes nothing for that source. A
 *     missing record must never look like "doesn't accept".
 *   - buildBenefitListProposals (pure): matches each of our grocery,
 *     convenience and farm venues to the list and writes one of three cards:
 *       listed       list says yes, map says no/unknown -> propose the tick
 *       maybe_listed only an uncertain match, map says no/unknown -> the
 *                    same change, but marked needs_review (never plain).
 *                    Also used when the map already
 *                    says yes and the record is equally likely to be
 *                    another of our venues: that card changes NO field,
 *                    and approving it only links the record to this venue.
 *       not_listed   map says yes, nothing on the list -> a "please check"
 *                    card that changes NO field: dropping off a list is
 *                    never read as "doesn't accept"; Kyle edits the venue
 *                    if the store really stopped.
 *     A store both sides agree takes SNAP gets a "still listed" row (the
 *     date-only lane in proposalSql.ts: a fetch observation, no card), which
 *     is also what refreshAlerts.ts's staleness check reads.
 *
 * Matching reuses Care and Share's nameScore and streetKey (careAndShare.ts)
 * and its distance thresholds, without the phone rule (neither list has
 * phones).
 */

import type { Venue } from "@/types/venue";
import { checkSanityGuardrail, computeDiffHash, rejectionKey, type CurrentVenueRow, type ProposalDraft } from "./diffEngine";
import { nameScore, STRONG_DISTANCE_M, STRONG_NAME_SCORE, streetKey } from "./careAndShare";
import { haversineDistanceKm, type IdAliasRow } from "./renamePairs";

export const SNAP_SOURCE = "usda_snap" as const;
export const WIC_SOURCE = "cdphe_wic" as const;
export type BenefitSource = typeof SNAP_SOURCE | typeof WIC_SOURCE;
/** The `--only` value in refresh-ingest.ts that runs both lists. */
export const BENEFIT_LISTS_ONLY = "snap_wic" as const;

const FIELD: Record<BenefitSource, "accepts_snap" | "accepts_wic"> = { usda_snap: "accepts_snap", cdphe_wic: "accepts_wic" };
const MATCHABLE_CATEGORIES = new Set(["grocery", "convenience", "farm"]);

// Plain, descriptive, no personal details (brief: be polite to both hosts).
const USER_AGENT = "PuebloFoodMap-monthly-SNAP-WIC-check/1.0 (+https://pueblofoodmap.com)";
const REQUEST_TIMEOUT_MS = 60_000;

const SNAP_QUERY_URL =
  "https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0/query?" +
  new URLSearchParams({
    where: "State='CO' AND County='PUEBLO'",
    outFields: "Record_ID,Store_Name,Store_Street_Address,City,Zip_Code,Latitude,Longitude",
    returnGeometry: "false",
    orderByFields: "Record_ID",
    f: "json",
  }).toString();

const WIC_PAGE_URL = "https://www.coloradowic.gov/find-wic-store";
/**
 * Pinned, and checked against the page every run: if the state moves the
 * list to a new map, the old one may stay public but stop being updated, so
 * a different (or missing, or second) map id on the page fails the source
 * loudly instead of silently reading a stale list.
 */
export const WIC_MAP_ID = "1shLNoHB3zA6BeWy0ywqoYPsmLhAfpW1a";
const WIC_KML_URL = `https://www.google.com/maps/d/kml?mid=${WIC_MAP_ID}&forcekml=1`;
/** 444 statewide on 2026-11-13. Far fewer means a partial or wrong file, not a smaller program. */
const WIC_MIN_STATEWIDE = 100;
/**
 * ponytail: the KML has no coordinates, so "in Pueblo County" is a ZIP list:
 * every ZIP on USDA's Pueblo County rows (2026-11-13) plus 81002, which our
 * own venue addresses use. A Pueblo County store under any other ZIP is left
 * out, so its venue would get a "please check" card, never a lost tick.
 * Upgrade path: geocode the WIC addresses.
 */
export const PUEBLO_COUNTY_ZIPS: ReadonlySet<string> = new Set([
  "81001", "81002", "81003", "81004", "81005", "81006", "81007", "81008", "81019", "81022", "81023", "81025",
]);

// ─── Fetching ───────────────────────────────────────────────────────────────

export interface ListEntry {
  upstreamId: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  /** null for WIC (the KML has no coordinates). */
  lat: number | null;
  lng: number | null;
}

export interface ListFetchDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  log: (message: string) => void;
}

export type ListFetchResult =
  | { ok: true; entries: ListEntry[]; fetchedAt: string; requests: number }
  | { ok: false; reason: string; requests: number };

class ListStop extends Error {}

async function getText(deps: ListFetchDeps, url: string, what: string): Promise<string> {
  let res: Response;
  try {
    res = await deps.fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    throw new ListStop(`${what} request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new ListStop(`${what} returned HTTP ${res.status}`);
  // The body streams after the headers: a dropped connection or the timeout
  // can fail here, and that is the same failed download, not a crash
  // (Codex review of PR #939: it escaped and took the other list down).
  try {
    return await res.text();
  } catch (err) {
    throw new ListStop(`${what} failed while reading the response: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** USDA's currently-authorized SNAP retailers in Pueblo County, from one ArcGIS query. */
export async function fetchSnapList(deps: ListFetchDeps): Promise<ListFetchResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const text = await getText(deps, SNAP_QUERY_URL, "SNAP list");
    let body: { features?: unknown; error?: { message?: string }; exceededTransferLimit?: boolean };
    try {
      body = JSON.parse(text);
    } catch {
      throw new ListStop("SNAP list returned something that isn't JSON");
    }
    // ArcGIS reports a bad query as HTTP 200 with an `error` object.
    if (body.error) throw new ListStop(`SNAP list returned an error: ${body.error.message ?? "unknown"}`);
    if (body.exceededTransferLimit) throw new ListStop("SNAP list was cut short (exceededTransferLimit) — a partial read");
    if (!Array.isArray(body.features)) throw new ListStop("SNAP list had no feature list");
    const entries = body.features.map((f, i) => {
      const a = ((f as { attributes?: Record<string, unknown> })?.attributes ?? {}) as Record<string, unknown>;
      const name = str(a.Store_Name);
      const street = str(a.Store_Street_Address);
      if (typeof a.Record_ID !== "number" || !name || !street || typeof a.Latitude !== "number" || typeof a.Longitude !== "number") {
        throw new ListStop(`SNAP row ${i} is missing its id, name, street or coordinates`);
      }
      return { upstreamId: `usda-${a.Record_ID}`, name, street, city: str(a.City), zip: str(a.Zip_Code), lat: a.Latitude, lng: a.Longitude };
    });
    if (entries.length === 0) throw new ListStop("zero Pueblo County SNAP retailers — refusing to treat that as real");
    deps.log(`usda_snap: ${entries.length} Pueblo County retailer(s), 1 request`);
    return { ok: true, entries, fetchedAt, requests: 1 };
  } catch (err) {
    if (err instanceof ListStop) return { ok: false, reason: err.message, requests: 1 };
    throw err;
  }
}

function xmlText(raw: string): string {
  const m = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const s = m ? m[1] : raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, "&");
  return str(s);
}

/** Colorado WIC's authorized stores in Pueblo County: the find-a-store page (map id check), then its KML. */
export async function fetchWicList(deps: ListFetchDeps): Promise<ListFetchResult> {
  const fetchedAt = new Date().toISOString();
  let requests = 0;
  try {
    requests++;
    const page = await getText(deps, WIC_PAGE_URL, "WIC store page");
    const mids = [...new Set([...page.matchAll(/[?&;]mid=([A-Za-z0-9_-]+)/g)].map((m) => m[1]))];
    if (mids.length !== 1 || mids[0] !== WIC_MAP_ID) {
      throw new ListStop(`WIC store page links map(s) [${mids.join(", ") || "none"}], expected ${WIC_MAP_ID} — check the page and update WIC_MAP_ID`);
    }
    requests++;
    const doc = await getText(deps, WIC_KML_URL, "WIC map KML");
    // ponytail: a regex reader for Google My Maps' export shape (no XML
    // dependency; jsdom is installed but untyped here). Its ceiling is a
    // changed export shape, which fails loudly below (every placemark must
    // yield a name, street, city and ZIP). Upgrade path: a real XML parser.
    if (!/<kml[\s>]/.test(doc) || !/<Document[\s>]/.test(doc)) throw new ListStop("WIC map download isn't KML");
    // A download cut off mid-file can still hold well over the statewide
    // minimum of complete placemarks: require the closing tags, and every
    // opened placemark to be closed.
    if (!/<\/Document>\s*<\/kml>\s*$/.test(doc)) throw new ListStop("WIC map download is cut off (no closing </Document></kml>) — a partial read");
    const placemarks = [...doc.matchAll(/<Placemark[\s>]([\s\S]*?)<\/Placemark>/g)].map((m) => m[1]);
    const opened = doc.match(/<Placemark[\s>]/g)?.length ?? 0;
    if (opened !== placemarks.length) throw new ListStop(`WIC map has ${opened - placemarks.length} unclosed placemark(s) — a partial read`);
    if (placemarks.length < WIC_MIN_STATEWIDE) throw new ListStop(`WIC map has ${placemarks.length} store(s) statewide (expected at least ${WIC_MIN_STATEWIDE}) — a partial read`);
    const all = placemarks.map((p, i) => {
      const data = (n: string) => xmlText((p.match(new RegExp(`<Data name="${n}">\\s*<value>([\\s\\S]*?)</value>`)) ?? [])[1] ?? "");
      const name = xmlText((p.match(/<name>([\s\S]*?)<\/name>/) ?? [])[1] ?? "");
      const street = data("StreetAddrLine1");
      const city = data("City");
      const zip = data("ZipCode").slice(0, 5);
      if (!name || !street || !city || !zip) throw new ListStop(`WIC placemark ${i} is missing its name, street, city or ZIP`);
      return { upstreamId: `wic-${streetKey(street)}|${name.toLowerCase()}`, name, street, city, zip, lat: null, lng: null };
    });
    const entries = all.filter((e) => PUEBLO_COUNTY_ZIPS.has(e.zip));
    if (entries.length === 0) throw new ListStop("zero Pueblo County WIC stores — refusing to treat that as real");
    deps.log(`cdphe_wic: ${all.length} store(s) statewide, ${entries.length} in Pueblo County ZIPs, ${requests} request(s)`);
    return { ok: true, entries, fetchedAt, requests };
  } catch (err) {
    if (err instanceof ListStop) return { ok: false, reason: err.message, requests };
    throw err;
  }
}

// ─── Matching ───────────────────────────────────────────────────────────────

/** Our venue row plus the two tri-state columns (NULL unknown, 0 no, 1 yes). */
export interface BenefitVenueRow extends CurrentVenueRow {
  accepts_snap: number | null;
  accepts_wic: number | null;
}

/** Distance-only "same building" — tighter than STRONG_DISTANCE_M, because a Walgreens 53 m from a Loaf 'N Jug isn't it. */
const SAME_SPOT_M = 50;
/** A chain's same-name store this far away is worth a question, never proof. */
const NEAR_NAME_M = 2000;
const GENERIC_STREET_WORDS = new Set(["st", "ave", "blvd", "rd", "dr", "ln", "ct", "pl", "hwy", "pkwy", "cir", "ste", "w", "e", "n", "s", "us"]);
/**
 * Every spelling of a direction, as its compass components. streetKey has
 * already turned the words north/south/east/west into n/s/e/w, so "North
 * East" arrives as "n e"; the compounds arrive as one token.
 */
const DIRECTION_PARTS: Record<string, string[]> = {
  n: ["n"], s: ["s"], e: ["e"], w: ["w"],
  ne: ["n", "e"], nw: ["n", "w"], se: ["s", "e"], sw: ["s", "w"],
  northeast: ["n", "e"], northwest: ["n", "w"], southeast: ["s", "e"], southwest: ["s", "w"],
};
/** Spellings streetKey (shared with Care and Share) leaves apart that the lists and the map both use. */
const STREET_ALIASES: Record<string, string> = { plaza: "plz" };

/** Possessive apostrophes split words in nameScore ("Farm's" -> "farm s"); drop them first. */
const cleanName = (s: string) => s.replace(/['’]/g, "");

function houseNumber(address: string): string | null {
  const first = streetKey(address).split(" ")[0] ?? "";
  return /^\d+$/.test(first) ? first : null;
}

function streetIdentity(address: string): { number: string | null; dirs: Set<string>; names: Set<string> } {
  const words = streetKey(address).split(" ").filter(Boolean);
  const number = /^\d+$/.test(words[0] ?? "") ? words[0] : null;
  const rest = words.slice(number ? 1 : 0).map((w) => STREET_ALIASES[w] ?? w);
  // Before or after the street name, one word or two: all the same components.
  const dirs = new Set(rest.flatMap((w) => DIRECTION_PARTS[w] ?? []));
  return { number, dirs, names: new Set(rest.filter((w) => !GENERIC_STREET_WORDS.has(w) && !DIRECTION_PARTS[w])) };
}

/**
 * North against south, or east against west. A component on one side only
 * is no conflict: the lists and the map often drop part of a direction
 * ("1601 HIGHWAY 50 WEST" vs "1601 US 50", "NE" vs "N").
 */
function directionsConflict(a: Set<string>, b: Set<string>): boolean {
  return (a.has("n") && b.has("s")) || (a.has("s") && b.has("n")) || (a.has("e") && b.has("w")) || (a.has("w") && b.has("e"));
}

/**
 * The same street address: same house number, no conflicting direction
 * ("100 N Main" is not "100 S Main"), and one side's street-name words all
 * on the other side. Looser than streetKey equality on purpose: the lists
 * write "1601 HIGHWAY 50 WEST" where we have "1601 US 50" (a direction on
 * one side only is fine). Never ZIP: the lists and the map disagree on ZIPs
 * (King Soopers #12 is 81004 on WIC's list, 81005 on ours).
 */
export function sameStreet(a: string, b: string): boolean {
  const x = streetIdentity(a);
  const y = streetIdentity(b);
  if (!x.number || x.number !== y.number) return false;
  if (directionsConflict(x.dirs, y.dirs)) return false;
  if (x.names.size === 0 || y.names.size === 0) return false;
  return [...x.names].every((w) => y.names.has(w)) || [...y.names].every((w) => x.names.has(w));
}

interface Evidence {
  entry: ListEntry;
  /** Kyle approved this record as this venue before (an alias). */
  known?: boolean;
  name_score: number;
  same_street: boolean;
  distance_m: number | null;
}

function evidenceFor(e: ListEntry, v: BenefitVenueRow): Evidence {
  const distance_m = e.lat === null || e.lng === null ? null : Math.round(haversineDistanceKm({ lat: e.lat, lng: e.lng }, v) * 1000);
  return {
    entry: e,
    name_score: Math.round(nameScore(cleanName(e.name), cleanName(v.name)) * 100) / 100,
    // Where SNAP gives coordinates, a matching address kilometres away is a
    // different place with the same street address, not this store.
    same_street: sameStreet(e.street, v.address) && (distance_m === null || distance_m <= NEAR_NAME_M),
    distance_m,
  };
}

/** The same place: a strong name AND (close by, or the same street number). WIC has no distance, so it needs the street. */
function isStrong(ev: Evidence): boolean {
  if (ev.known) return true;
  if (ev.name_score < STRONG_NAME_SCORE) return false;
  return ev.same_street || (ev.distance_m !== null && ev.distance_m <= STRONG_DISTANCE_M);
}

/** Evidence about WHERE, not just the name — the only kind allowed to stop a "please check". */
function hasLocationEvidence(ev: Evidence): boolean {
  if (ev.same_street) return true;
  if (ev.distance_m === null) return false;
  return ev.distance_m <= SAME_SPOT_M || (ev.distance_m <= STRONG_DISTANCE_M && ev.name_score >= 0.5);
}

/** Worth asking about: location evidence, or a strong name nearby (or, for WIC, when our address has no number to compare). */
function isCandidate(ev: Evidence, venueAddress: string): boolean {
  if (hasLocationEvidence(ev)) return true;
  if (ev.name_score < STRONG_NAME_SCORE) return false;
  return ev.distance_m !== null ? ev.distance_m <= NEAR_NAME_M : houseNumber(venueAddress) === null;
}

// ─── Proposals ──────────────────────────────────────────────────────────────

export type ListFinding = "listed" | "maybe_listed" | "not_listed";

/** proposed_diff.meta.benefit_list — read by ProposalCard.tsx and by proposalSql.ts's pinsTouchedBy. */
export interface BenefitListMeta {
  field: "accepts_snap" | "accepts_wic";
  finding: ListFinding;
  entry?: { name: string; address: string; name_score: number; same_street: boolean; distance_m: number | null };
}

export interface BenefitListBuildParams {
  source: BenefitSource;
  entries: ListEntry[];
  /** Our active venues; only grocery, convenience and farm are compared. */
  venues: BenefitVenueRow[];
  runId: string;
  today: string;
  fetchedAt: string;
  /**
   * venue_id_aliases rows. Approving a "maybe" card records its list record
   * as that venue (meta.match, applyApprovedProposal), and that link then
   * counts as the same place: otherwise a name-only match approved once
   * would come back as "not on the list" the month after the tick is set.
   */
  aliases?: IdAliasRow[];
  /**
   * rejectionKey()s of this source's cards Kyle already approved or rejected.
   * A "not on the list" card he decided is left out here, and out of the
   * bad-download guardrail's count: otherwise a few stores permanently off a
   * small list (WIC trips at 5) would stop that list every month.
   */
  decidedKeys?: ReadonlySet<string>;
}

export interface BenefitListBuildResult {
  proposals: ProposalDraft[];
  /** Set when the list is missing too many of our ticked stores to be a real list: write nothing for this source. */
  aborted?: string;
  stats: { compared: number; listed: number; stillListed: number; maybe: number; notListed: number; notListedDecided: number };
  report: string[];
}

const entryAddress = (e: ListEntry) => `${e.street}, ${e.city}, CO ${e.zip}`;

export function buildBenefitListProposals(p: BenefitListBuildParams): BenefitListBuildResult {
  const field = FIELD[p.source];
  const pool = p.venues.filter((v) => MATCHABLE_CATEGORIES.has(v.category));
  const known = new Set((p.aliases ?? []).filter((a) => a.source === p.source).map((a) => `${a.upstream_id}->${a.venue_id}`));
  const scored = pool.map((v) => ({
    v,
    evs: p.entries.map((e) => ({ ...evidenceFor(e, v), known: known.has(`${e.upstreamId}->${v.id}`) })),
  }));
  // One list record belongs to one venue, decided before any card: among the
  // venues it strongly matches, an approved alias wins, then the venue at its
  // exact address; if that still leaves more than one, it is ambiguous and
  // only ever reaches review. Every other venue never sees the record, so a
  // chain's own record can't list, "maybe" or hide a same-name sibling
  // (Codex review of PR #939).
  const strongFor = new Map<string, { id: string; ev: Evidence }[]>();
  for (const { v, evs } of scored) {
    for (const ev of evs.filter(isStrong)) {
      if (!strongFor.has(ev.entry.upstreamId)) strongFor.set(ev.entry.upstreamId, []);
      strongFor.get(ev.entry.upstreamId)!.push({ id: v.id, ev });
    }
  }
  const owners = new Map<string, Set<string>>();
  for (const [upstreamId, claims] of strongFor) {
    const byAlias = claims.filter((c) => c.ev.known);
    const byAddress = claims.filter((c) => c.ev.same_street);
    owners.set(upstreamId, new Set((byAlias.length ? byAlias : byAddress.length ? byAddress : claims).map((c) => c.id)));
  }
  /** "own" = this venue alone owns it; "shared" = ambiguous, review only; "other" = another venue's; "free" = nobody's. */
  const ownership = (ev: Evidence, venueId: string): "own" | "shared" | "other" | "free" => {
    const o = owners.get(ev.entry.upstreamId);
    if (!o) return "free";
    if (!o.has(venueId)) return "other";
    return o.size === 1 ? "own" : "shared";
  };
  // The same for a record nobody owns but that sits right by two or more of
  // our venues (location evidence for each): it can't stand in for all of
  // them, so it never quietly stops a ticked venue's check.
  const nearBy = new Map<string, number>();
  for (const { v, evs } of scored) {
    for (const ev of evs) {
      if (ownership(ev, v.id) === "free" && hasLocationEvidence(ev)) nearBy.set(ev.entry.upstreamId, (nearBy.get(ev.entry.upstreamId) ?? 0) + 1);
    }
  }
  const contested = (ev: Evidence) => (nearBy.get(ev.entry.upstreamId) ?? 0) > 1;

  const proposals: ProposalDraft[] = [];
  const report: string[] = [];
  const stats = { compared: pool.length, listed: 0, stillListed: 0, maybe: 0, notListed: 0, notListedDecided: 0 };
  let mapYes = 0;

  const card = (v: BenefitVenueRow, meta: Record<string, unknown>, change: boolean, hashExtra?: Record<string, unknown>): ProposalDraft => {
    const before: Partial<Venue> = { last_verified: v.last_verified };
    const after: Partial<Venue> = { last_verified: p.today };
    const fieldsChanged = ["last_verified"];
    if (change) {
      // Column form (0/1/null), not Venue's boolean: approve's stale check
      // compares `before` to the stored row with valuesEqual, which
      // stringifies — `false` would never equal a stored 0.
      (before as Record<string, unknown>)[field] = v[field];
      (after as Record<string, unknown>)[field] = 1;
      fieldsChanged.unshift(field);
    }
    return {
      source: p.source,
      targetVenueId: v.id,
      changeType: "update",
      proposedDiff: { before, after, fields_changed: fieldsChanged, meta: { fetched_at: p.fetchedAt, ...meta } },
      diffHash: computeDiffHash(hashExtra ? ({ ...after, ...hashExtra } as Partial<Venue>) : after, fieldsChanged),
      runId: p.runId,
    };
  };
  const describe = (ev: Evidence): BenefitListMeta["entry"] => ({
    name: ev.entry.name,
    address: entryAddress(ev.entry),
    name_score: ev.name_score,
    same_street: ev.same_street,
    distance_m: ev.distance_m,
  });

  for (const { v, evs } of scored) {
    const ticked = v[field] === 1;
    if (ticked) mapYes++;
    const strong = evs.filter((ev) => isStrong(ev) && ownership(ev, v.id) === "own").sort((a, b) => b.name_score - a.name_score);
    if (strong.length > 0) {
      const benefit: BenefitListMeta = { field, finding: "listed", entry: describe(strong[0]) };
      if (ticked) {
        // Both agree: a "still listed" fetch, no card (proposalSql.ts's date-only lane).
        stats.stillListed++;
        if (v.last_verified !== p.today) proposals.push(card(v, { benefit_list: benefit }, false));
        continue;
      }
      stats.listed++;
      proposals.push(card(v, { benefit_list: benefit }, true));
      report.push(`  listed      ${v.id} "${v.name}" <- "${strong[0].entry.name}" ${entryAddress(strong[0].entry)} (map ${v[field] ?? "unknown"})`);
      continue;
    }
    const mine = evs.filter((ev) => {
      const o = ownership(ev, v.id);
      return o === "shared" || (o === "free" && isCandidate(ev, v.address));
    });
    mine.sort(
      (a, b) =>
        Number(hasLocationEvidence(b)) - Number(hasLocationEvidence(a)) ||
        b.name_score - a.name_score ||
        (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity),
    );
    const best = mine[0];
    if (ticked) {
      // Only a record that is this venue's alone may stand in for it silently.
      const exclusive = mine.find((ev) => ownership(ev, v.id) === "free" && hasLocationEvidence(ev) && !contested(ev));
      if (exclusive) {
        report.push(`  probably    ${v.id} "${v.name}" ~ "${exclusive.entry.name}" ${entryAddress(exclusive.entry)} (no card)`);
        continue;
      }
      const tied = mine.find((ev) => ownership(ev, v.id) === "shared" || (hasLocationEvidence(ev) && contested(ev)));
      if (tied) {
        // The map already says yes, so this card changes no field: it asks
        // whether the record is this place. Approving links them (meta.match,
        // so next month it is this venue's own); rejecting is remembered.
        stats.maybe++;
        const benefit: BenefitListMeta = { field, finding: "maybe_listed", entry: describe(tied) };
        proposals.push(
          card(v, { benefit_list: benefit, needs_review: [`this list record also looks like another of our places`], match: { upstream_id: tied.entry.upstreamId } }, false, {
            match: tied.entry.upstreamId,
            shared: field,
          }),
        );
        report.push(`  shared      ${v.id} "${v.name}" ? "${tied.entry.name}" ${entryAddress(tied.entry)} (map says yes; also near another of our places)`);
        continue;
      }
      const benefit: BenefitListMeta = { field, finding: "not_listed" };
      const check = card(v, { benefit_list: benefit, needs_review: [`not on the list`] }, false, { not_listed: field });
      if (p.decidedKeys?.has(rejectionKey(check.source, check.targetVenueId, check.diffHash))) {
        stats.notListedDecided++;
        report.push(`  not listed  ${v.id} "${v.name}" (already decided, no card)`);
        continue;
      }
      stats.notListed++;
      proposals.push(check);
      report.push(`  not listed  ${v.id} "${v.name}" ${v.address} (map says yes)`);
      continue;
    }
    if (best) {
      stats.maybe++;
      const benefit: BenefitListMeta = { field, finding: "maybe_listed", entry: describe(best) };
      // meta.match: approving records the record as this venue (an alias), read back above as `known`.
      proposals.push(
        card(v, { benefit_list: benefit, needs_review: [`not sure this is the same place`], match: { upstream_id: best.entry.upstreamId } }, true, {
          match: best.entry.upstreamId,
        }),
      );
      report.push(`  maybe       ${v.id} "${v.name}" ? "${best.entry.name}" ${entryAddress(best.entry)} (name ${best.name_score}, ${best.distance_m ?? "?"}m${best.same_street ? ", same street" : ""})`);
    }
  }

  // The abnormal-drop guardrail the weekly sources use: a valid but partial
  // list would otherwise turn into a pile of "please check" cards that
  // approval and rejection memory then silence for good.
  // Decided stores are out of both counts, so they neither trip it nor dilute it.
  const sanity = checkSanityGuardrail(stats.notListed, mapYes - stats.notListedDecided);
  if (sanity.anomaly) {
    return {
      proposals: [],
      aborted: `${stats.notListed} of ${mapYes} ticked store(s) are missing from the list (trip point ${sanity.thresholdCount}) — looks like a bad read`,
      stats,
      report,
    };
  }
  return { proposals, stats, report };
}

// ─── Running both lists ─────────────────────────────────────────────────────

/**
 * Reads each list and hands a good read to `onList`; a failed read (or any
 * unexpected throw while reading) stops only that list. The orchestrator's
 * per-list loop, here so the isolation is testable: refresh-ingest.ts runs
 * main() at import and can't be.
 */
export async function readEachList(
  lists: { source: BenefitSource; read: () => Promise<ListFetchResult> }[],
  onList: (source: BenefitSource, got: Extract<ListFetchResult, { ok: true }>) => { proposals: ProposalDraft[]; aborted?: string },
  out: { log: (m: string) => void; error: (m: string) => void },
): Promise<{ proposals: ProposalDraft[]; anyAborted: boolean }> {
  let proposals: ProposalDraft[] = [];
  let anyAborted = false;
  for (const { source, read } of lists) {
    let got: ListFetchResult;
    try {
      got = await read();
    } catch (err) {
      got = { ok: false, reason: `unexpected error: ${err instanceof Error ? err.message : String(err)}`, requests: 0 };
    }
    if (!got.ok) {
      anyAborted = true;
      out.error(`\n${source}: ABORTED after ${got.requests} request(s) (writes nothing for this source): ${got.reason}`);
      continue;
    }
    const built = onList(source, got);
    if (built.aborted) {
      anyAborted = true;
      out.error(`${source}: ABORTED (writes nothing for this source): ${built.aborted}`);
      continue;
    }
    proposals = proposals.concat(built.proposals);
  }
  return { proposals, anyAborted };
}
