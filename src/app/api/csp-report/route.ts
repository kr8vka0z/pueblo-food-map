/**
 * POST /api/csp-report — Content-Security-Policy violation report sink (#593
 * CI-review follow-up).
 *
 * WHY this exists: Content-Security-Policy-Report-Only has no observer
 * without somewhere to POST to — without a report-uri, a real violation
 * only ever shows up in that one visitor's own browser devtools console,
 * invisible to anyone watching Workers Logs. Logs one structured line per
 * report via the same event-name convention as the rest of
 * src/lib/logger.ts, so a real violation is filterable in Workers Logs the
 * same way a form's turnstile_failed already is — the evidence needed
 * before this repo can honestly say "dev ran quiet" and flip
 * Content-Security-Policy-Report-Only to an enforcing Content-Security-Policy.
 *
 * PII: strips the query string off document-uri before logging.
 * /alerts/confirm and /alerts/stop carry a live subscription token in `?t=`
 * (see next.config.ts's own Referrer-Policy override for those two paths) —
 * a CSP report's document-uri is the full page URL the violation fired on,
 * so an un-stripped log line could otherwise leak that token into Workers
 * Logs. blocked-uri is logged as-is: per the CSP spec, browsers already
 * strip it to origin-only (no path/query) for any cross-origin resource.
 *
 * No auth (browsers POST here unauthenticated by the CSP spec itself), but
 * IS rate-limited (CI review addition) — unlike the three public forms,
 * this fires from every page load with a violation, not from a human
 * filling out a text field, so nothing here gates volume the way Turnstile
 * gates them. The field-length cap above only bounds the SIZE of an
 * abusive line, not the COUNT — an unrate-limited flood could still emit
 * unlimited fake csp_violation_report lines, which would make the
 * report-only period's silence untrustworthy well before storage/cost
 * became the concern. Reuses checkAndIncrement (src/lib/checkinRateLimit.ts
 * — the box_checkin_rate_limit table, no new migration) with the same
 * two-tier per-IP + site-wide shape src/lib/formRateLimit.ts uses for the
 * three forms; see that file's own header for the "why per-IP before
 * site-wide" ordering. Caps are generous (100/hour per IP, 1000/hour
 * site-wide) — a single real page load hitting a genuinely broken directive
 * can legitimately fire dozens of reports in seconds (one per blocked
 * resource), so this only needs to bound a SUSTAINED/scripted flood, not
 * a real visitor's worst-case burst.
 *
 * Unlike every other public write path's rate limit in this app, exceeding
 * this one does NOT change the response — still 204, same as success. A
 * CSP report is fire-and-forget; the browser reads nothing from the
 * response and would gain nothing from a 429. Reaching the cap simply
 * means this report doesn't get logged. Resolving the D1 context itself
 * fails the same way (log nothing, still 204) rather than the 503 other
 * routes return — unlike a form submission, dropping a report during a D1
 * blip has no user-facing or data-loss consequence.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { logCspViolation } from "@/lib/logger";

// Caps how much of any one field reaches Workers Logs. Nothing authenticates
// or rate-limits this endpoint (see the header above), so without a cap a
// single POST could log an arbitrarily large string, repeatably — bloating
// Workers Logs and undermining the one thing this endpoint exists to give:
// a trustworthy "dev ran quiet" signal before flipping to an enforcing CSP.
const MAX_FIELD_LENGTH = 500;

function stripQuery(url: unknown): string | undefined {
  if (typeof url !== "string" || url === "") return undefined;
  try {
    const u = new URL(url);
    // A pathological path segment is still bounded before logging, same as
    // every other field via MAX_FIELD_LENGTH above.
    return `${u.origin}${u.pathname}`.slice(0, MAX_FIELD_LENGTH);
  } catch {
    return undefined; // not a well-formed absolute URL — drop rather than log a raw unparsed string
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : undefined;
}

const MAX_REPORTS_PER_IP_PER_HOUR = 100;
const MAX_REPORTS_SITE_WIDE_PER_HOUR = 1000;
const GLOBAL_CSP_REPORT_RATE_LIMIT_ID = "all";

/**
 * Returns true if this report is under both the per-IP and site-wide caps,
 * atomically incrementing both D1 counters as part of the same check (same
 * per-IP-before-site-wide ordering as src/lib/formRateLimit.ts's
 * checkFormRateLimit, so one already-over-cap IP can't keep burning the
 * shared site budget on its own rejected retries). Returns false (never
 * throws) on any failure to resolve D1 or the rate-limit secret — see this
 * file's own header for why that means "log nothing," not a 503.
 */
async function underCspReportRateLimit(req: NextRequest): Promise<boolean> {
  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return false;
  }

  const secret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!secret) return false;

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const underIpCap = await checkAndIncrement(
    db,
    secret,
    { scope: "csp-report-ip", id: ip },
    MAX_REPORTS_PER_IP_PER_HOUR,
  );
  if (!underIpCap) return false;

  return checkAndIncrement(
    db,
    secret,
    { scope: "csp-report-site", id: GLOBAL_CSP_REPORT_RATE_LIMIT_ID },
    MAX_REPORTS_SITE_WIDE_PER_HOUR,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body: unknown = await req.json();
    // Two shapes reach this endpoint depending on browser/report format: the
    // legacy `report-uri` CSP directive (what next.config.ts's CSP actually
    // sets) posts { "csp-report": {...} }; the newer Reporting API
    // `report-to` posts an array of { type, body: {...} }. This app only
    // sets report-uri, so the array branch is defensive, not exercised by
    // this app's own header today.
    const record = body as Record<string, unknown>;
    const report = Array.isArray(body)
      ? ((body[0] as Record<string, unknown> | undefined)?.body as Record<string, unknown> | undefined)
      : (record?.["csp-report"] as Record<string, unknown> | undefined);

    if (report && (await underCspReportRateLimit(req))) {
      // Reporting API v1 CSP report bodies use `effectiveDirective`, not
      // `violatedDirective` (blockedURL/documentURL are correct as-is) —
      // this branch is defensive/unexercised (see comment above), but get
      // the field name right in case a `report-to` header ever points here.
      logCspViolation({
        violatedDirective: asString(report["violated-directive"] ?? report.effectiveDirective),
        blockedUri: asString(report["blocked-uri"] ?? report.blockedURL),
        documentUri: stripQuery(report["document-uri"] ?? report.documentURL),
      });
    }
  } catch {
    // Malformed report body — never let a public, unauthenticated endpoint's
    // parse failure surface as a 500.
  }

  return new Response(null, { status: 204 });
}
