/**
 * linkHealth.ts — outbound link-health checking for the refresh pipeline
 * (spec §6.5; the concrete acceptance test is issue #235, an intentionally
 * unfixed dead Plentiful link left in place as a canary — see that issue's
 * "do not fix directly" note before touching it).
 *
 * classifyLinkCheck is the load-bearing rule: only 404/410 count as "dead."
 * 403 (frequently a bot-block/WAF response to the checker's OWN request, not
 * evidence the page is gone), 429 (rate-limited), any 5xx (the target site
 * having a bad moment), and a timeout are all logged for visibility but
 * never proposed — a link-health false positive would tell an admin to
 * clear a URL that's actually fine.
 *
 * ponytail: the design doc's fuller version requires the SAME failure on
 * two consecutive weekly checks before proposing anything (persisted
 * cross-run state, absorbs a transient blip). This pipeline runs monthly
 * and has no persisted per-venue check history yet — shipping the
 * single-check version first is what the doc itself recommends ("ship the
 * simple version first... ratchet up if false positives show up in
 * practice"). Upgrade path: read the venue's most recent PRIOR link_health
 * proposal (if any, from `change_proposals`) and only propose again if this
 * check agrees with it.
 */

export type LinkCheckResult =
  | { kind: "status"; status: number }
  | { kind: "timeout" }
  | { kind: "network_error"; message: string };

export type LinkCheckOutcome =
  | { classification: "dead"; httpStatus: number }
  | { classification: "ignore"; reason: string };

const DEAD_STATUSES = new Set([404, 410]);

export function classifyLinkCheck(result: LinkCheckResult): LinkCheckOutcome {
  if (result.kind === "status") {
    if (DEAD_STATUSES.has(result.status)) return { classification: "dead", httpStatus: result.status };
    return { classification: "ignore", reason: `http_${result.status}` };
  }
  if (result.kind === "timeout") return { classification: "ignore", reason: "timeout" };
  return { classification: "ignore", reason: `network_error: ${result.message}` };
}

export const LINK_HEALTH_USER_AGENT =
  "pueblo-food-map/link-health-check (kysboyd@gmail.com; +https://pueblofoodmap.com)";

export interface CheckUrlOptions {
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * HEAD first, falling back to GET on 405/501 (some servers reject HEAD
 * outright) — same "HEAD, falling back to GET" rule the design doc's
 * ingest-validation section (§6.9) uses for URL reachability, reused here
 * rather than a second convention.
 */
export async function checkUrl(url: string, options: CheckUrlOptions = {}): Promise<LinkCheckOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let result: LinkCheckResult;
    try {
      const res = await fetchImpl(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": LINK_HEALTH_USER_AGENT },
      });
      if (res.status === 405 || res.status === 501) {
        const getRes = await fetchImpl(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": LINK_HEALTH_USER_AGENT },
        });
        result = { kind: "status", status: getRes.status };
      } else {
        result = { kind: "status", status: res.status };
      }
    } catch (err) {
      result =
        err instanceof Error && err.name === "AbortError"
          ? { kind: "timeout" }
          : { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
    }
    return classifyLinkCheck(result);
  } finally {
    clearTimeout(timer);
  }
}
