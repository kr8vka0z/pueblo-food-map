import type { Venue } from "@/types/venue";
import { publishedVenues } from "@/data/published-venues";

// The 10 hand-curated Pueblo Food Project (CGSP) records. Re-exported here
// unchanged for backward compatibility — scripts/seed-admin-db.ts and two
// existing tests (OperatorAttribution.test.tsx, seed-admin-db.test.ts)
// import pfpVenues from this module specifically. The literal data now
// lives in src/data/pfp-venues.ts (#237 checkpoint d, the published-venues.ts
// refactor) — see that file's header for why it had to move out of here
// (avoids a circular import with published-venues.ts, which this module
// now imports from, below).
export { pfpVenues } from "@/data/pfp-venues";

// Public venue list, sourced directly from the last published snapshot
// (published-venues.ts — see that file's header for what it is and how it's
// regenerated). D1's accepts_snap/accepts_wic are the sole source of truth
// for SNAP/WIC (#597): migration 0014 copied the old static overlay's
// matches into D1 and shipped to production via the 2026-09-25 Publish, so
// the overlay that used to backfill NULLs at runtime (benefit-flags.ts,
// withBenefitFlagsOverlay) is gone — an admin can permanently edit either
// field in D1 with no fallback data to reconcile against.
export const venues: Venue[] = publishedVenues;

export const categoryLabels: Record<Venue["category"], string> = {
  pantry: "Food Pantry",
  grocery: "Grocery / Supermarket",
  convenience: "Convenience Store",
  farm: "Farm / Market",
  garden: "Community Garden",
  edible_landscape: "Edible Landscape",
  meal_site: "Meal Site",
  blessing_box: "Blessing Box",
};

// Blessing Boxes slice 1 (Build Plan / DESIGN.md "Category colors"): picked
// raspberry #C2447B — the one hue bucket (magenta/berry) not already used by
// the other 7 (red/blue/teal/brown/green/olive/purple), so a box pin stays
// instantly distinguishable at a glance. Kept in parity across THREE places
// per this repo's existing convention (checked 2026-09-17, all three already
// duplicated the other 7): this map, VenueMarker.tsx's own CATEGORY_COLORS
// copy, and globals.css's --color-cat-blessing var (+ DESIGN.md's catBlessing
// token) — design:drift only checks the CSS-var<->DESIGN.md pair, not this
// data map, so this one is a plain literal like its 7 siblings.
export const categoryColors: Record<Venue["category"], string> = {
  pantry: "#BE2D45",       // cranberry — spec §3.1
  grocery: "#1F4E8C",      // deep blue
  convenience: "#0F6573",  // teal
  farm: "#92591D",         // burnt amber
  garden: "#2C5F4F",       // sage (matches brand)
  edible_landscape: "#58772B", // olive
  meal_site: "#6B3FA0",    // plum
  blessing_box: "#C2447B", // raspberry
};

export const categoryIcon: Record<Venue["category"], string> = {
  pantry: "ShoppingBasket",
  grocery: "ShoppingCart",
  convenience: "Store",
  farm: "Tractor",
  garden: "Sprout",
  edible_landscape: "Leaf",
  meal_site: "Utensils",
  blessing_box: "Gift",
};
