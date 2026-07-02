/**
 * pfp-venues.ts — the 10 hand-curated Pueblo Food Project (CGSP) venue
 * records: community gardens and edible landscapes.
 *
 * Extracted out of venues.ts (#237 checkpoint d, the published-venues.ts
 * refactor — spec §7 step 1) so this data can live in a leaf module with no
 * dependency on venues.ts or published-venues.ts. WHY that matters: after
 * this refactor venues.ts imports FROM published-venues.ts, and
 * published-venues.ts needs pfpVenues — if pfpVenues stayed defined inside
 * venues.ts, that would be a circular import (venues.ts -> published-venues.ts
 * -> venues.ts) and published-venues.ts would read pfpVenues while it's
 * still in the temporal dead zone (venues.ts's own top-level code wouldn't
 * have reached the pfpVenues declaration yet), throwing at module load.
 * Moving the data here breaks the cycle. venues.ts re-exports pfpVenues
 * from here unchanged, so every existing importer keeps working with zero
 * changes: scripts/seed-admin-db.ts, src/__tests__/OperatorAttribution.test.tsx,
 * and src/__tests__/seed-admin-db.test.ts all still do
 * import { pfpVenues } from "@/data/venues" with no edits needed.
 *
 * v1 seed data — Pueblo Food Project Community Garden Sustainability Project (CGSP)
 * and edible landscapes. Source: https://pueblofoodproject.org/cgsp/ (verified 2026-05-12).
 *
 * Coordinates geocoded against Nominatim (OpenStreetMap) on 2026-05-14 via
 * scripts/geocode-pfp.py — see data/raw/pfp-geocodes.json for the full
 * audit trail (matched_query, display_name, OSM osm_id, miles shifted from
 * the prior placeholder). Ray Aguilera Community Garden uses a manual
 * coordinate supplied by PFP because the garden plot sits south of the
 * OSM Ray Aguilera Park centroid.
 */
import type { Venue } from "@/types/venue";

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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
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
    operator: "Pueblo Food Project",
    source: "pueblofoodproject.org/cgsp",
    last_verified: "2026-05-12",
  },
];
