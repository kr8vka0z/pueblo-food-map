/**
 * boxEntryVariant — pure resolver for the Blessing Boxes B4 entry-point
 * preview switch (slice 4).
 *
 * Extracted out of MapWrapper.tsx into its own module specifically so it
 * is unit-testable: MapWrapper itself has no test harness anywhere in this
 * repo (react-map-gl/mapbox-gl needs a WebGL canvas jsdom doesn't provide —
 * see AGENTS.md's "Map library" section), so this function is the ONE
 * headless proof that the query-param -> variant mapping is correct. This
 * module imports nothing map-related, so importing it in a test never
 * risks pulling in Mapbox.
 *
 * WHY the no-param case resolves to null, not "nav": BottomNav's 4-item
 * shape is a finalized Kyle design decision (2026-09-16) — a visitor
 * loading the site with no `?boxEntry=` must see EXACTLY that today's
 * bar, and no floating button either. Only an EXPLICIT `?boxEntry=nav` or
 * `?boxEntry=map` opts into either preview candidate; there is no default
 * candidate. (A prior version of this function defaulted the no-param case
 * to "nav", which silently grew BottomNav to 5 items for every visitor —
 * fixed as a blocker on PR #473.)
 *
 * This whole switch (this file + BlessingBoxesMapButton.tsx +
 * BottomNav.tsx's `showBoxesItem` prop) is TEMPORARY scaffolding for
 * Kyle's B4 placement choice and MUST be deleted/collapsed to the single
 * picked candidate before any promotion of this feature to `main`.
 */

export type BoxEntryVariant = "nav" | "map" | null;

export function resolveBoxEntryVariant(search: string): BoxEntryVariant {
  const value = new URLSearchParams(search).get("boxEntry");
  if (value === "nav") return "nav";
  if (value === "map") return "map";
  return null;
}
