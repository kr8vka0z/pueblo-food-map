import type { Venue } from "@/types/venue";
import { publishedVenues } from "@/data/published-venues";

// Public venue list, straight from the last published snapshot (see
// published-venues.ts's header); D1 is the sole SNAP/WIC source (#597).
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
// instantly distinguishable at a glance. Every hex here must match its
// globals.css --color-cat-* var (+ DESIGN.md's cat* token): design:drift only
// checks the CSS-var<->DESIGN.md pair, not this data map.
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
