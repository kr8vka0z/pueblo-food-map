/**
 * analyticsFetch.ts — the outbound-fetch policy shared by the admin
 * Dashboard's two analytics loaders (cfAnalytics.ts, posthogQuery.ts):
 * a per-attempt timeout, one retry on a transient failure, and a small
 * concurrency limiter.
 *
 * WHY: page.tsx runs both loaders at once (2 Cloudflare + 8 PostHog calls).
 * A Worker keeps at most 6 outbound connections open per request and queues
 * the rest, while AbortSignal.timeout starts counting when fetch() is called,
 * so queued calls used up their budget waiting and the section went
 * "unavailable" on some loads and not others. posthogQuery.ts now runs its
 * queries POSTHOG_CONCURRENCY at a time, which with Cloudflare's 2 keeps the
 * Dashboard at 5 open at most.
 */

/** Per attempt. A cold PostHog HogQL query has been measured at 1.5–2.4s, once over 4s; warm ones take ~200ms. */
export const ANALYTICS_FETCH_TIMEOUT_MS = 8000;

/** PostHog queries in flight at once. Cloudflare's 2 parallel calls + 3 = 5, under the Worker's 6-connection limit. */
export const POSTHOG_CONCURRENCY = 3;

/**
 * fetch() with a fresh timeout per attempt and ONE retry when the attempt
 * throws (timeout, network error) or answers 5xx. A 4xx is returned as-is:
 * a bad key or a bad query won't fix itself on a second try.
 */
export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const last = attempt === 2;
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ANALYTICS_FETCH_TIMEOUT_MS) });
      if (res.status < 500 || last) return res;
      // An unread body keeps the connection counted against the Worker's limit.
      await res.body?.cancel();
    } catch (err) {
      if (last) throw err;
    }
  }
}

/** Promise.all over `items`, at most `limit` running at once; results keep the input order. Stops starting new work after the first rejection. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
