import type { Venue } from "@/types/venue";
import { publishedVenues } from "@/data/published-venues";
import { benefitFlags } from "@/data/benefit-flags";

// The 10 hand-curated Pueblo Food Project (CGSP) records. Re-exported here
// unchanged for backward compatibility — scripts/seed-admin-db.ts and two
// existing tests (OperatorAttribution.test.tsx, seed-admin-db.test.ts)
// import pfpVenues from this module specifically. The literal data now
// lives in src/data/pfp-venues.ts (#237 checkpoint d, the published-venues.ts
// refactor) — see that file's header for why it had to move out of here
// (avoids a circular import with published-venues.ts, which this module
// now imports from, below).
export { pfpVenues } from "@/data/pfp-venues";

// Public venue list, sourced from the last published snapshot
// (published-venues.ts — see that file's header for what it is and how it's
// regenerated). SNAP/WIC benefit flags are applied as a runtime overlay from
// benefit-flags.ts (keyed by id) so they survive regeneration of the
// auto-generated OSM / Plentiful data (#127). This overlay is intentionally
// BYTE-IDENTICAL to its behavior before the #237 checkpoint d
// published-venues.ts extraction (proved by
// src/__tests__/publishedVenues.test.ts) — the NULL-guard fix that lets an
// admin's explicit D1 edit win over this overlay (spec §7 step 1, "NB4") is
// Phase 2 work, once accepts_snap/accepts_wic are actually admin-editable in
// D1. Doing that guard now, before Phase 2 ships, would be a behavior change
// with nothing yet able to set a competing value — explicitly out of scope
// here.
export const venues: Venue[] = publishedVenues.map((v) => {
  const f = benefitFlags[v.id];
  return f ? { ...v, accepts_snap: f.snap, accepts_wic: f.wic } : v;
});

export const categoryLabels: Record<Venue["category"], string> = {
  pantry: "Food Pantry",
  grocery: "Grocery / Supermarket",
  convenience: "Convenience Store",
  farm: "Farm / Market",
  garden: "Community Garden",
  edible_landscape: "Edible Landscape",
  meal_site: "Meal Site",
};

export const categoryColors: Record<Venue["category"], string> = {
  pantry: "#BE2D45",       // cranberry — spec §3.1
  grocery: "#1F4E8C",      // deep blue
  convenience: "#0F6573",  // teal
  farm: "#92591D",         // burnt amber
  garden: "#2C5F4F",       // sage (matches brand)
  edible_landscape: "#58772B", // olive
  meal_site: "#6B3FA0",    // plum
};

export const categoryIcon: Record<Venue["category"], string> = {
  pantry: "ShoppingBasket",
  grocery: "ShoppingCart",
  convenience: "Store",
  farm: "Tractor",
  garden: "Sprout",
  edible_landscape: "Leaf",
  meal_site: "Utensils",
};
