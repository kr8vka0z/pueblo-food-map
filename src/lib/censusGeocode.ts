/**
 * censusGeocode.ts — the US Census geocoder lookup behind GET
 * /api/admin/geocode (the venue and event forms' "Find location") and the
 * "Share an event" convert (#883), which geocodes the sender's typed address
 * server-side. Why Census and not Mapbox, and the response shape: see the
 * route's header (src/app/api/admin/geocode/route.ts).
 */

const CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const CENSUS_BENCHMARK = "Public_AR_Current";
// The address picker in AddVenueForm.tsx renders every returned match as a
// button; capping keeps that list short enough to scan and the response
// small, without needing pagination for what is already a rare multi-match case.
const MAX_MATCHES = 5;
const FETCH_TIMEOUT_MS = 8000;

export interface GeocodeMatch {
  lat: number;
  lng: number;
  matchedAddress: string;
}

interface CensusAddressMatch {
  matchedAddress?: unknown;
  coordinates?: { x?: unknown; y?: unknown };
}

interface CensusGeocoderResponse {
  result?: { addressMatches?: unknown };
}

/** Round to 6 decimal places (~11cm) — ample precision for a venue pin, keeps the response compact. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Maps the Census response to this route's own shape and drops any entry
 * missing the fields we need — the upstream API is out of our control, so a
 * shape surprise here degrades to "fewer matches" rather than a 500.
 */
function parseMatches(data: CensusGeocoderResponse): GeocodeMatch[] {
  const raw = data.result?.addressMatches;
  if (!Array.isArray(raw)) return [];

  const matches: GeocodeMatch[] = [];
  for (const entry of raw as CensusAddressMatch[]) {
    const x = entry.coordinates?.x;
    const y = entry.coordinates?.y;
    const matchedAddress = entry.matchedAddress;
    if (typeof x !== "number" || typeof y !== "number" || typeof matchedAddress !== "string") continue;
    matches.push({ lat: round6(y), lng: round6(x), matchedAddress });
    if (matches.length >= MAX_MATCHES) break;
  }
  return matches;
}

/** Up to MAX_MATCHES matches for `q`. Throws GeocodeError on a network failure, timeout, non-2xx or non-JSON answer. */
export async function geocodeAddress(q: string): Promise<GeocodeMatch[]> {
  const url = `${CENSUS_GEOCODER_URL}?address=${encodeURIComponent(q)}&benchmark=${CENSUS_BENCHMARK}&format=json`;
  let data: CensusGeocoderResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new GeocodeError();
    data = (await res.json()) as CensusGeocoderResponse;
  } catch {
    throw new GeocodeError();
  }
  return parseMatches(data);
}

export class GeocodeError extends Error {
  constructor() {
    super("Geocoder request failed.");
    this.name = "GeocodeError";
  }
}
