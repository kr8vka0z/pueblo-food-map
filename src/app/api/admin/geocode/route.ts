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
 * writes nothing, so it has nothing for CSRF to protect.
 *
 * Provider: the free US Census Bureau geocoder, not Mapbox. Admin now
 * serves at the apex `/admin` path, which the app's Mapbox public token
 * (AGENTS.md "Secrets", Mapbox) does cover — but that token's
 * secret counterpart still must never reach a Worker or client bundle just
 * to add a geocoding scope. The Census geocoder needs no key/token/URL
 * allowlist to provision or rotate and covers US street addresses (Pueblo
 * is US) — a clean fit with nothing new to rotate or leak.
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
import { geocodeAddress } from "@/lib/censusGeocode";

// WHY force-dynamic: this route reads req.headers directly (not
// next/headers), so without this Next may statically optimize the GET
// handler and cache a stale 200 or 403 for every caller regardless of
// their own session. It must evaluate fresh on every request.
export const dynamic = "force-dynamic";

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

  try {
    return NextResponse.json({ matches: await geocodeAddress(q) });
  } catch {
    // Network failure, timeout, a non-2xx or a non-JSON body all collapse to
    // one 502 — none of these are the caller's fault, and the forms show the
    // same "enter it another way" fallback regardless of which occurred.
    return NextResponse.json({ error: "Geocoder request failed." }, { status: 502 });
  }
}
