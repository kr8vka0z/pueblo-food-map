"use client";

/**
 * useBoxActivity — client-side fetch of the combined activity feed
 * (GET /api/public/blessing-boxes/activity, Blessing Boxes slice 3).
 * Mirrors useBoxVenues.ts's shape (fetch-on-mount, best-effort, cancel flag
 * on unmount) with one addition: the fetch re-runs whenever `filters`
 * changes, since this hook backs both the global /boxes/activity page
 * (filters change as the visitor picks a box/kind/date range) and
 * BoxContent's own small per-box panel (a fixed `{venueId, pageSize}`).
 *
 * WHY this fetches the PUBLIC API route rather than reading D1 directly:
 * unlike /box/[id]'s Server Component (which reads D1 directly because it
 * renders once per request with no filter UI), this hook backs interactive
 * filter controls that change the URL client-side — a browser fetch here
 * is the same pattern useBoxVenues already established, and it's what lets
 * the route's own 60s Cache API layer actually do its job (a Worker
 * self-fetching its own domain during SSR risks tripping Cloudflare's loop
 * guard — see AGENTS.md's Healthchecks.io dead-man's-switch section for
 * why this repo avoids that pattern elsewhere).
 */

import { useEffect, useState } from "react";
import type { ActivityFilters, ActivityPage } from "@/lib/boxActivity";

const EMPTY_PAGE: ActivityPage = { items: [], hasMore: false, page: 1 };

function buildQuery(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  if (filters.venueId) params.set("box", filters.venueId);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("limit", String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface UseBoxActivityResult {
  page: ActivityPage;
  loading: boolean;
}

export function useBoxActivity(filters: ActivityFilters): UseBoxActivityResult {
  // JSON-stringified so the effect only re-fires when a filter VALUE
  // changes, not on every render (most callers pass a fresh object literal
  // each render).
  const filtersKey = JSON.stringify(filters);

  // `result.key` tracks which filtersKey the stored page actually answers.
  // WHY not a separate `loading` useState flipped to true synchronously at
  // the top of the effect: React's react-hooks/set-state-in-effect rule
  // flags that as cascading-render prone. Deriving `loading` by comparing
  // `result.key !== filtersKey` during render instead ("adjust state while
  // rendering" — https://react.dev/learn/you-might-not-need-an-effect) gets
  // the same "a fetch for the CURRENT filters is in flight" signal with no
  // synchronous setState in the effect body at all.
  const [result, setResult] = useState<{ key: string; page: ActivityPage }>({
    key: filtersKey,
    page: EMPTY_PAGE,
  });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/public/blessing-boxes/activity${buildQuery(filters)}`)
      .then((res) => (res.ok ? (res.json() as Promise<ActivityPage>) : null))
      .then((data) => {
        if (cancelled) return;
        setResult({ key: filtersKey, page: data ?? EMPTY_PAGE });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ key: filtersKey, page: EMPTY_PAGE });
      });

    return () => {
      cancelled = true;
    };
    // filters itself is intentionally omitted — filtersKey is the real
    // dependency, and including the object too would re-fire this effect
    // on every render (a fresh literal each time) even when nothing changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const loading = result.key !== filtersKey;
  return { page: loading ? EMPTY_PAGE : result.page, loading };
}
