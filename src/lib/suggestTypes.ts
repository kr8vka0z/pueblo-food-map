/**
 * Shared constants for the suggest-a-venue form and submit route.
 *
 * Keeping venue category keys here avoids duplication between the client form
 * component and the server-side route handler.
 *
 * These keys match VenueCategory in src/types/venue.ts.
 */

export const VENUE_CATEGORIES = {
  pantry: "Food Pantry",
  grocery: "Grocery / Supermarket",
  convenience: "Convenience Store",
  farm: "Farm / Market",
  garden: "Community Garden",
  edible_landscape: "Edible Landscape",
  meal_site: "Meal Site",
} as const;

export type VenueCategoryKey = keyof typeof VENUE_CATEGORIES;
