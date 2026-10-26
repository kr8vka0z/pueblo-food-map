// categories.ts — the one source for venue category labels and pin colors.
//
// WHY its own module (#721): these maps used to live in src/data/venues.ts next
// to the whole published venue list, and the bundler keeps a module's exports
// together in one chunk. Every client component that only wanted a dot color
// (marker, filter panel, cards, menu) therefore downloaded all ~100 venues.
// src/data/venues.ts re-exports both maps so server code keeps one import.
import type { VenueCategory } from "@/types/venue";

export const categoryLabels: Record<VenueCategory, string> = {
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
// instantly distinguishable at a glance. Every hex here must match its
// globals.css --color-cat-* var (+ DESIGN.md's cat* token): design:drift only
// checks the CSS-var<->DESIGN.md pair, not this data map.
export const categoryColors: Record<VenueCategory, string> = {
  pantry: "#BE2D45",       // cranberry — spec §3.1
  grocery: "#1F4E8C",      // deep blue
  convenience: "#0F6573",  // teal
  farm: "#92591D",         // burnt amber
  garden: "#2C5F4F",       // sage (matches brand)
  edible_landscape: "#58772B", // olive
  meal_site: "#6B3FA0",    // plum
  blessing_box: "#C2447B", // raspberry
};
