/**
 * /admin — the Dashboard. Overhauled for #680 ("Admin Dashboard overhaul:
 * needs-you strip, visitors (Cloudflare), blessing box numbers, map data
 * health"): replaces the earlier "to-do list first" build's
 * NeedsDecisionPanel / "Boxes that need help" / "Places due for a check"
 * blocks (issue #680's own Layout item 2: "This replaces today's
 * NeedsDecisionPanel / needs-help list / stale list blocks") with a
 * greeting + 7/30/90-day period switch, a 4-card "Needs you" strip, a
 * Cloudflare Web Analytics Visitors section, a Blessing Boxes numbers
 * section (reusing src/lib/boxStats.ts, the SAME math the public Boxes page
 * uses), and a Map data health section. The Publish bar and the
 * publish-bot status banner are UNCHANGED (#680: "The Publish panel and the
 * publish-bot status banner stay").
 *
 * Same Better Auth chain as every other admin page (AGENTS.md "Admin
 * authentication"): getAdminDb() verifies identity before this page renders
 * anything, failing closed via handlePageAuthError.
 *
 * PERIOD SWITCH: a plain `?period=7d|30d|90d` search param, server-rendered
 * `<Link>`s (no client JS) — the whole page re-renders per period the same
 * way any other admin filter link already does in this app. Defaults to
 * 30d; an unrecognized value falls back to 30d rather than erroring, same
 * "never trust a query param" posture every other admin route takes.
 * "Every number that has a time range... shows the change vs the previous
 * period of the same length" (#680) — src/lib/boxStats.ts's
 * filterByPeriod/filterByPreviousPeriod do that D1-side split; cfAnalytics's
 * loadVisitorsAnalytics does the equivalent for Cloudflare's numbers.
 *
 * VISITORS DEGRADES INDEPENDENTLY: loadVisitorsAnalytics() never throws —
 * missing token, missing account var, a Cloudflare outage, or a timeout all
 * return null, which this page renders as "Visitor numbers are unavailable
 * right now" while every other section renders normally (#680's "Done
 * when"). It is NOT inside the same try/catch as the D1 reads below,
 * deliberately: a Cloudflare hiccup must never fail the whole page closed.
 *
 * BoxHealthEntry is read here ONLY for its `health` status (rankNeedsHelp's
 * count) — this page never renders a sponsor name itself, so it never
 * touches the `sponsors: string[]` field #671/#678 introduced.
 *
 * STAGING: same "never mislead with test-only D1 data" posture #673 gave
 * /admin/places — isProductionWorker() gates the Publish bar exactly like
 * that page (staging can never actually Publish), so the Dashboard would
 * otherwise show a live "waiting to publish" count that can never be
 * cleared. The rest of the Dashboard (Visitors, Blessing boxes, Map data
 * health) still renders on staging; only the Publish bar itself is swapped
 * for the same "Test site" banner.
 */

import Link from "next/link";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { summarizePublishChanges } from "@/lib/adminVenues";
import { rankNeedsHelp } from "@/lib/boxHealth";
import { loadBoxHealthEntries } from "@/lib/adminBoxes";
import { selectStalePlaces, resolvePlaceUsageRows } from "@/lib/adminDashboard";
import { loadReviewQueue, type AdminBoxPhotoRow } from "@/lib/boxPhotos";
import { loadPendingAdopters, type AdminBoxAdopterRow } from "@/lib/boxAdopters";
import { fetchPublishBotPrStatus, isProductionWorker, type PublishBotPrStatus } from "@/lib/publishVenues";
import {
  filterByPeriod,
  filterByPreviousPeriod,
  computeCheckinCounts,
  computeNetworkPairAverages,
  computeNetworkOverview,
  computeMilestones,
  formatDurationMs,
  rankLongestSinceLastFill,
  loadNetworkStatsData,
  loadNetworkNeedRows,
  rankNetworkMostNeeded,
  loadProblemReports,
  computeProblemReportCounts,
  groupCheckinsByVenue,
  periodStartMs,
} from "@/lib/boxStats";
import { loadVisitorsAnalytics, DASHBOARD_PERIODS, type DashboardPeriod } from "@/lib/cfAnalytics";
import { loadMapUsageAnalytics } from "@/lib/posthogQuery";
import type { AdminNavCounts } from "@/lib/adminNavCounts";
import type { AdminVenueRow } from "@/types/venue";
import AdminNav from "@/components/AdminNav";
import PublishPanel from "@/components/PublishPanel";
import PublishBotStatusBanner from "@/components/PublishBotStatusBanner";
import DashboardNeedsStrip, { type NeedsCardData } from "@/components/DashboardNeedsStrip";
import KpiCard from "@/components/KpiCard";
import BarList from "@/components/BarList";
import DailyBars from "@/components/DailyBars";

const DEFAULT_PERIOD: DashboardPeriod = "30d";
const PERIOD_LABELS: Record<DashboardPeriod, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };
/** Community label per box_checkins.needs key (migration 0012) — same nine keys as the public "what would help you next time?" ask; kept here rather than importing a component-facing label map since only these lowercase keys need a Dashboard-facing display string. */
const NEED_LABELS: Record<string, string> = {
  canned_food: "Canned food",
  fresh_food: "Fresh food",
  bread: "Bread",
  baby_items: "Baby items",
  diapers: "Diapers",
  hygiene: "Hygiene items",
  pet_food: "Pet food",
  drinks: "Drinks",
  warm_clothing: "Warm clothing",
};

function parsePeriod(raw: string | undefined): DashboardPeriod {
  return (DASHBOARD_PERIODS as readonly string[]).includes(raw ?? "") ? (raw as DashboardPeriod) : DEFAULT_PERIOD;
}

/** Google's own "good" LCP threshold — issue #680's "with Google's 2.5s 'good' line". */
const LCP_GOOD_MS = 2500;

/** Acronym filter keys FilterPanel.tsx sends that Title Case would mangle ("Snap", "Wic") — every other filter key (a VenueCategory, or "open_now") reads fine through the generic fallback below it. */
const FILTER_ACRONYM_LABELS: Record<string, string> = { snap: "SNAP", wic: "WIC" };

/** "open_now" -> "Open Now", "meal_site" -> "Meal Site" — a generic fallback rather than an exhaustive VenueCategory map, so a future category needs no Dashboard-side update to show up here. */
function filterLabel(key: string): string {
  return FILTER_ACRONYM_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** `null` when the denominator is 0 or unavailable — rendered as "—", never a divide-by-zero NaN. Rounded to a whole percent; these are share-of-an-event-count numbers, not precise measurements. */
function pctOf(count: number, total: number | null | undefined): number | null {
  if (!total) return null;
  return Math.round((count / total) * 100);
}

function formatPct(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: rawPeriod } = await searchParams;
  const period: DashboardPeriod = parsePeriod(rawPeriod);
  const now = new Date();

  let email: string;
  let showActivity = false;
  let venues: AdminVenueRow[];
  let submissionsTotal: number;
  let proposalsTotal: number;
  let photos: AdminBoxPhotoRow[];
  let adopters: AdminBoxAdopterRow[];
  let boxHealthEntries: Awaited<ReturnType<typeof loadBoxHealthEntries>>;
  let publishBotStatus: PublishBotPrStatus | null;
  let networkStats: Awaited<ReturnType<typeof loadNetworkStatsData>>;
  let needRows: Awaited<ReturnType<typeof loadNetworkNeedRows>>;
  let problemReportRows: Awaited<ReturnType<typeof loadProblemReports>>;
  let latestRefresh: { runId: string; createdAt: string; suggestedCount: number } | null;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;

    const publishToken = process.env.GITHUB_PUBLISH_TOKEN;
    const periodStart = periodStartMs(period, now);
    const cutoffIso = periodStart === null ? new Date(0).toISOString() : new Date(periodStart).toISOString();

    const [
      venuesResult,
      submissionsTotalRow,
      proposalsTotalRow,
      photosAll,
      adoptersAll,
      boxHealth,
      publishBotStatusResult,
      networkStatsResult,
      needRowsResult,
      problemReportsResult,
      latestRefreshRow,
    ] = await Promise.all([
      db.prepare("SELECT * FROM venues ORDER BY name COLLATE NOCASE ASC").all<AdminVenueRow>(),
      db.prepare("SELECT COUNT(*) AS n FROM public_submissions WHERE status = 'pending'").first<{ n: number }>(),
      db.prepare("SELECT COUNT(*) AS n FROM change_proposals WHERE status = 'pending'").first<{ n: number }>(),
      loadReviewQueue(db).catch(() => [] as AdminBoxPhotoRow[]),
      loadPendingAdopters(db).catch(() => [] as AdminBoxAdopterRow[]),
      loadBoxHealthEntries(db).catch(() => [] as Awaited<ReturnType<typeof loadBoxHealthEntries>>),
      publishToken ? fetchPublishBotPrStatus(publishToken).catch(() => null) : Promise.resolve(null),
      loadNetworkStatsData(db).catch(() => ({ boxes: [], checkins: [], photos: [], approvedSponsorCount: 0 })),
      loadNetworkNeedRows(db, cutoffIso),
      loadProblemReports(db),
      db.prepare("SELECT run_id, created_at FROM change_proposals ORDER BY created_at DESC LIMIT 1").first<{
        run_id: string;
        created_at: string;
      }>(),
    ]);

    venues = venuesResult.results;
    submissionsTotal = submissionsTotalRow?.n ?? 0;
    proposalsTotal = proposalsTotalRow?.n ?? 0;
    photos = photosAll;
    adopters = adoptersAll;
    boxHealthEntries = boxHealth;
    publishBotStatus = publishBotStatusResult;
    networkStats = networkStatsResult;
    needRows = needRowsResult;
    problemReportRows = problemReportsResult;

    // `latestRefreshRow?.run_id` (not just `latestRefreshRow`) — a lenient
    // test fake or a D1 shape mismatch could hand back a truthy row with no
    // real column data, which must read as "no refresh yet," never as an
    // Invalid Date.
    if (latestRefreshRow?.run_id) {
      const suggestedRow = await db
        .prepare("SELECT COUNT(*) AS n FROM change_proposals WHERE run_id = ?")
        .bind(latestRefreshRow.run_id)
        .first<{ n: number }>();
      latestRefresh = {
        runId: latestRefreshRow.run_id,
        createdAt: latestRefreshRow.created_at,
        suggestedCount: suggestedRow?.n ?? 0,
      };
    } else {
      latestRefresh = null;
    }
  } catch (err) {
    handlePageAuthError(err);
  }

  // Cloudflare degrades independently of every D1 read above — see this
  // file's own header for why this call sits outside the try/catch.
  const visitors = await loadVisitorsAnalytics(period, now);

  // Same "staging can never Publish" gate /admin/places uses (#673 pt.6) —
  // a live "waiting to publish" bar on staging would show test-only D1 data
  // that can never actually be cleared by a Publish click there. Fetched
  // once, before the PostHog load below, since both need this binding.
  const { env } = await getCloudflareContext({ async: true });
  const isStaging = !isProductionWorker(env);

  // PostHog degrades independently too (#681) — same "never fail the whole
  // page for one section's outage" posture as Visitors above. POSTHOG_API_HOST
  // is optional (defaults inside posthogQuery.ts); POSTHOG_PROJECT_ID is a
  // plain wrangler var (not a secret, matching CF_ANALYTICS_ACCOUNT_ID's own
  // reasoning), read via the binding per AGENTS.md's "Runtime reads" — only
  // the API key itself is process.env, since that one IS a secret.
  const mapUsage = await loadMapUsageAnalytics(period, env.POSTHOG_PROJECT_ID, env.POSTHOG_API_HOST, now);
  const placeUsage = resolvePlaceUsageRows(mapUsage?.topPlaces ?? [], venues);
  const posthogProjectId = env.POSTHOG_PROJECT_ID;

  // "Switched to Spanish" is the one headline card the issue asks for as a
  // % of VISITORS (Kyle's 2026-09-26 rule) rather than a raw event count —
  // divided by Cloudflare's own number, never PostHog's. cfVisits === null
  // (Cloudflare unavailable) falls back to the raw switch count instead of
  // hiding the card outright — see the KpiCard call site below.
  const cfVisits = visitors?.visits ?? null;
  const cfPreviousVisits = visitors?.previousVisits ?? null;
  const localeEsPct = mapUsage ? pctOf(mapUsage.headline.localeSwitchedToEs, cfVisits) : null;
  const previousLocaleEsPct = mapUsage ? pctOf(mapUsage.headline.previousLocaleSwitchedToEs, cfPreviousVisits) : null;

  // location_permission only ever fires once a browser has ALREADY been
  // prompted (useGeolocation.ts's `wasPrompt` guard) — there is no distinct
  // "never asked" event, so it's inferred here as the gap between "near me"
  // taps and the granted+denied outcomes PostHog did see.
  const neverAskedLocation = mapUsage ? Math.max(mapUsage.headline.nearMeTaps - mapUsage.location.granted - mapUsage.location.denied, 0) : 0;

  const navCounts: AdminNavCounts = {
    submissions: submissionsTotal,
    proposals: proposalsTotal,
    photos: photos.length,
    adopters: adopters.length,
  };

  const publishSummary = summarizePublishChanges(venues);
  const showPublishBar = !isStaging && (publishSummary.newDrafts > 0 || publishSummary.editedSincePublish > 0 || publishSummary.archived > 0);
  const waitingToPublishCount = publishSummary.newDrafts + publishSummary.editedSincePublish + publishSummary.archived;

  const needsHelpBoxes = rankNeedsHelp(boxHealthEntries); // unlimited — same predicate #671's own "Needs help" filter will use

  // ─── "Needs you" strip (#680 Layout item 2) ────────────────────────────
  // Card 1 is a TEMPORARY combined-count fallback until #675 lands (folding
  // the public Review queue into Places too) — see this file's own header.
  // Card 3's own combined-count fallback ended with #677 (Photo review +
  // Sponsor requests folded into the Blessing Boxes tab) — its href now
  // points at that tab's own "To review" filter instead of the retired
  // /admin/box-photos queue.
  const needsCards: NeedsCardData[] = [
    {
      key: "review",
      label: "Places to review",
      count: submissionsTotal + proposalsTotal,
      href: "/admin/places?show=review",
      detail: `${submissionsTotal} review queue, ${proposalsTotal} data refresh`,
    },
    {
      key: "publish",
      label: "Waiting to publish",
      count: waitingToPublishCount,
      href: "/admin/places",
    },
    {
      key: "box-content",
      label: "Box photos & sponsor requests",
      count: photos.length + adopters.length,
      href: "/admin/boxes?show=review",
      detail: `${photos.length} photos, ${adopters.length} sponsor requests`,
    },
    {
      key: "box-help",
      label: "Boxes empty or low",
      count: needsHelpBoxes.length,
      href: "/admin/boxes",
    },
  ];

  // ─── Blessing boxes (reuses boxStats.ts — same math as the public Boxes page) ──
  const periodCheckins = filterByPeriod(networkStats.checkins, period, now);
  const previousCheckins = filterByPreviousPeriod(networkStats.checkins, period, now);
  const counts = computeCheckinCounts(periodCheckins);
  const previousCounts = computeCheckinCounts(previousCheckins);
  const checkinsByVenue = groupCheckinsByVenue(networkStats.checkins);
  const networkAverages = computeNetworkPairAverages(checkinsByVenue);
  const networkOverview = computeNetworkOverview(networkStats.boxes.length, networkStats.approvedSponsorCount ?? 0);
  const boxesForRanking = networkStats.boxes.map((b) => ({ id: b.id, name: b.name, archived: b.archived, checkins: checkinsByVenue.get(b.id) ?? [] }));
  const longestSinceFill = rankLongestSinceLastFill(boxesForRanking, 4);
  const periodPhotos = filterByPeriod(networkStats.photos, period, now);
  const milestones = computeMilestones({ fills: counts.fills, uses: counts.uses });
  const mostNeeded = rankNetworkMostNeeded(needRows, 4);

  // ─── Map data health ────────────────────────────────────────────────────
  const publishedVenues = venues.filter((v) => v.status === "published");
  const newPlacesThisPeriod = filterByPeriod(publishedVenues, period, now).length;
  const staleThreeMonths = selectStalePlaces(venues, now, { months: 3 });
  const problemCounts = computeProblemReportCounts(problemReportRows, period, now);

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="dashboard" counts={navCounts} showActivity={showActivity} />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        {publishBotStatus && (
          <PublishBotStatusBanner
            prNumber={publishBotStatus.number}
            prUrl={publishBotStatus.htmlUrl}
            state={publishBotStatus.state}
          />
        )}
        {isStaging ? (
          // Same copy as /admin/places' own staging banner (#673 pt.6) —
          // one consistent message wherever an admin might expect a Publish
          // panel on this test site.
          <p className="rounded-[var(--radius-lg)] border border-[var(--color-clay-500)] bg-[var(--color-clay-100)] px-4 py-3 text-sm text-[var(--color-clay-700)]">
            Test site: publishing is turned off here.
          </p>
        ) : (
          showPublishBar && <PublishPanel summary={publishSummary} reviewHref="/admin/places" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="wordmark text-xl text-[var(--color-ink-900)]">Hi {email.split("@")[0]}</h1>
          <nav aria-label="Time period" className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] bg-white p-1">
            {DASHBOARD_PERIODS.map((p) => (
              <Link
                key={p}
                href={`/admin?period=${p}`}
                aria-current={p === period ? "page" : undefined}
                className={`min-h-11 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  p === period
                    ? "bg-[var(--color-sage-600)] text-[var(--color-bone-50)]"
                    : "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </nav>
        </div>

        <section aria-label="Needs you">
          <DashboardNeedsStrip cards={needsCards} />
        </section>

        <section aria-labelledby="visitors-heading" className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
          <h2 id="visitors-heading" className="wordmark text-base text-[var(--color-ink-900)]">
            Visitors
          </h2>
          {visitors ? (
            <div className="mt-3 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard label="Visitors" displayValue={String(visitors.visits)} value={visitors.visits} previousValue={visitors.previousVisits} approximate />
                <KpiCard label="Page views" displayValue={String(visitors.pageviews)} value={visitors.pageviews} previousValue={visitors.previousPageviews} approximate />
                <KpiCard
                  label="On a phone"
                  displayValue={visitors.phoneSharePct === null ? "—" : `${visitors.phoneSharePct}%`}
                  value={visitors.phoneSharePct ?? 0}
                  approximate
                />
                <KpiCard
                  label="Phone page load"
                  displayValue={visitors.phoneLcpMs === null ? "—" : `${(visitors.phoneLcpMs / 1000).toFixed(1)}s`}
                  value={visitors.phoneLcpMs ?? 0}
                  approximate
                />
              </div>
              {visitors.phoneLcpMs !== null && (
                <p className="text-xs text-[var(--color-ink-500)]">
                  Google calls anything under {(LCP_GOOD_MS / 1000).toFixed(1)}s &quot;good&quot; —{" "}
                  {visitors.phoneLcpMs <= LCP_GOOD_MS ? "we're in that range." : "we're slower than that right now."}
                </p>
              )}
              <div>
                <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Visitors per day</h3>
                <DailyBars points={visitors.dailyVisitors.map((d) => ({ date: d.date, value: d.visits }))} emptyMessage="No visitor data yet for this period." />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-ink-700)]">How people found the site</h3>
                <BarList
                  items={visitors.referrers.map((r) => ({ label: r.label, value: r.visits, displayValue: `${r.visits} visits` }))}
                  emptyMessage="No referrer data yet for this period."
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-ink-500)]">Visitor numbers are unavailable right now.</p>
          )}
        </section>

        <section aria-labelledby="map-usage-heading" className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="map-usage-heading" className="wordmark text-base text-[var(--color-ink-900)]">
              What people do on the map
            </h2>
            {mapUsage && posthogProjectId && (
              <a
                href={`https://us.posthog.com/project/${posthogProjectId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[var(--color-sage-700)] underline underline-offset-2"
              >
                Open in PostHog →
              </a>
            )}
          </div>
          {mapUsage ? (
            <div className="mt-3 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard label="Near me taps" displayValue={String(mapUsage.headline.nearMeTaps)} value={mapUsage.headline.nearMeTaps} previousValue={mapUsage.headline.previousNearMeTaps} />
                <KpiCard label="Searches" displayValue={String(mapUsage.headline.searches)} value={mapUsage.headline.searches} previousValue={mapUsage.headline.previousSearches} />
                <KpiCard label="Place cards opened" displayValue={String(mapUsage.headline.cardsOpened)} value={mapUsage.headline.cardsOpened} previousValue={mapUsage.headline.previousCardsOpened} />
                <KpiCard
                  label="Switched to Spanish"
                  displayValue={cfVisits === null ? `${mapUsage.headline.localeSwitchedToEs} switches` : formatPct(localeEsPct)}
                  value={cfVisits === null ? mapUsage.headline.localeSwitchedToEs : (localeEsPct ?? 0)}
                  previousValue={cfVisits === null ? mapUsage.headline.previousLocaleSwitchedToEs : (previousLocaleEsPct ?? undefined)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Most opened places</h3>
                  <BarList
                    items={placeUsage.slice(0, 6).map((p) => ({
                      label: p.name ?? "Removed place",
                      value: p.count,
                      displayValue: `${p.count} opens`,
                      href: p.href ?? undefined,
                    }))}
                    emptyMessage="No place cards opened yet this period."
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Top searches</h3>
                  <BarList
                    items={mapUsage.topSearches.map((s) => ({
                      label: s.term,
                      value: s.count,
                      displayValue: s.zeroResults ? `${s.count} · 0 results` : String(s.count),
                    }))}
                    emptyMessage="Not enough repeated searches yet to say."
                  />
                  <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                    Terms searched 3+ times only. A &quot;0 results&quot; tag means every one of those searches found nothing — a hint the map may be missing that place.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink-700)]">After opening a card, people…</h3>
                  <BarList
                    items={[
                      { label: "Directions (walk)", value: mapUsage.cardActions.directionsWalk, displayValue: formatPct(pctOf(mapUsage.cardActions.directionsWalk, mapUsage.headline.cardsOpened)) },
                      { label: "Directions (bus)", value: mapUsage.cardActions.directionsBus, displayValue: formatPct(pctOf(mapUsage.cardActions.directionsBus, mapUsage.headline.cardsOpened)) },
                      { label: "Directions (drive)", value: mapUsage.cardActions.directionsDrive, displayValue: formatPct(pctOf(mapUsage.cardActions.directionsDrive, mapUsage.headline.cardsOpened)) },
                      { label: "Call", value: mapUsage.cardActions.call, displayValue: formatPct(pctOf(mapUsage.cardActions.call, mapUsage.headline.cardsOpened)) },
                      { label: "Website", value: mapUsage.cardActions.website, displayValue: formatPct(pctOf(mapUsage.cardActions.website, mapUsage.headline.cardsOpened)) },
                      { label: "Save", value: mapUsage.cardActions.save, displayValue: formatPct(pctOf(mapUsage.cardActions.save, mapUsage.headline.cardsOpened)) },
                      { label: "Share", value: mapUsage.cardActions.share, displayValue: formatPct(pctOf(mapUsage.cardActions.share, mapUsage.headline.cardsOpened)) },
                      { label: "Report", value: mapUsage.cardActions.report, displayValue: formatPct(pctOf(mapUsage.cardActions.report, mapUsage.headline.cardsOpened)) },
                    ]}
                    emptyMessage="No card actions yet this period."
                  />
                  <p className="mt-1 text-xs text-[var(--color-ink-500)]">Share of cards opened this period.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Filters people use</h3>
                  <BarList
                    items={mapUsage.filters.map((f) => ({
                      label: filterLabel(f.filter),
                      value: f.count,
                      displayValue: cfVisits === null ? `${f.count} toggles` : formatPct(pctOf(f.count, cfVisits)),
                    }))}
                    emptyMessage="No filters toggled on yet this period."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Location shared?</h3>
                  <BarList
                    items={[
                      { label: "Granted", value: mapUsage.location.granted, displayValue: `${mapUsage.location.granted}` },
                      { label: "Said no", value: mapUsage.location.denied, displayValue: `${mapUsage.location.denied}` },
                      { label: "Never asked", value: neverAskedLocation, displayValue: `${neverAskedLocation}` },
                    ]}
                    emptyMessage="No location prompts yet this period."
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Came from a flyer or link tag</h3>
                  <BarList
                    items={mapUsage.utmSources.map((u) => ({
                      label: u.campaign ? `${u.source} · ${u.campaign}` : u.source,
                      value: u.sessions,
                      displayValue: `${u.sessions} sessions`,
                    }))}
                    emptyMessage="No tagged flyer or link visits yet this period."
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-ink-500)]">Usage numbers are unavailable right now.</p>
          )}
        </section>

        <section aria-labelledby="boxes-heading" className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
          <h2 id="boxes-heading" className="wordmark text-base text-[var(--color-ink-900)]">
            Blessing boxes
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Times filled" displayValue={String(counts.fills)} value={counts.fills} previousValue={previousCounts.fills} />
            <KpiCard label="Times used" displayValue={String(counts.uses)} value={counts.uses} previousValue={previousCounts.uses} />
            <KpiCard label="Reported empty" displayValue={String(counts.emptyReports)} value={counts.emptyReports} previousValue={previousCounts.emptyReports} />
            <KpiCard
              label="Avg. empty → refilled"
              displayValue={networkAverages.emptyToFillMs === null ? "—" : formatDuration(networkAverages.emptyToFillMs)}
              value={networkAverages.emptyToFillMs ?? 0}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Boxes in service" displayValue={String(networkOverview.boxCount)} value={networkOverview.boxCount} />
            <KpiCard label="With a sponsor" displayValue={`${networkOverview.avgSponsorsPerBox} avg`} value={networkStats.approvedSponsorCount ?? 0} />
            <KpiCard label="Photos shared" displayValue={String(periodPhotos.length)} value={periodPhotos.length} />
            <KpiCard label="Getting empty-box emails" displayValue={String(adopters.length)} value={adopters.length} />
          </div>
          {milestones.length > 0 && (
            <p className="mt-3 text-sm text-[var(--color-ink-700)]">
              {milestones.map((m) => (m.metric === "fills" ? `Pueblo has filled its boxes ${m.threshold} times. ` : `Pueblo has used its boxes ${m.threshold} times. `))}
            </p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Longest since last filled</h3>
              <BarList
                items={longestSinceFill.map((b) => ({
                  label: b.name,
                  value: b.lastFilledAt ? now.getTime() - new Date(b.lastFilledAt).getTime() : now.getTime(),
                  displayValue: b.lastFilledAt ? formatDuration(now.getTime() - new Date(b.lastFilledAt).getTime()) : "never",
                }))}
                emptyMessage="No boxes yet."
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-ink-700)]">Most-needed items</h3>
              <BarList
                items={mostNeeded.map((n) => ({ label: NEED_LABELS[n.key] ?? n.key, value: n.count, displayValue: `${n.count} asks` }))}
                emptyMessage="Not enough check-ins yet to say."
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="map-health-heading" className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
          <h2 id="map-health-heading" className="wordmark text-base text-[var(--color-ink-900)]">
            Map data health
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Places on the map" displayValue={String(publishedVenues.length)} value={publishedVenues.length} previousValue={publishedVenues.length - newPlacesThisPeriod} />
            <KpiCard label="New this period" displayValue={String(newPlacesThisPeriod)} value={newPlacesThisPeriod} />
            <KpiCard label="Not checked in 90+ days" displayValue={String(staleThreeMonths.totalCount)} value={staleThreeMonths.totalCount} />
            <KpiCard label="Problem reports (open / fixed)" displayValue={`${problemCounts.open} / ${problemCounts.fixed}`} value={problemCounts.open} />
          </div>
          <p className="mt-3 text-sm text-[var(--color-ink-500)]">
            {latestRefresh ? (
              <>
                Last data refresh {new Date(latestRefresh.createdAt).toLocaleDateString()} — {latestRefresh.suggestedCount} suggested changes.{" "}
                <Link href="/admin/places?show=review" className="font-medium text-[var(--color-sage-700)] underline underline-offset-2">
                  Review →
                </Link>
              </>
            ) : (
              "No automated data refresh has run yet."
            )}
          </p>
          {staleThreeMonths.totalCount > 0 && (
            <Link href="/admin/places" className="mt-1 inline-block text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2">
              See places due for a check →
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}

function formatDuration(ms: number): string {
  const { value, unit } = formatDurationMs(ms);
  return `${value} ${unit}`;
}
