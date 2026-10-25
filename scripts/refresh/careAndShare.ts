/**
 * careAndShare.ts — the Care and Share Food Bank reader (Venue Data Rebuild
 * step 2; atlas-kb "PFM Venue Data Rebuild Plan 2026-10-25", "Sources").
 * Care and Share is the named authority for hours, address, phone and
 * website of the pantries and meal sites it partners with.
 *
 * Their public Find Food map (careandshare.org/findfood) runs on Vivery's
 * "AccessFood" widget, which reads open JSON endpoints at
 * api.accessfood.org (region 108, map 159; no login). Two pieces:
 *
 *   - fetchCareAndShare (the only I/O; `fetch` and `sleep` injected so the
 *     stop rules are testable without the network): pages LocationSearch
 *     until an empty page, then LocationSchedules for the Pueblo County
 *     locations. Kyle's rule: read slowly (one request every
 *     REQUEST_GAP_MS), and on ANY refusal, non-2xx, timeout or bad JSON stop
 *     the whole source for this run and return a failure — never retry, and
 *     never hand back a partial read, because a missing listing must never
 *     look like a closed venue.
 *   - buildCareAndShareProposals (pure): matches each location to one of
 *     our pantries/meal sites and diffs it into change_proposals drafts.
 *
 * Contact names, emails and phones on a listing are personal details Kyle
 * ruled out of storage: toCasLocation keeps an explicit allowlist of fields
 * at the parse boundary, so nothing downstream (proposals, the per-run
 * cache, logs) can ever see them.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DayKey, IrregularSchedule, Venue, WeeklyHours } from "@/types/venue";
import { PUEBLO_COUNTY_BBOX } from "@/data/pueblo-bbox";
import { slotToIsoTimes } from "@/lib/hours";
import {
  computeDiffHash,
  excludeBlessingBoxes,
  rejectionKey,
  type CurrentVenueRow,
  type ProposalDraft,
} from "./diffEngine";
import { haversineDistanceKm, normalizedPhoneTail, type IdAliasRow } from "./renamePairs";

export const CAS_SOURCE = "care_and_share" as const;
/** Kyle: "at most one request every ~3 seconds". A little over, to be safe. */
export const REQUEST_GAP_MS = 3500;
const REQUEST_TIMEOUT_MS = 30_000;
/** A run needing more pages than this is not a normal Pueblo-area read — treated as a failure. */
const MAX_PAGES = 40;
const SCHEDULE_BATCH = 20;

const API_BASE = "https://api.accessfood.org/api/MapInformation/";
// The widget sends these; a bare request is refused. Browser-like UA for the same reason.
const REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json",
  Origin: "https://careandshare.org",
  Referer: "https://careandshare.org/",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 (pueblofoodmap.com weekly refresh)",
};

// ─── Parsed shapes (allowlisted fields only) ───────────────────────────────

export interface CasLocation {
  locationId: number;
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  lat: number;
  lng: number;
}

export interface CasSchedule {
  locationId: number;
  /** 1 = Sunday … 7 = Saturday. */
  dayOfWeek: number;
  startTime: string; // "1900-01-01T10:00:00" — only the time part means anything
  endTime: string;
  weekDayDescr: string;
  startTimeDescr: string;
  endTimeDescr: string;
  notes: string;
  weeksOfMonth: string;
  daysOfMonth: string;
  contactForHoursMessage: string | null;
  everyOtherWeekInd: boolean;
}

/** Vivery sends the literal string "None" for some empty fields. */
function text(v: unknown): string {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s.toLowerCase() === "none" || s.toLowerCase() === "null" ? "" : s;
}

/** Builds a location from one raw LocationSearch entry, keeping ONLY the fields above (never contact*). Null when unusable. */
export function toCasLocation(raw: Record<string, unknown>): CasLocation | null {
  const locationId = raw.locationId;
  const lat = raw.latitude;
  const lng = raw.longitude;
  if (typeof locationId !== "number" || typeof lat !== "number" || typeof lng !== "number") return null;
  const name = text(raw.locationName);
  if (!name) return null;
  return {
    locationId,
    name,
    address1: text(raw.address1),
    address2: text(raw.address2),
    city: text(raw.city),
    state: text(raw.state),
    zip: text(raw.zipCode),
    phone: text(raw.phone),
    website: text(raw.website),
    lat,
    lng,
  };
}

function toCasSchedule(raw: Record<string, unknown>): CasSchedule | null {
  if (typeof raw.locationId !== "number" || typeof raw.dayOfWeek !== "number") return null;
  return {
    locationId: raw.locationId,
    dayOfWeek: raw.dayOfWeek,
    startTime: String(raw.startTime ?? ""),
    endTime: String(raw.endTime ?? ""),
    weekDayDescr: text(raw.weekDayDescr),
    startTimeDescr: text(raw.startTimeDescr),
    endTimeDescr: text(raw.endTimeDescr),
    notes: text(raw.notes),
    weeksOfMonth: text(raw.weeksOfMonth),
    daysOfMonth: text(raw.daysOfMonth),
    contactForHoursMessage: text(raw.contactForHoursMessage) || null,
    everyOtherWeekInd: raw.everyOtherWeekInd === true,
  };
}

// The real county outline (Census TIGER/Line, the same file
// scripts/ingest-osm-grocery.py filters OSM by). The bounding box alone let
// Penrose (Fremont County) through. One polygon, exterior ring only.
let countyRing: [number, number][] | null = null;
function countyOutline(): [number, number][] {
  if (!countyRing) {
    const geo = JSON.parse(readFileSync(join(__dirname, "..", "..", "public", "data", "pueblo-county-boundary.geojson"), "utf-8")) as {
      features: { geometry: { type: string; coordinates: [number, number][][] } }[];
    };
    countyRing = geo.features[0].geometry.coordinates[0];
  }
  return countyRing;
}

/** Ray casting over the county ring ([lng, lat] pairs), same algorithm as ingest-osm-grocery.py's point_in_polygon. */
export function inPuebloCounty(l: { lat: number; lng: number }): boolean {
  const ring = countyOutline();
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > l.lat !== yj > l.lat && l.lng < ((xj - xi) * (l.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Search from the county box's centre with a radius reaching its corners,
// then keep only what falls inside the box. Derived, not guessed: a fixed
// 30-mile radius from the city misses the county's east and south-west.
const [[BBOX_W, BBOX_S], [BBOX_E, BBOX_N]] = PUEBLO_COUNTY_BBOX;
const SEARCH_CENTER = { lat: (BBOX_S + BBOX_N) / 2, lng: (BBOX_W + BBOX_E) / 2 };
const SEARCH_RADIUS_MILES = Math.ceil(haversineDistanceKm(SEARCH_CENTER, { lat: BBOX_N, lng: BBOX_W }) / 1.609344) + 1;

function searchUrl(pageIndex: number): string {
  const q = new URLSearchParams({
    radius: String(SEARCH_RADIUS_MILES),
    lat: SEARCH_CENTER.lat.toFixed(4),
    lng: SEARCH_CENTER.lng.toFixed(4),
    dayAv: "",
    foodProgramAv: "",
    serviceTypeAv: "",
    foodOfferingAv: "",
    dietRestrictionAv: "",
    locationFeatureAv: "",
    languagesAv: "",
    serviceCategoriesAv: "",
    regionId: "108",
    regionMapId: "159",
    showOutOfNetwork: "0",
    page: String(pageIndex),
    includeLocationOperatingHours: "true",
    isMapV2: "true",
  });
  return `${API_BASE}LocationSearch?${q.toString()}`;
}

// ─── Fetching ───────────────────────────────────────────────────────────────

export interface CasFetchDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
  /** Directory for this run's cache of the (already contact-free) responses; omitted = no cache. Never inside the repo. */
  cacheDir?: string | null;
}

export type CasFetchResult =
  | { ok: true; locations: CasLocation[]; schedules: CasSchedule[]; requests: number; fetchedAt: string }
  | { ok: false; reason: string; requests: number };

class CasStop extends Error {}

/**
 * Reads Care and Share's Pueblo County listings. Returns ok:false on the
 * first problem of any kind — the caller then writes nothing from this
 * source this run (see this file's header).
 */
export async function fetchCareAndShare(deps: CasFetchDeps): Promise<CasFetchResult> {
  let requests = 0;
  const fetchedAt = new Date().toISOString();

  async function getJson(url: string): Promise<unknown> {
    if (requests > 0) await deps.sleep(REQUEST_GAP_MS);
    requests++;
    let res: Response;
    try {
      res = await deps.fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      throw new CasStop(`request ${requests} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) throw new CasStop(`request ${requests} returned HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new CasStop(`request ${requests} returned something that isn't JSON`);
    }
  }

  try {
    const all: CasLocation[] = [];
    for (let pageIndex = 0; ; pageIndex++) {
      if (pageIndex >= MAX_PAGES) throw new CasStop(`more than ${MAX_PAGES} pages — not a normal read`);
      const body = (await getJson(searchUrl(pageIndex))) as { item1?: unknown };
      if (!body || !Array.isArray(body.item1)) throw new CasStop(`page ${pageIndex} had no location list`);
      if (body.item1.length === 0) break;
      for (const raw of body.item1) {
        const l = raw && typeof raw === "object" ? toCasLocation(raw as Record<string, unknown>) : null;
        if (l) all.push(l);
      }
    }
    const seen = new Set<number>();
    const locations = all.filter((l) => inPuebloCounty(l) && !seen.has(l.locationId) && seen.add(l.locationId));
    if (locations.length === 0) throw new CasStop("zero Pueblo County locations — refusing to treat that as real");

    const schedules: CasSchedule[] = [];
    for (let i = 0; i < locations.length; i += SCHEDULE_BATCH) {
      const ids = locations.slice(i, i + SCHEDULE_BATCH).map((l) => l.locationId).join(",");
      const body = await getJson(`${API_BASE}LocationSchedules?LocationIds=${ids}`);
      if (!Array.isArray(body)) throw new CasStop("schedule response was not a list");
      for (const raw of body) {
        const s = raw && typeof raw === "object" ? toCasSchedule(raw as Record<string, unknown>) : null;
        if (s) schedules.push(s);
      }
    }

    if (deps.cacheDir) {
      writeFileSync(join(deps.cacheDir, "care-and-share-locations.json"), JSON.stringify(locations, null, 1));
      writeFileSync(join(deps.cacheDir, "care-and-share-schedules.json"), JSON.stringify(schedules, null, 1));
    }
    deps.log(`care_and_share: ${all.length} listed in the search area, ${locations.length} inside the Pueblo County outline, ${schedules.length} schedule row(s), ${requests} request(s)`);
    return { ok: true, locations, schedules, requests, fetchedAt };
  } catch (err) {
    if (err instanceof CasStop) return { ok: false, reason: err.message, requests };
    throw err;
  }
}

// ─── Schedule conversion ───────────────────────────────────────────────────

const DAY_BY_NUMBER: Record<number, DayKey> = { 1: "sun", 2: "mon", 3: "tue", 4: "wed", 5: "thu", 6: "fri", 7: "sat" };
const ORDINALS: Record<string, IrregularSchedule["ordinal"]> = { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, last: "last" };

export type ScheduleConversion =
  | { ok: true; hours_weekly: WeeklyHours; hours_irregular: IrregularSchedule[] }
  | { ok: false; reasons: string[] };

function clock(iso: string): string | null {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * Converts one location's schedule rows into our two hours shapes, or
 * refuses. Anything it can't express exactly — a free-text note ("And 4 to
 * 6"), every-other-week, weeksOfMonth, a daysOfMonth that isn't a plain
 * ordinal list, "call for hours" — makes the whole location unconvertible:
 * a half-right schedule is worse than none, and the caller sends the raw
 * text to a person instead.
 */
export function convertSchedules(rows: CasSchedule[]): ScheduleConversion {
  const reasons: string[] = [];
  const weekly: WeeklyHours = {};
  const irregular: IrregularSchedule[] = [];
  for (const r of rows) {
    const day = DAY_BY_NUMBER[r.dayOfWeek];
    const open = clock(r.startTime);
    const close = clock(r.endTime);
    if (!day || !open || !close || close <= open) {
      reasons.push(`unreadable day/time on ${r.weekDayDescr || r.dayOfWeek}`);
      continue;
    }
    if (r.notes) reasons.push(`note: "${r.notes}"`);
    if (r.everyOtherWeekInd) reasons.push("every other week");
    if (r.weeksOfMonth) reasons.push(`weeks of month: "${r.weeksOfMonth}"`);
    if (r.contactForHoursMessage) reasons.push(`"${r.contactForHoursMessage}"`);
    const slot = `${open}-${close}`;
    if (!r.daysOfMonth) {
      (weekly[day] ??= []).push(slot);
      continue;
    }
    const parts = r.daysOfMonth.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const ordinals = parts.map((p) => ORDINALS[p]);
    if (ordinals.length === 0 || ordinals.some((o) => o === undefined)) {
      reasons.push(`days of month: "${r.daysOfMonth}"`);
      continue;
    }
    for (const ordinal of ordinals) irregular.push({ recurrence: "monthly_ordinal", ordinal, weekday: day, slots: [slot] });
  }
  if (reasons.length > 0) return { ok: false, reasons };
  for (const d of Object.keys(weekly) as DayKey[]) weekly[d]!.sort();
  return { ok: true, hours_weekly: weekly, hours_irregular: irregular };
}

/** Human-readable schedule as Care and Share shows it — kept in proposal meta so Kyle sees the source's own words. */
export function scheduleText(rows: CasSchedule[]): string {
  return rows
    .map((r) => {
      const extras = [
        r.daysOfMonth && `days of month: ${r.daysOfMonth}`,
        r.weeksOfMonth && `weeks of month: ${r.weeksOfMonth}`,
        r.everyOtherWeekInd && "every other week",
        r.notes,
        r.contactForHoursMessage,
      ].filter(Boolean);
      return `${r.weekDayDescr} ${r.startTimeDescr}–${r.endTimeDescr}${extras.length ? ` (${extras.join("; ")})` : ""}`;
    })
    .join("\n");
}

// ─── Canonical comparison forms ────────────────────────────────────────────

function canonicalSlot(slot: string): string {
  const iso = slotToIsoTimes(slot);
  return iso ? `${iso.opens}-${iso.closes}` : slot;
}

function parseJson<T>(value: string | T | null | undefined): T | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * hours_weekly as JSON text with sorted days and 24h, sorted slots ("" when
 * empty). Stored data mixes "16:00-19:00" and "1:00 PM - 3:00 PM"; without
 * this every 12h-spelled venue would show a fake change.
 */
export function canonicalWeekly(value: string | WeeklyHours | null | undefined): string {
  const parsed = parseJson<WeeklyHours>(value);
  if (!parsed) return "";
  const out: Record<string, string[]> = {};
  for (const day of Object.keys(parsed).sort()) {
    const slots = (parsed[day as DayKey] ?? []).map(canonicalSlot).sort();
    if (slots.length > 0) out[day] = slots;
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : "";
}

/** hours_irregular as JSON text, same canonical rules (keys, slots, entries sorted). */
export function canonicalIrregular(value: string | IrregularSchedule[] | null | undefined): string {
  const parsed = parseJson<IrregularSchedule[]>(value);
  if (!Array.isArray(parsed) || parsed.length === 0) return "";
  const entries = parsed.map((entry) => {
    const record = entry as unknown as Record<string, unknown>;
    const stable: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] === undefined) continue;
      stable[key] = key === "slots" ? (record[key] as string[]).map(canonicalSlot).sort() : record[key];
    }
    return stable;
  });
  entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(entries);
}

const STREET_WORDS: Record<string, string> = {
  street: "st", avenue: "ave", av: "ave", boulevard: "blvd", road: "rd", drive: "dr", lane: "ln",
  court: "ct", place: "pl", highway: "hwy", parkway: "pkwy", circle: "cir", suite: "ste",
  west: "w", east: "e", north: "n", south: "s",
};

/** Street line only, lower-cased, punctuation dropped, common words abbreviated. */
export function streetKey(address: string): string {
  const street = address.split(",")[0] ?? "";
  return street
    .toLowerCase()
    .replace(/#/g, " ste ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => STREET_WORDS[w] ?? w)
    .join(" ");
}

function casAddress(l: CasLocation): string {
  const street = [l.address1, l.address2].filter(Boolean).join(" ");
  return `${street}, ${l.city}, ${l.state} ${l.zip}`.replace(/\s+/g, " ").trim();
}

function urlKey(url: string | null | undefined): string {
  return (url ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

// ─── Matching ───────────────────────────────────────────────────────────────

/** Strong = all three of: name overlap at or over this, within STRONG_DISTANCE_M, and the same phone. */
export const STRONG_NAME_SCORE = 0.75;
export const STRONG_DISTANCE_M = 150;
/** Anything this close — or a strong-enough name within CANDIDATE_NAME_DISTANCE_M, or the same phone — is worth asking about. */
const CANDIDATE_NAME_DISTANCE_M = 2000;

const NAME_STOPWORDS = new Set(["the", "of", "inc", "and", "a", "at", "llc"]);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !NAME_STOPWORDS.has(w)),
  );
}

/** Shared words over the shorter name's word count — "Praise Assembly of God" vs "…- Food Pantry" scores 1. */
export function nameScore(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

interface Evidence {
  distance_m: number;
  name_score: number;
  same_phone: boolean;
}

function evidenceFor(l: CasLocation, v: CurrentVenueRow): Evidence {
  const phone = normalizedPhoneTail(l.phone);
  return {
    distance_m: Math.round(haversineDistanceKm(l, v) * 1000),
    name_score: Math.round(nameScore(l.name, v.name) * 100) / 100,
    same_phone: phone !== null && phone === normalizedPhoneTail(v.phone),
  };
}

/**
 * Strong = name, distance and phone agree. One relaxation (coordinator,
 * 2026-10-25, after the first dry run found 11 of 12 Care and Share
 * listings carry no phone): when THEIR listing has no phone at all, an
 * identical name (score 1.0) within STRONG_DISTANCE_M also counts — unless
 * our venue's address is a venue_direct pin, where the venue's own word
 * outranks a name-and-place guess. A listing whose phone differs from ours
 * is never strong.
 */
function isStrong(e: Evidence, casHasPhone: boolean, addressPinned: boolean): boolean {
  if (e.distance_m > STRONG_DISTANCE_M) return false;
  if (e.same_phone) return e.name_score >= STRONG_NAME_SCORE;
  return !casHasPhone && !addressPinned && e.name_score === 1;
}

function isCandidate(e: Evidence): boolean {
  return (
    e.distance_m <= STRONG_DISTANCE_M ||
    (e.name_score >= STRONG_NAME_SCORE && e.distance_m <= CANDIDATE_NAME_DISTANCE_M) ||
    e.same_phone
  );
}

export function upstreamIdOf(l: CasLocation): string {
  return `cas-${l.locationId}`;
}

// ─── Proposals ──────────────────────────────────────────────────────────────

export interface CareAndShareBuildParams {
  locations: CasLocation[];
  schedules: CasSchedule[];
  /** Our active venues (any source_type). Only pantries and meal sites are considered; blessing boxes are stripped here. */
  venues: CurrentVenueRow[];
  aliases: IdAliasRow[];
  runId: string;
  today: string;
  fetchedAt: string;
  /** Our venues whose address is a venue_direct pin — never matched by the no-phone rule (see isStrong). */
  addressPinnedVenueIds?: ReadonlySet<string>;
}

export interface CareAndShareBuildResult {
  proposals: ProposalDraft[];
  /** Strong fuzzy matches to record in venue_id_aliases this run (source care_and_share). */
  aliasWrites: { upstreamId: string; venueId: string }[];
  stats: { strong: number; ambiguous: number; duplicates: number; adds: number; unconvertible: number };
  /** One line per finding, for the run log. Never contact details (there are none to print). */
  report: string[];
}

const MATCHABLE_CATEGORIES = new Set(["pantry", "meal_site"]);
const SWITCH_FIELDS_FOR_CAS = ["address", "phone", "url", "hours_weekly", "hours_irregular"] as const;

/**
 * Matches every location, then diffs. Order of matching: an alias on file,
 * then our venue whose id IS the upstream id (an approved add), then the
 * fuzzy check. A venue claimed by two listings goes to review as a whole,
 * never diffed against either. Our venues Care and Share doesn't list get
 * nothing: being missing from one source is not a closure.
 */
export function buildCareAndShareProposals(params: CareAndShareBuildParams): CareAndShareBuildResult {
  const { today, runId, fetchedAt } = params;
  const stripped = excludeBlessingBoxes(params.venues, []);
  const boxIds = new Set(params.venues.filter((v) => v.category === "blessing_box").map((v) => v.id));
  const pool = stripped.currentRows.filter((v) => MATCHABLE_CATEGORIES.has(v.category));
  const byId = new Map(pool.map((v) => [v.id, v]));
  const aliasMap = new Map(params.aliases.filter((a) => a.source === CAS_SOURCE).map((a) => [a.upstream_id, a.venue_id]));
  const schedulesById = new Map<number, CasSchedule[]>();
  for (const s of params.schedules) (schedulesById.get(s.locationId) ?? schedulesById.set(s.locationId, []).get(s.locationId)!).push(s);

  type Claim = { loc: CasLocation; venue: CurrentVenueRow; kind: "known" | "strong" | "ambiguous"; evidence?: Evidence };
  const claims: Claim[] = [];
  const unmatched: CasLocation[] = [];

  for (const loc of params.locations) {
    const up = upstreamIdOf(loc);
    const known = byId.get(aliasMap.get(up) ?? "") ?? byId.get(up);
    if (known) {
      claims.push({ loc, venue: known, kind: "known" });
      continue;
    }
    const scored = pool.map((venue) => ({ venue, evidence: evidenceFor(loc, venue) })).filter((c) => isCandidate(c.evidence));
    if (scored.length === 0) {
      unmatched.push(loc);
      continue;
    }
    const casHasPhone = normalizedPhoneTail(loc.phone) !== null;
    const strong = scored.filter((c) => isStrong(c.evidence, casHasPhone, params.addressPinnedVenueIds?.has(c.venue.id) ?? false));
    if (strong.length === 1) {
      claims.push({ loc, venue: strong[0].venue, kind: "strong", evidence: strong[0].evidence });
      continue;
    }
    scored.sort((a, b) => b.evidence.name_score - a.evidence.name_score || a.evidence.distance_m - b.evidence.distance_m);
    claims.push({ loc, venue: scored[0].venue, kind: "ambiguous", evidence: scored[0].evidence });
  }

  const claimsByVenue = new Map<string, Claim[]>();
  for (const c of claims) (claimsByVenue.get(c.venue.id) ?? claimsByVenue.set(c.venue.id, []).get(c.venue.id)!).push(c);

  const proposals: ProposalDraft[] = [];
  const aliasWrites: CareAndShareBuildResult["aliasWrites"] = [];
  const stats = { strong: 0, ambiguous: 0, duplicates: 0, adds: 0, unconvertible: 0 };
  const report: string[] = [];

  for (const [venueId, group] of claimsByVenue) {
    const current = group[0].venue;
    const sortedGroup = [...group].sort((a, b) => a.loc.locationId - b.loc.locationId);
    let alsoListedAs: number[] | undefined;
    if (group.length > 1 && group.every((c) => c.kind === "known")) {
      // Kyle already confirmed every listing as this venue (Care and Share
      // lists Lynn Gardens twice): read them as one, against the lowest id.
      alsoListedAs = sortedGroup.slice(1).map((c) => c.loc.locationId);
    } else if (group.length > 1) {
      // Several listings look like one place: which is right is a person's
      // call, so no field is diffed. meta.match carries every unconfirmed
      // listing id, and approving records them all as this venue, so the
      // card converges (next run they are all "known") instead of returning.
      stats.duplicates++;
      const ids = sortedGroup.map((c) => c.loc.locationId);
      const unconfirmed = sortedGroup.filter((c) => c.kind !== "known");
      const meta = {
        locationIds: ids,
        fetched_at: fetchedAt,
        match: {
          upstream_ids: unconfirmed.map((c) => upstreamIdOf(c.loc)),
          listings: sortedGroup.map((c) => ({ upstream_id: upstreamIdOf(c.loc), name: c.loc.name, address: casAddress(c.loc), ...c.evidence })),
        },
        schedule_text: sortedGroup.map((c) => `${c.loc.name}: ${scheduleText(schedulesById.get(c.loc.locationId) ?? []) || "(no hours listed)"}`).join("\n"),
      };
      proposals.push(dateOnlyShaped(current, today, runId, meta, { duplicates: ids }));
      report.push(`  duplicate listings ${ids.join(", ")} -> ${venueId} (review)`);
      continue;
    }
    const claim = sortedGroup[0];
    if (claim.kind === "ambiguous") stats.ambiguous++;
    else stats.strong++;
    if (claim.kind === "strong") aliasWrites.push({ upstreamId: upstreamIdOf(claim.loc), venueId });

    // A venue listed more than once (all already confirmed) has its hours
    // spread across the listings: read every listing's rows, not just the
    // lowest id's.
    const rows = sortedGroup.flatMap((c) => schedulesById.get(c.loc.locationId) ?? []);
    const diff = diffLocation(claim.loc, rows, current, today, fetchedAt);
    if (diff.unconvertible) stats.unconvertible++;
    const meta: Record<string, unknown> = { ...diff.meta, ...(alsoListedAs ? { also_listed_as: alsoListedAs } : {}) };
    // First run of a self-made link: marked (meta isn't hashed) so the
    // switch never applies this proposal unattended, the card says "new
    // link", and rejecting it deletes the alias (migration 0024's trigger).
    if (claim.kind === "strong") meta.new_alias = { upstream_id: upstreamIdOf(claim.loc), name: claim.loc.name, ...claim.evidence };
    let hashExtra: Record<string, unknown> | undefined;
    if (claim.kind === "ambiguous") {
      meta.match = { upstream_id: upstreamIdOf(claim.loc), name: claim.loc.name, ...claim.evidence };
      hashExtra = { match: upstreamIdOf(claim.loc) };
    }
    if (diff.unconvertible) hashExtra = { ...hashExtra, schedule: meta.schedule_text };

    const changed = Object.keys(diff.after);
    report.push(
      `  ${claim.kind.padEnd(9)} ${claim.loc.locationId} "${claim.loc.name}" -> ${venueId}` +
        (claim.evidence ? ` (${claim.evidence.distance_m}m, name ${claim.evidence.name_score}, phone ${claim.evidence.same_phone ? "same" : "no"})` : "") +
        (changed.length ? ` changes: ${changed.join(", ")}` : "") +
        (diff.unconvertible ? " [schedule needs review]" : ""),
    );

    if (changed.length === 0) {
      // "Still listed, nothing changed" — unless something still needs a person.
      if (!meta.match && !diff.unconvertible && current.last_verified === today) continue;
      proposals.push(dateOnlyShaped(current, today, runId, meta, hashExtra));
      continue;
    }
    const before: Partial<Venue> = { last_verified: current.last_verified };
    const after: Partial<Venue> = { last_verified: today };
    for (const f of changed) {
      (before as Record<string, unknown>)[f] = diff.before[f];
      (after as Record<string, unknown>)[f] = diff.after[f];
    }
    const fieldsChanged = [...changed, "last_verified"];
    proposals.push({
      source: CAS_SOURCE,
      targetVenueId: venueId,
      changeType: "update",
      proposedDiff: { before, after, fields_changed: fieldsChanged, meta },
      diffHash: computeDiffHash(hashExtra ? ({ ...after, ...hashExtra } as Partial<Venue>) : after, fieldsChanged),
      runId,
    });
  }

  for (const loc of unmatched) {
    const id = upstreamIdOf(loc);
    if (boxIds.has(id)) continue;
    stats.adds++;
    const rows = schedulesById.get(loc.locationId) ?? [];
    const conv = rows.length > 0 ? convertSchedules(rows) : null;
    if (conv && !conv.ok) stats.unconvertible++;
    const after: Partial<Venue> = {
      id,
      name: loc.name,
      category: /soup kitchen|meal|kitchen|caf[eé]/i.test(loc.name) ? "meal_site" : "pantry",
      lat: loc.lat,
      lng: loc.lng,
      address: casAddress(loc),
      ...(normalizedPhoneTail(loc.phone) ? { phone: loc.phone } : {}),
      ...(loc.website ? { url: loc.website } : {}),
      ...(conv?.ok && Object.keys(conv.hours_weekly).length > 0 ? { hours_weekly: conv.hours_weekly } : {}),
      ...(conv?.ok && conv.hours_irregular.length > 0 ? { hours_irregular: conv.hours_irregular } : {}),
      source: "careandshare.org/findfood",
      last_verified: today,
    };
    const meta: Record<string, unknown> = { locationId: loc.locationId, fetched_at: fetchedAt, schedule_text: scheduleText(rows) };
    if (conv && !conv.ok) meta.needs_review = conv.reasons;
    const fieldsChanged = Object.keys(after);
    proposals.push({
      source: CAS_SOURCE,
      targetVenueId: id,
      changeType: "add",
      proposedDiff: { before: null, after, fields_changed: fieldsChanged, meta },
      diffHash: computeDiffHash(after, fieldsChanged),
      runId,
    });
    report.push(`  add       ${loc.locationId} "${loc.name}" (${casAddress(loc)})${conv && !conv.ok ? " [schedule needs review]" : ""}`);
  }

  return { proposals, aliasWrites, stats, report };
}

/**
 * Drops a review-only card (no field change; meta.needs_review or
 * meta.match) whose exact content Kyle already approved — `approvedKeys`
 * holds (source, target, diff_hash) of human-approved care_and_share rows.
 * Without this, approving "their schedule says 'And 4 to 6'" would bring
 * the same card back every Monday, since approval of a review-only card
 * changes nothing the next diff can see. The hash includes the schedule
 * text, so a new schedule still comes back. Real field changes are never
 * dropped here (an approved change no longer differs next week anyway).
 */
export function dropAlreadyReviewed(proposals: ProposalDraft[], approvedKeys: ReadonlySet<string>): ProposalDraft[] {
  return proposals.filter((p) => {
    const reviewOnly =
      p.changeType === "update" &&
      p.proposedDiff.fields_changed.every((f) => f === "last_verified") &&
      (p.proposedDiff.meta?.needs_review || p.proposedDiff.meta?.match);
    return !(reviewOnly && approvedKeys.has(rejectionKey(p.source, p.targetVenueId, p.diffHash)));
  });
}

/** A proposal with no field change: date-only when meta is plain, a review card when meta carries match/needs_review. */
function dateOnlyShaped(
  current: CurrentVenueRow,
  today: string,
  runId: string,
  meta: Record<string, unknown>,
  hashExtra?: Record<string, unknown>,
): ProposalDraft {
  const after: Partial<Venue> = { last_verified: today };
  return {
    source: CAS_SOURCE,
    targetVenueId: current.id,
    changeType: "update",
    proposedDiff: { before: { last_verified: current.last_verified }, after, fields_changed: ["last_verified"], meta },
    diffHash: computeDiffHash(hashExtra ? ({ ...after, ...hashExtra } as Partial<Venue>) : after, ["last_verified"]),
    runId,
  };
}

interface LocationDiff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  meta: Record<string, unknown>;
  unconvertible: boolean;
}

/**
 * The four things Care and Share owns, compared in canonical form. Empty on
 * their side never proposes clearing ours (a blank field on a listing isn't
 * a statement that the venue has no phone).
 */
function diffLocation(loc: CasLocation, rows: CasSchedule[], current: CurrentVenueRow, today: string, fetchedAt: string): LocationDiff {
  void today;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const meta: Record<string, unknown> = { locationId: loc.locationId, fetched_at: fetchedAt };
  let unconvertible = false;

  if (loc.address1 && streetKey(casAddress(loc)) !== streetKey(current.address)) {
    before.address = current.address;
    after.address = casAddress(loc);
  }
  const phoneTail = normalizedPhoneTail(loc.phone);
  if (phoneTail && phoneTail !== normalizedPhoneTail(current.phone)) {
    before.phone = current.phone;
    after.phone = loc.phone;
  }
  if (loc.website && urlKey(loc.website) !== urlKey(current.url)) {
    before.url = current.url;
    after.url = loc.website;
  }
  if (rows.length > 0) {
    meta.schedule_text = scheduleText(rows);
    const conv = convertSchedules(rows);
    if (!conv.ok) {
      unconvertible = true;
      meta.needs_review = conv.reasons;
    } else {
      const weekly = canonicalWeekly(conv.hours_weekly);
      const irregular = canonicalIrregular(conv.hours_irregular);
      const curWeekly = canonicalWeekly(current.hours_weekly);
      const curIrregular = canonicalIrregular(current.hours_irregular);
      if (weekly !== curWeekly) {
        before.hours_weekly = curWeekly;
        after.hours_weekly = weekly;
      }
      if (irregular !== curIrregular) {
        before.hours_irregular = curIrregular;
        after.hours_irregular = irregular;
      }
    }
  }
  // Order the keys the way the switch reads them, so diff_hash is stable run to run.
  const ordered = (o: Record<string, unknown>) =>
    Object.fromEntries(SWITCH_FIELDS_FOR_CAS.filter((f) => f in o).map((f) => [f, o[f]]));
  return { before: ordered(before), after: ordered(after), meta, unconvertible };
}
