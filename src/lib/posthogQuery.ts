/**
 * posthogQuery.ts — server-only reader for the admin Dashboard's "What
 * people do on the map" section (#681), fed by PostHog's Query API
 * (HogQL) rather than PostHog's own UI. Mirrors cfAnalytics.ts's shape on
 * purpose (pure `build*` mappers over raw rows + one `load*` entry point
 * that returns `null` on ANY failure — missing secret, missing project id,
 * a network error, a malformed response — never throws): the Dashboard
 * treats a PostHog outage exactly like a Cloudflare outage, degrading only
 * this one section (issue's own "Done when": "If PostHog is unreachable or
 * the key is missing, only this section shows 'Usage numbers are
 * unavailable right now'").
 *
 * HARD RULE (issue #681, Kyle's 2026-09-26 comment): PostHog runs in
 * memory-only mode (#485/analytics.ts) — every page load is a brand-new
 * anonymous PostHog "person," so PostHog can never report a unique-visitor
 * count. Every number this file returns is therefore an EVENT count or a
 * SESSION count (uniq($session_id)), never a person/visitor count. Any
 * "% of visitors" the Dashboard needs (Switched to Spanish, Filters people
 * use) divides one of these event counts by Cloudflare's own visitor count
 * (cfAnalytics.ts) — that division happens in page.tsx, which is the one
 * place already holding both numbers, not here.
 *
 * WHY these exact query shapes — each was run live against the real
 * project (630731) on 2026-09-26, both against real (if sparse, pre-launch)
 * traffic and against synthetic events fired with `$host: "coder-test"`
 * (invisible to every query here, which all filter on the real HOST) to
 * prove property coercion, not just query syntax:
 *   - Every custom `track()` property (analytics.ts callers) lands as a
 *     BARE `properties.<name>` column — `venueId`, `filter`, `term`,
 *     `results`, `mode`, `to`, `result`, exactly as the call sites in
 *     MapWrapper.tsx/FilterPanel.tsx/etc. name them, NOT the issue text's
 *     `venue_id` (verified against the real call sites, not retyped from
 *     the issue — see this file's own report for the discrepancy).
 *   - A brand-new custom property has no declared type, so HogQL's `=`
 *     comparison against a boolean/number literal is unreliable until
 *     PostHog infers one; every boolean/number property this file reads
 *     (`on`, `results`) is compared via an explicit `toString(...)`/
 *     `toInt(...)` cast instead, confirmed against real ingested test data.
 *   - `utm_source`/`utm_campaign` land as bare `properties.<name>` on
 *     `$pageview` too (posthog-js's built-in campaign-params capture) —
 *     confirmed the same way. Grouped by `uniq($session_id)` ("sessions"),
 *     not `count()`, since a flyer scan is one session that may re-fire
 *     `$pageview` more than once (client-side navigation) and memory
 *     persistence means the utm params may not persist onto every one of
 *     that session's later pageviews — sessions is the honest unit here,
 *     and "sessions" per Kyle's rule ("counts are events or sessions,
 *     never unique visitors") is exactly what's labeled in the UI.
 *
 * WHY every query filters `properties.$host = HOST`: this project also
 * receives dev.pueblofoodmap.com and localhost traffic (confirmed live —
 * both host values are present in real ingested events), and cfAnalytics.ts
 * already scopes its own numbers to the same production host even when
 * rendered from staging (its own header: "the only site this dashboard
 * ever reads, even from staging"). Matching that keeps the two sections'
 * numbers about the same site, and it's what quietly excludes this file's
 * own `coder-test`-tagged verification events without needing a separate
 * cleanup step.
 *
 * WHY the headline block is ONE query covering both periods (`countIf`
 * twice against a doubled date range), same technique cfAnalytics.ts uses
 * for its own Visitors numbers — the issue's own Plan calls for "one query
 * per block," and a delta needs both periods' counts.
 */

import type { DashboardPeriod } from "@/lib/cfAnalytics";
import { EVENTS } from "@/lib/analytics";

const PERIOD_DAYS: Record<DashboardPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Same production host cfAnalytics.ts reads, even from staging — see this file's own header. */
const HOST = "pueblofoodmap.com";
const DEFAULT_API_HOST = "https://us.posthog.com";
/** A hanging PostHog call must degrade to "unavailable," never hang the page past its own budget — same posture and value as cfAnalytics.ts's own FETCH_TIMEOUT_MS. */
const FETCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Only terms searched at least this many times are shown — issue's own "only terms seen >= 3 times" (never a single visitor's one-off typo). */
const MIN_SEARCH_TERM_COUNT = 3;
const TOP_PLACES_LIMIT = 6;
const TOP_SEARCHES_LIMIT = 10;
const UTM_SOURCES_LIMIT = 10;

export interface MapUsageHeadline {
  nearMeTaps: number;
  previousNearMeTaps: number;
  searches: number;
  previousSearches: number;
  cardsOpened: number;
  previousCardsOpened: number;
  /** Count of `locale_switched` events with `to: "es"` — this period. */
  localeSwitchedToEs: number;
  previousLocaleSwitchedToEs: number;
}

export interface TopPlaceUsageRow {
  venueId: string;
  count: number;
}

export interface TopSearchRow {
  term: string;
  count: number;
  /** True when every one of this term's searches this period returned 0 results — the issue's "0 results" tag, signaling a real gap in the map's places rather than one unlucky search among several that found something. */
  zeroResults: boolean;
}

export interface CardActionCounts {
  directionsWalk: number;
  directionsBus: number;
  directionsDrive: number;
  call: number;
  website: number;
  /** `favorite_added` — the issue's "save." */
  save: number;
  share: number;
  report: number;
}

export interface FilterUsageRow {
  /** Raw `filter_toggled` key (e.g. "snap", "pantry") — page.tsx maps this to a display label, same split as boxStats.ts's need keys + the Dashboard's own NEED_LABELS. */
  filter: string;
  count: number;
}

export interface LocationPermissionCounts {
  granted: number;
  denied: number;
}

export interface UtmSourceRow {
  source: string;
  campaign: string | null;
  sessions: number;
}

export interface MapUsageAnalytics {
  headline: MapUsageHeadline;
  topPlaces: TopPlaceUsageRow[];
  topSearches: TopSearchRow[];
  cardActions: CardActionCounts;
  filters: FilterUsageRow[];
  location: LocationPermissionCounts;
  utmSources: UtmSourceRow[];
}

interface PostHogQueryResponse {
  results?: unknown[][];
  error?: unknown;
}

/** UTC "YYYY-MM-DD HH:mm:ss" — the literal shape confirmed live against HogQL's DateTime comparison (ClickHouse parses it directly; no quoting/format gotcha found). */
function toHogQlDateTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

interface PeriodBounds {
  since: string;
  previousSince: string;
  /** Exclusive upper bound (tomorrow 00:00 UTC) — unlike cfAnalytics.ts's inclusive `date_leq` (a DATE dimension), this file compares a `timestamp` DATETIME column, so an inclusive "today" bound would silently drop today's later events. */
  until: string;
}

function periodBounds(period: DashboardPeriod, now: Date): PeriodBounds {
  const days = PERIOD_DAYS[period];
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceMs = todayUTC - days * MS_PER_DAY;
  const previousSinceMs = sinceMs - days * MS_PER_DAY;
  const untilMs = todayUTC + MS_PER_DAY;
  return { since: toHogQlDateTime(sinceMs), previousSince: toHogQlDateTime(previousSinceMs), until: toHogQlDateTime(untilMs) };
}

async function runHogQlQuery(
  token: string,
  projectId: string,
  apiHost: string,
  query: string,
  values: Record<string, unknown>,
): Promise<unknown[][]> {
  const res = await fetch(`${apiHost}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query, values } }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`PostHog Query API responded ${res.status}`);
  const json = (await res.json()) as PostHogQueryResponse;
  if (json.error) throw new Error(typeof json.error === "string" ? json.error : "PostHog Query API returned an error");
  return json.results ?? [];
}

// ─── Pure mappers — each tolerates zero rows, never divides/throws on empty input ──────────

const HEADLINE_EVENTS = [EVENTS.NEAR_ME_CLICKED, EVENTS.SEARCH_USED, EVENTS.VENUE_OPENED, EVENTS.LOCALE_SWITCHED] as const;

/** Rows: [event, currentCount, previousCount]. `locale_switched`'s "to: es" split is queried separately (buildLocaleSwitchedCounts) since HogQL can't both group by event AND filter one event's own sub-property in a single GROUP BY event row. */
export function buildHeadline(
  eventRows: readonly unknown[][],
  localeEsCurrent: number,
  localeEsPrevious: number,
): MapUsageHeadline {
  const byEvent = new Map<string, { current: number; previous: number }>();
  for (const row of eventRows) {
    const [event, current, previous] = row as [string, number, number];
    byEvent.set(event, { current: current ?? 0, previous: previous ?? 0 });
  }
  const get = (name: string) => byEvent.get(name) ?? { current: 0, previous: 0 };
  return {
    nearMeTaps: get(EVENTS.NEAR_ME_CLICKED).current,
    previousNearMeTaps: get(EVENTS.NEAR_ME_CLICKED).previous,
    searches: get(EVENTS.SEARCH_USED).current,
    previousSearches: get(EVENTS.SEARCH_USED).previous,
    cardsOpened: get(EVENTS.VENUE_OPENED).current,
    previousCardsOpened: get(EVENTS.VENUE_OPENED).previous,
    localeSwitchedToEs: localeEsCurrent,
    previousLocaleSwitchedToEs: localeEsPrevious,
  };
}

/** Rows: [venueId, count]. A blank/null venueId (a malformed or pre-#485 event) is dropped rather than shown as a mystery "most opened place." */
export function buildTopPlaces(rows: readonly unknown[][]): TopPlaceUsageRow[] {
  return rows
    .map((row) => {
      const [venueId, count] = row as [string | null, number];
      return { venueId: venueId ?? "", count: count ?? 0 };
    })
    .filter((r) => r.venueId !== "");
}

/** Rows: [term, count, zeroCount]. Blank terms are dropped (sanitizeSearchTerm in analytics.ts never sends one, but an older client build might have). */
export function buildTopSearches(rows: readonly unknown[][]): TopSearchRow[] {
  return rows
    .map((row) => {
      const [term, count, zero] = row as [string | null, number, number];
      const n = count ?? 0;
      return { term: term ?? "", count: n, zeroResults: n > 0 && (zero ?? 0) === n };
    })
    .filter((r) => r.term !== "");
}

/** Rows: [event, mode, count] — `mode` is only set on `directions_clicked`, null for the rest. */
export function buildCardActions(rows: readonly unknown[][]): CardActionCounts {
  const counts: CardActionCounts = { directionsWalk: 0, directionsBus: 0, directionsDrive: 0, call: 0, website: 0, save: 0, share: 0, report: 0 };
  for (const row of rows) {
    const [event, mode, count] = row as [string, string | null, number];
    const n = count ?? 0;
    if (event === EVENTS.DIRECTIONS_CLICKED) {
      if (mode === "walk") counts.directionsWalk += n;
      else if (mode === "bus") counts.directionsBus += n;
      else if (mode === "drive") counts.directionsDrive += n;
    } else if (event === EVENTS.CALL_CLICKED) counts.call += n;
    else if (event === EVENTS.WEBSITE_CLICKED) counts.website += n;
    else if (event === EVENTS.FAVORITE_ADDED) counts.save += n;
    else if (event === EVENTS.SHARE_CLICKED) counts.share += n;
    else if (event === EVENTS.REPORT_OPENED) counts.report += n;
  }
  return counts;
}

/** Rows: [filter, count] — already scoped to `on = true` by the query (a person turning a filter OFF isn't "using" it). */
export function buildFilters(rows: readonly unknown[][]): FilterUsageRow[] {
  return rows
    .map((row) => {
      const [filter, count] = row as [string | null, number];
      return { filter: filter ?? "", count: count ?? 0 };
    })
    .filter((r) => r.filter !== "")
    .sort((a, b) => b.count - a.count);
}

/** Rows: [result, count] — `location_permission` only ever fires with `result: "granted" | "denied"` (useGeolocation.ts); any other value is ignored rather than guessed at. */
export function buildLocationPermission(rows: readonly unknown[][]): LocationPermissionCounts {
  let granted = 0;
  let denied = 0;
  for (const row of rows) {
    const [result, count] = row as [string, number];
    if (result === "granted") granted += count ?? 0;
    else if (result === "denied") denied += count ?? 0;
  }
  return { granted, denied };
}

/** Rows: [source, campaign, sessions]. */
export function buildUtmSources(rows: readonly unknown[][]): UtmSourceRow[] {
  return rows.map((row) => {
    const [source, campaign, sessions] = row as [string, string | null, number];
    return { source, campaign: campaign ?? null, sessions: sessions ?? 0 };
  });
}

// ─── Query strings — each verified live against the real project, see this file's header ──

const HEADLINE_QUERY = `
  SELECT event, countIf(timestamp >= {since}) AS current, countIf(timestamp < {since}) AS previous
  FROM events
  WHERE event IN {events} AND properties.$host = {host} AND timestamp >= {previousSince} AND timestamp < {until}
  GROUP BY event
`;

const LOCALE_ES_QUERY = `
  SELECT countIf(timestamp >= {since}) AS current, countIf(timestamp < {since}) AS previous
  FROM events
  WHERE event = {event} AND properties.to = 'es' AND properties.$host = {host} AND timestamp >= {previousSince} AND timestamp < {until}
`;

const TOP_PLACES_QUERY = `
  SELECT properties.venueId AS venueId, count() AS n
  FROM events
  WHERE event = {event} AND properties.$host = {host} AND timestamp >= {since} AND timestamp < {until}
  GROUP BY venueId
  ORDER BY n DESC
  LIMIT ${TOP_PLACES_LIMIT}
`;

const TOP_SEARCHES_QUERY = `
  SELECT properties.term AS term, count() AS n, countIf(toInt(properties.results) = 0) AS zero
  FROM events
  WHERE event = {event} AND properties.$host = {host} AND timestamp >= {since} AND timestamp < {until}
  GROUP BY term
  HAVING n >= ${MIN_SEARCH_TERM_COUNT}
  ORDER BY n DESC
  LIMIT ${TOP_SEARCHES_LIMIT}
`;

const CARD_ACTIONS_QUERY = `
  SELECT event, properties.mode AS mode, count() AS n
  FROM events
  WHERE event IN {events} AND properties.$host = {host} AND timestamp >= {since} AND timestamp < {until}
  GROUP BY event, mode
`;

const FILTERS_QUERY = `
  SELECT properties.filter AS filter, count() AS n
  FROM events
  WHERE event = {event} AND toString(properties.on) = 'true' AND properties.$host = {host} AND timestamp >= {since} AND timestamp < {until}
  GROUP BY filter
`;

const LOCATION_PERMISSION_QUERY = `
  SELECT properties.result AS result, count() AS n
  FROM events
  WHERE event = {event} AND properties.$host = {host} AND timestamp >= {since} AND timestamp < {until}
  GROUP BY result
`;

const UTM_SOURCES_QUERY = `
  SELECT properties.utm_source AS source, properties.utm_campaign AS campaign, uniq(properties.$session_id) AS sessions
  FROM events
  WHERE event = '$pageview' AND isNotNull(properties.utm_source) AND properties.$host = {host} AND timestamp >= {since} AND timestamp < {until}
  GROUP BY source, campaign
  ORDER BY sessions DESC
  LIMIT ${UTM_SOURCES_LIMIT}
`;

const CARD_ACTION_EVENTS = [
  EVENTS.DIRECTIONS_CLICKED,
  EVENTS.CALL_CLICKED,
  EVENTS.WEBSITE_CLICKED,
  EVENTS.FAVORITE_ADDED,
  EVENTS.SHARE_CLICKED,
  EVENTS.REPORT_OPENED,
] as const;

const cache = new Map<DashboardPeriod, { expiresAt: number; data: MapUsageAnalytics }>();

/** Test-only escape hatch — same reasoning as cfAnalytics.ts's own cache clearer. */
export function _clearMapUsageAnalyticsCacheForTests(): void {
  cache.clear();
}

/**
 * Returns null on ANY failure — missing secret, missing project id var, a
 * network error, a timeout, or a malformed PostHog response — the page's
 * signal to render "Usage numbers are unavailable right now" while every
 * other Dashboard section renders regardless (issue #681's "Done when").
 * Never throws. `projectId`/`apiHost` are passed in rather than read from
 * `getCloudflareContext()` here, so this function itself stays a plain,
 * fixture-testable async function — same split cfAnalytics.ts's own
 * loadVisitorsAnalytics() uses internally, made an explicit parameter here
 * since the caller (page.tsx) already reads the Cloudflare env binding for
 * the Visitors section right next to this one.
 */
export async function loadMapUsageAnalytics(
  period: DashboardPeriod,
  projectId: string | undefined,
  apiHost: string | undefined,
  now: Date = new Date(),
): Promise<MapUsageAnalytics | null> {
  const cached = cache.get(period);
  if (cached && cached.expiresAt > now.getTime()) return cached.data;

  const token = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!token || !projectId) return null;

  const host = apiHost || DEFAULT_API_HOST;
  const { since, previousSince, until } = periodBounds(period, now);
  const commonValues = { host: HOST, since, previousSince, until };

  try {
    const [headlineRows, localeEsRows, topPlaceRows, topSearchRows, cardActionRows, filterRows, locationRows, utmRows] = await Promise.all([
      runHogQlQuery(token, projectId, host, HEADLINE_QUERY, { ...commonValues, events: [...HEADLINE_EVENTS] }),
      runHogQlQuery(token, projectId, host, LOCALE_ES_QUERY, { ...commonValues, event: EVENTS.LOCALE_SWITCHED }),
      runHogQlQuery(token, projectId, host, TOP_PLACES_QUERY, { ...commonValues, event: EVENTS.VENUE_OPENED }),
      runHogQlQuery(token, projectId, host, TOP_SEARCHES_QUERY, { ...commonValues, event: EVENTS.SEARCH_USED }),
      runHogQlQuery(token, projectId, host, CARD_ACTIONS_QUERY, { ...commonValues, events: [...CARD_ACTION_EVENTS] }),
      runHogQlQuery(token, projectId, host, FILTERS_QUERY, { ...commonValues, event: EVENTS.FILTER_TOGGLED }),
      runHogQlQuery(token, projectId, host, LOCATION_PERMISSION_QUERY, { ...commonValues, event: EVENTS.LOCATION_PERMISSION }),
      runHogQlQuery(token, projectId, host, UTM_SOURCES_QUERY, commonValues),
    ]);

    const [localeEsCurrent, localeEsPrevious] = (localeEsRows[0] as [number, number] | undefined) ?? [0, 0];

    const data: MapUsageAnalytics = {
      headline: buildHeadline(headlineRows, localeEsCurrent ?? 0, localeEsPrevious ?? 0),
      topPlaces: buildTopPlaces(topPlaceRows),
      topSearches: buildTopSearches(topSearchRows),
      cardActions: buildCardActions(cardActionRows),
      filters: buildFilters(filterRows),
      location: buildLocationPermission(locationRows),
      utmSources: buildUtmSources(utmRows),
    };
    cache.set(period, { expiresAt: now.getTime() + CACHE_TTL_MS, data });
    return data;
  } catch {
    return null;
  }
}
