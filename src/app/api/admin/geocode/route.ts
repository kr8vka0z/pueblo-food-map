/**
 * GET /api/admin/geocode?q=<address> — server-side address -> lat/lng
 * lookup for the "Add a venue" form (#254 follow-up, admin/p2-add-venue).
 * Lets an admin type a street address and auto-fill the lat/lng fields
 * instead of hand-typing coordinates.
 *
 * Auth: getAdminDb() only, same choke point as every other admin route
 * (src/lib/adminDb.ts) — but NOT requireAdminOrigin(). That CSRF guard
 * exists for non-GET /api/admin/* mutations (an ambient session cookie
 * being ridden cross-site); this route only reads a public address and
 * writes nothing, so it has nothing for CSRF to protect (same reasoning
 * as GET /api/admin/whoami).
 *
 * Provider: the free US Census Bureau geocoder, not Mapbox. The app's
 * Mapbox public token (AGENTS.md "Mapbox Token Management") is
 * URL-restricted to the public hostnames and does NOT include
 * admin.pueblofoodmap.com, so a browser-side Mapbox call would fail here,
 * and Mapbox's secret token must never reach a Worker or client bundle.
 * The Census geocoder needs no key/token/URL allowlist to provision or
 * rotate and covers US street addresses (Pueblo is US) — a clean fit.
 * Grounded against the live Census Geocoder API docs
 * (geocoding.geo.census.gov) before building this: `onelineaddress` takes
 * `address`/`benchmark`/`format` query params and returns
 * `result.addressMatches[]`, each with `coordinates.x` (longitude),
 * `coordinates.y` (latitude), and `matchedAddress`.
 *
 * Census sends no CORS headers, so this call must happen server-side —
 * AddVenueForm.tsx cannot call the Census API directly from the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/adminDb";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";

// WHY force-dynamic: same reasoning as GET /api/admin/whoami — this route
// reads req.headers directly (not next/headers), so without this Next may
// statically optimize it and cache a stale 200 or 403 for every caller
// regardless of their own Access token.
export const dynamic = "force-dynamic";

const CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const CENSUS_BENCHMARK = "Public_AR_Current";
// The address picker in AddVenueForm.tsx renders every returned match as a
// button; capping keeps that list short enough to scan and the response
// small, without needing pagination for what is already a rare multi-match case.
const MAX_MATCHES = 5;
const FETCH_TIMEOUT_MS = 8000;

interface GeocodeMatch {
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

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await getAdminDb(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 });
  }

  const url = `${CENSUS_GEOCODER_URL}?address=${encodeURIComponent(q)}&benchmark=${CENSUS_BENCHMARK}&format=json`;

  let data: CensusGeocoderResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoder request failed." }, { status: 502 });
    }
    data = (await res.json()) as CensusGeocoderResponse;
  } catch {
    // Network failure, timeout, or a non-JSON body all collapse to one 502 —
    // none of these are the caller's fault, and AddVenueForm shows the same
    // "enter coordinates manually" fallback regardless of which occurred.
    return NextResponse.json({ error: "Geocoder request failed." }, { status: 502 });
  }

  return NextResponse.json({ matches: parseMatches(data) });
}
