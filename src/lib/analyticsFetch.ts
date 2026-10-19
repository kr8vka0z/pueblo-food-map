/**
 * analyticsFetch.ts — the outbound-fetch policy shared by the admin
 * Dashboard's two analytics loaders (cfAnalytics.ts, posthogQuery.ts):
 * a per-attempt timeout with one retry on a transient failure, a limiter
 * shared by both loaders within one page render, and an overall deadline per
 * loader.
 *
 * WHY: page.tsx runs both loaders at once (3 Cloudflare + 8 PostHog calls),
 * next to a GitHub publish-status fetch. A Worker keeps at most 6 outbound
 * connections open per request and queues the rest, while a fetch's timeout
 * starts counting when fetch() is called, so queued calls used up their
 * budget waiting and a section went "unavailable" on some loads and not
 * others. The limiter holds analytics to DASHBOARD_FETCH_SLOTS (5), leaving
 * one connection for GitHub, and each attempt's timeout starts only once it
 * holds a slot.
 */

/** Per attempt. A cold PostHog HogQL query has been measured at 1.5–2.7s, once over 4s; warm ones take ~200ms. */
export const ANALYTICS_FETCH_TIMEOUT_MS = 8000;

/** Per loader, counted from when it starts fetching (queue time included). Past it the loader returns null ("unavailable") instead of holding the page open. */
export const ANALYTICS_DEADLINE_MS = 20_000;

/** Analytics fetches open at once per Dashboard render: the Worker allows 6, and GitHub's publish-status fetch takes one. */
export const DASHBOARD_FETCH_SLOTS = 5;

/** Runs `task` once a slot is free; the slot is held until the task settles, so body reads count too. */
export type FetchLimiter = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * One limiter per page render (page.tsx creates it and passes it to both
 * loaders). Deliberately not a module-level singleton: the 6-connection cap
 * is per request, and a global limiter would make concurrent renders in the
 * same isolate queue behind each other.
 */
export function createFetchLimiter(max: number = DASHBOARD_FETCH_SLOTS): FetchLimiter {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    while (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

/** Aborts `signal` after `ms`. Built on setTimeout (not AbortSignal.timeout) so tests can drive it with fake timers. Call `clear()` when the loader finishes. */
export function startDeadline(ms: number = ANALYTICS_DEADLINE_MS): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Dashboard analytics deadline passed", "TimeoutError")), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * fetch() with a fresh timeout per attempt and ONE retry when the attempt
 * throws (timeout, network error) or answers 5xx. A 4xx is returned as-is:
 * a bad key or a bad query won't fix itself on a second try. Once `deadline`
 * aborts, the in-flight attempt is cancelled and nothing is retried.
 */
export async function fetchWithRetry(url: string, init: RequestInit, deadline?: AbortSignal): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const last = attempt === 2;
    const timeout = AbortSignal.timeout(ANALYTICS_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: deadline ? AbortSignal.any([timeout, deadline]) : timeout });
      if (res.status < 500 || last) return res;
      // An unread body keeps the connection counted against the Worker's limit.
      await res.body?.cancel();
    } catch (err) {
      if (last || deadline?.aborted) throw err;
    }
  }
}
