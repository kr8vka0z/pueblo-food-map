/**
 * cfAnalytics.ts — server-only Cloudflare Web Analytics reader for the
 * admin Dashboard's Visitors section (#680). Cloudflare's GraphQL Analytics
 * API is the ONLY source of unique-visitor numbers in this app (Kyle,
 * 2026-09-26, issue #680 comment): PostHog runs in memory-only mode (#485,
 * AGENTS.md "PostHog") and counts every page load as a new visitor, so its
 * numbers must never appear here.
 *
 * WHY these exact query shapes — verified live against the real GraphQL
 * schema on 2026-09-26 via `__type` introspection
 * (https://api.cloudflare.com/client/v4/graphql) and one real 7-day pull,
 * not guessed from docs:
 *   - `rumPageloadEventsAdaptiveGroups`, grouped by `date`/`deviceType`/
 *     `refererHost`, gives `count` (page views) and `sum.visits` (new
 *     sessions — confirmed live: a same-site `refererHost` navigation's
 *     `sum.visits` is 0, only the first pageload of a session counts).
 *   - `rumWebVitalsEventsAdaptiveGroups` filtered to `deviceType: "mobile"`
 *     gives `quantiles.largestContentfulPaintP75` (already milliseconds).
 *     Cloudflare returns `-1` when a bucket has too few samples to report a
 *     percentile (confirmed live) — treated as "no data" here, never shown
 *     as a literal -1ms.
 *   - No dimension in this schema carries the request's query string (only
 *     `requestPath`/`refererPath`, neither includes `?...`), so the issue's
 *     "`?from=` gets its own referrer row for QR flyers" ask is NOT
 *     achievable from this API. Deferred — see the parent report.
 *
 * One GraphQL call per metric covers TWO periods at once (current + the
 * immediately preceding period of the same length) by widening the date
 * filter to 2x the period and splitting client-side (buildVisitorsAnalytics)
 * on the boundary date, instead of two separate queries.
 *
 * Cached ~1h per period, module-scope. ponytail: per-isolate only — resets
 * on a Worker cold start, which just means one cache miss, fine at this
 * traffic volume and well within the "loads in under 2s" budget since a
 * miss is one Cloudflare round trip. Upgrade path if this ever needs
 * cross-isolate consistency: a KV or D1-backed cache keyed the same way.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type DashboardPeriod = "7d" | "30d" | "90d";
export const DASHBOARD_PERIODS: readonly DashboardPeriod[] = ["7d", "30d", "90d"];
const PERIOD_DAYS: Record<DashboardPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Production site tag (issue #680's Plan) — the only site this dashboard ever reads, even from staging (staging has no RUM beacon of its own, #652). */
const SITE_TAG = "2e9e3476ebf0467ca1485c9a363d4c1d";
const HOST = "pueblofoodmap.com";
const CF_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
/** A hanging Cloudflare call must degrade to "unavailable", never hang the page past its own 2s budget. */
const FETCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface DailyVisitorsPoint {
  /** ISO date, YYYY-MM-DD (UTC — matches Cloudflare's own `date` dimension). */
  date: string;
  visits: number;
}

export interface ReferrerGroup {
  /** "Direct / bookmark" for an empty refererHost (typed URL, bookmark, or no referrer at all); the bare host otherwise. */
  label: string;
  visits: number;
}

export interface VisitorsAnalytics {
  visits: number;
  previousVisits: number;
  pageviews: number;
  previousPageviews: number;
  /** % of this period's page views served to a phone (0-100, one decimal), or null when there were zero page views to divide by. */
  phoneSharePct: number | null;
  /** Mobile p75 LCP in ms this period ("about" — RUM is sampled) — null when Cloudflare has too few samples, or the vitals call itself failed. */
  phoneLcpMs: number | null;
  /** This period only, oldest first, one point per day that had at least one visit. */
  dailyVisitors: DailyVisitorsPoint[];
  /** This period only, visits desc. */
  referrers: ReferrerGroup[];
}

interface RumPageloadRow {
  count: number;
  sum: { visits: number };
  dimensions: { date: string; deviceType: string; refererHost: string };
}

interface GraphQlResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

function dateOnly(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function graphqlFetch<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(CF_GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Cloudflare GraphQL responded ${res.status}`);
  const json = (await res.json()) as GraphQlResponse<T>;
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("Cloudflare GraphQL: empty response");
  return json.data;
}

/** siteTag/requestHost are fixed constants (never user input), inlined directly in the query text — only the date range and account vary per call. */
async function fetchPageloadRows(token: string, accountTag: string, since: string, until: string): Promise<RumPageloadRow[]> {
  const query = `
    query($accountTag: String!, $since: Date!, $until: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          rumPageloadEventsAdaptiveGroups(
            limit: 9990
            orderBy: [date_ASC]
            filter: { siteTag: "${SITE_TAG}", requestHost: "${HOST}", date_geq: $since, date_leq: $until }
          ) {
            count
            sum { visits }
            dimensions { date deviceType refererHost }
          }
        }
      }
    }
  `;
  const data = await graphqlFetch<{ viewer: { accounts: { rumPageloadEventsAdaptiveGroups: RumPageloadRow[] }[] } }>(
    token,
    query,
    { accountTag, since, until },
  );
  return data.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
}

async function fetchMobileLcpP75(token: string, accountTag: string, since: string, until: string): Promise<number | null> {
  const query = `
    query($accountTag: String!, $since: Date!, $until: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          rumWebVitalsEventsAdaptiveGroups(
            limit: 1
            filter: { siteTag: "${SITE_TAG}", requestHost: "${HOST}", date_geq: $since, date_leq: $until, deviceType: "mobile" }
          ) {
            quantiles { largestContentfulPaintP75 }
          }
        }
      }
    }
  `;
  const data = await graphqlFetch<{
    viewer: { accounts: { rumWebVitalsEventsAdaptiveGroups: { quantiles: { largestContentfulPaintP75: number } }[] }[] };
  }>(token, query, { accountTag, since, until });
  const p75 = data.viewer.accounts[0]?.rumWebVitalsEventsAdaptiveGroups[0]?.quantiles.largestContentfulPaintP75;
  // Cloudflare's own "too few samples" sentinel (confirmed live) — never rendered as a literal -1ms.
  if (p75 === undefined || p75 < 0) return null;
  return p75;
}

/**
 * Pure — no fetch, no Date.now() beyond the boundary string passed in — so
 * every branch (zero rows, an all-mobile period, a same-site-only referrer
 * mix) is directly testable against a fixture row list. Rows with
 * `dimensions.date >= currentStartDate` are "this period"; everything else
 * in the input is assumed to be the immediately preceding period (the
 * caller controls that by the date range it queries).
 */
export function buildVisitorsAnalytics(
  rows: readonly RumPageloadRow[],
  currentStartDate: string,
  phoneLcpMs: number | null,
): VisitorsAnalytics {
  let visits = 0;
  let previousVisits = 0;
  let pageviews = 0;
  let previousPageviews = 0;
  let mobilePageviews = 0;
  const dailyMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();

  for (const row of rows) {
    const rowVisits = row.sum?.visits ?? 0;
    const rowViews = row.count ?? 0;
    if (row.dimensions.date < currentStartDate) {
      previousVisits += rowVisits;
      previousPageviews += rowViews;
      continue;
    }
    visits += rowVisits;
    pageviews += rowViews;
    if (row.dimensions.deviceType === "mobile") mobilePageviews += rowViews;
    dailyMap.set(row.dimensions.date, (dailyMap.get(row.dimensions.date) ?? 0) + rowVisits);

    const label = row.dimensions.refererHost === "" ? "Direct / bookmark" : row.dimensions.refererHost;
    referrerMap.set(label, (referrerMap.get(label) ?? 0) + rowVisits);
  }

  const dailyVisitors: DailyVisitorsPoint[] = [...dailyMap.entries()]
    .map(([date, dayVisits]) => ({ date, visits: dayVisits }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const referrers: ReferrerGroup[] = [...referrerMap.entries()]
    .map(([label, refVisits]) => ({ label, visits: refVisits }))
    .filter((r) => r.visits > 0)
    .sort((a, b) => b.visits - a.visits);

  return {
    visits,
    previousVisits,
    pageviews,
    previousPageviews,
    phoneSharePct: pageviews === 0 ? null : Math.round((mobilePageviews / pageviews) * 1000) / 10,
    phoneLcpMs,
    dailyVisitors,
    referrers,
  };
}

const cache = new Map<DashboardPeriod, { expiresAt: number; data: VisitorsAnalytics }>();

/** Test-only escape hatch — vitest can't otherwise clear this module's private cache between period assertions. */
export function _clearVisitorsAnalyticsCacheForTests(): void {
  cache.clear();
}

/**
 * Returns null on ANY failure — missing token, missing account var, a
 * network error, a timeout, or a malformed Cloudflare response — which is
 * the page's own signal to render "Visitor numbers are unavailable right
 * now" and render everything else regardless (issue #680's "Done when").
 * Never throws.
 */
export async function loadVisitorsAnalytics(period: DashboardPeriod, now: Date = new Date()): Promise<VisitorsAnalytics | null> {
  const cached = cache.get(period);
  if (cached && cached.expiresAt > now.getTime()) return cached.data;

  const token = process.env.CF_ANALYTICS_API_TOKEN;
  if (!token) return null;

  let accountTag: string | undefined;
  try {
    // CF_ANALYTICS_ACCOUNT_ID is a plain wrangler `var`, not a secret — read
    // via the Cloudflare env binding, never process.env (AGENTS.md
    // "Runtime reads": OpenNext doesn't populate vars into process.env).
    const { env } = await getCloudflareContext({ async: true });
    accountTag = env.CF_ANALYTICS_ACCOUNT_ID;
  } catch {
    return null;
  }
  if (!accountTag) return null;

  const days = PERIOD_DAYS[period];
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const currentStartMs = todayUTC - days * MS_PER_DAY;
  const previousStartMs = currentStartMs - days * MS_PER_DAY;
  const currentStartStr = dateOnly(currentStartMs);
  const previousStartStr = dateOnly(previousStartMs);
  const todayStr = dateOnly(todayUTC);

  try {
    const [rows, phoneLcpMs] = await Promise.all([
      fetchPageloadRows(token, accountTag, previousStartStr, todayStr),
      fetchMobileLcpP75(token, accountTag, currentStartStr, todayStr),
    ]);
    const data = buildVisitorsAnalytics(rows, currentStartStr, phoneLcpMs);
    cache.set(period, { expiresAt: now.getTime() + CACHE_TTL_MS, data });
    return data;
  } catch {
    return null;
  }
}
