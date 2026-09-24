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
// auto-generated OSM / Plentiful data (#127).
//
// NULL-GUARDED, not unconditional (#597; spec §7 step 1, "NB4"; Kyle's
// product decision, confirmed #238: "admin edits win"). D1's
// accepts_snap/accepts_wic are now admin-editable (AddVenueForm.tsx,
// adminVenueValidation.ts) and migrations/0014 copies this overlay's values
// into D1 where D1 was NULL — so an explicit D1 value (including one an
// admin later sets to correct a wrong overlay guess) must win, and the
// overlay may only fill in where the published snapshot still has no
// opinion (`undefined`, the publish serializer's mapping for a NULL D1
// column — publishVenues.ts).
//
// INTERIM STATE, not the final form: published-venues.ts carries
// non-undefined accepts_snap for only 2 of the 49 venues this overlay
// covers today (osm-node-12599529644, osm-way-971896407 — both `true`,
// coincidentally matching the overlay's own guess, accepts_wic still
// undefined on both) — verified by direct comparison against
// benefit-flags.ts, not assumed. So this guard is NOT a pure no-op: for
// those 2 rows, 0014 will fill the still-NULL accepts_wic and bump
// updated_at the moment it's applied (not deferred to "the next publish"),
// even with zero new admin edits. For the other 47, the guard is inert
// until 0014 lands on production AND an admin clicks Publish (AGENTS.md's
// promotion checklist). Once that publish happens for all 49,
// benefit-flags.ts, this overlay application, and scripts/match-benefits.py
// all become dead weight and should be deleted (documented as the next
// step in AGENTS.md's promotion checklist) — the same information then
// lives in D1, as a permanently admin-editable field.
//
// Exported (not inlined into the .map() below) so venuesBenefitOverlay.test.ts
// can exercise both branches — overlay fills an unset field, overlay never
// overwrites an already-set one — directly with synthetic fixtures, rather
// than relying on the 2 real rows above (which only cover accepts_snap,
// never accepts_wic, and could change out from under a real-data test on
// the next publish).
export function withBenefitFlagsOverlay(v: Venue, f: { snap: boolean; wic: boolean } | undefined): Venue {
  if (!f) return v;
  return {
    ...v,
    accepts_snap: v.accepts_snap === undefined ? f.snap : v.accepts_snap,
    accepts_wic: v.accepts_wic === undefined ? f.wic : v.accepts_wic,
  };
}

export const venues: Venue[] = publishedVenues.map((v) => withBenefitFlagsOverlay(v, benefitFlags[v.id]));

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
