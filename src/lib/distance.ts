// Haversine great-circle distance, in miles.
// Precise enough for sorting venue cards by proximity; not intended for
// turn-by-turn routing (OpenTripPlanner handles that).
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const EARTH_RADIUS_MILES = 3958.7613;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const aLat = toRad(a.lat);
  const bLat = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat + Math.cos(aLat) * Math.cos(bLat) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMiles(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
