import type { Venue } from "@/types/venue";
import { groceryOsmVenues } from "@/data/grocery-osm";

// v1 seed data — Pueblo Food Project Community Garden Sustainability Project (CGSP)
// and edible landscapes. Source: https://pueblofoodproject.org/cgsp/ (verified 2026-05-12).
//
// Coordinates are approximate, derived from the listed street addresses.
// Will be replaced with precise geocodes during the build-time data pipeline
// (Phase 1b — see PRD-2026-05-12-pueblo-food-map §6).
export const pfpVenues: Venue[] = [
  {
    id: "garden-rmser",
    name: "RMSER Community Garden",
    category: "garden",
    lat: 38.2790,
    lng: -104.6068,
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
    lat: 38.2742,
    lng: -104.6160,
    address: "5th & Hudson, Pueblo, CO",
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
    lat: 38.2779,
    lng: -104.6080,
    address: "Lake Ave near the Fire Station, Pueblo, CO",
    email: "garden@pueblofoodproject.org",
    url: "https://pueblofoodproject.org/cgsp/",
    notes:
      "Open to public. Produce donated to food pantries. Address needs precise geocode. Partner: Pueblo County Extension Master Gardener Program.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
  {
    id: "garden-midway",
    name: "Midway Community Garden",
    category: "garden",
    lat: 38.2563,
    lng: -104.6398,
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
    lat: 38.2614,
    lng: -104.6125,
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
    lat: 38.2459,
    lng: -104.6354,
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
    lat: 38.2885,
    lng: -104.6094,
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
    lat: 38.2722,
    lng: -104.6105,
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
    lat: 38.2697,
    lng: -104.6309,
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
    lat: 38.2702,
    lng: -104.6093,
    address: "400 S Union Ave, Pueblo, CO 81003",
    url: "https://pueblofoodproject.org/cgsp/",
    notes: "Edible landscape at Pueblo's first food hall.",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
];

// Combined venue list rendered on the map. PFP first so its richer metadata
// (notes, partnerships) wins any future de-dup pass.
export const venues: Venue[] = [...pfpVenues, ...groceryOsmVenues];

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
  pantry: "#e11d48", // rose-600
  grocery: "#2563eb", // blue-600
  convenience: "#0891b2", // cyan-600
  farm: "#ca8a04", // yellow-600
  garden: "#16a34a", // green-600
  edible_landscape: "#65a30d", // lime-600
  meal_site: "#9333ea", // purple-600
};
