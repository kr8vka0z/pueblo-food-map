import type { Venue } from "@/types/venue";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";

// v1 seed data — Pueblo Food Project Community Garden Sustainability Project (CGSP)
// and edible landscapes. Source: https://pueblofoodproject.org/cgsp/ (verified 2026-05-12).
//
// Coordinates geocoded against Nominatim (OpenStreetMap) on 2026-05-14 via
// scripts/geocode-pfp.py — see data/raw/pfp-geocodes.json for the full
// audit trail (matched_query, display_name, OSM osm_id, miles shifted from
// the prior placeholder). Ray Aguilera Community Garden uses a manual
// coordinate supplied by PFP because the garden plot sits south of the
// OSM Ray Aguilera Park centroid.
export const pfpVenues: Venue[] = [
  {
    id: "garden-rmser",
    name: "RMSER Community Garden",
    category: "garden",
    lat: 38.254427,
    lng: -104.620381,
    address: "330 Lake Ave, Pueblo, CO 81004",
    hours_weekly: { wed: ["16:00-19:00"] },
    email: "garden@pueblofoodproject.org",
    url: "https://pueblofoodproject.org/cgsp/",
    notes:
      "Weekly volunteer work days Wed 4-7pm. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "garden-la-familia",
    name: "La Familia Community Garden",
    category: "garden",
    lat: 38.271769,
    lng: -104.596439,
    address: "814 E 5th St, Pueblo, CO 81001",
    email: "garden@pueblofoodproject.org",
    url: "https://pueblofoodproject.org/cgsp/",
    notes:
      "Open to public. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "garden-ray-aguilera",
    name: "Ray Aguilera Community Garden",
    category: "garden",
    lat: 38.231170,
    lng: -104.625036,
    address: "Lake Ave near the Fire Station, Pueblo, CO",
    email: "garden@pueblofoodproject.org",
    url: "https://pueblofoodproject.org/cgsp/",
    notes:
      "Open to public. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "garden-midway",
    name: "Midway Community Garden",
    category: "garden",
    lat: 38.260521,
    lng: -104.621467,
    address: "110 Midway Dr, Pueblo, CO",
    email: "garden@pueblofoodproject.org",
    url: "https://pueblofoodproject.org/cgsp/",
    notes:
      "Open to public. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "garden-steelworks",
    name: "Steelworks Museum Garden",
    category: "garden",
    lat: 38.237869,
    lng: -104.612428,
    address: "215 Canal St, Pueblo, CO 81004",
    email: "garden@pueblofoodproject.org",
    url: "https://pueblofoodproject.org/cgsp/",
    notes:
      "Open to public. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "garden-bethany-lutheran",
    name: "Bethany Lutheran Church Garden",
    category: "garden",
    lat: 38.297496,
    lng: -104.591039,
    address: "1802 Sheridan Rd, Pueblo, CO 81001",
    email: "garden@pueblofoodproject.org",
    url: "https://pueblofoodproject.org/cgsp/",
    notes:
      "Open to public. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "landscape-mineral-palace",
    name: "Mineral Palace Park Edible Landscape",
    category: "edible_landscape",
    lat: 38.283229,
    lng: -104.607842,
    address: "Mineral Palace Park, Pueblo, CO",
    url: "https://pueblofoodproject.org/cgsp/",
    notes: "Public edible landscape installation.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "landscape-central-plaza",
    name: "Central Plaza Edible Landscape",
    category: "edible_landscape",
    lat: 38.268172,
    lng: -104.608897,
    address: "1st & Main, Pueblo, CO",
    url: "https://pueblofoodproject.org/cgsp/",
    notes: "Public edible landscape installation in downtown Pueblo.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "landscape-jj-raigoza",
    name: "JJ Raigoza Park Edible Landscape",
    category: "edible_landscape",
    lat: 38.222062,
    lng: -104.617207,
    address: "600 Maryland Ave, Pueblo, CO",
    url: "https://pueblofoodproject.org/cgsp/",
    notes: "Public edible landscape installation.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "landscape-fuel-iron",
    name: "Fuel & Iron Edible Landscape",
    category: "edible_landscape",
    lat: 38.262121,
    lng: -104.615912,
    address: "400 S Union Ave, Pueblo, CO 81003",
    url: "https://pueblofoodproject.org/cgsp/",
    notes: "Edible landscape at Pueblo's first food hall.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
];

// Combined venue list rendered on the map. PFP first so its richer metadata
// (notes, partnerships) wins any future de-dup pass.
export const venues: Venue[] = [...pfpVenues, ...groceryOsmVenues, ...plentifulPantries];

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
