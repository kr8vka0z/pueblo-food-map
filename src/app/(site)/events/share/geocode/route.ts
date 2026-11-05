/**
 * GET /events/share/geocode?q=<address> — the "Share an event" address check
 * (#883 spec change, 2026-11-05). The public twin of /api/admin/geocode
 * (which needs an admin session): same Census lookup (src/lib/censusGeocode.ts),
 * answers `{ ok: true, matches }` with only the matches inside Pueblo County's
 * box (the map's own PUEBLO_COUNTY_BBOX; Census's one-line lookup has no area
 * filter of its own), so a same-named street in another state is never offered.
 *
 * Bounded by checkFormRateLimit's D1 counters under its own name
 * ("event-geocode", EVENT_GEOCODE_CAPS: looser than the submit forms, since it
 * runs on every address typed) and a length cap. No Turnstile: the form's one
 * token belongs to the submit. The address is never logged; the IP only
 * enters the HMAC'd rate-limit key. `no-store`: answers depend on the caller's
 * budget.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { checkFormRateLimit, EVENT_GEOCODE_CAPS } from "@/lib/formRateLimit";
import { geocodeAddress } from "@/lib/censusGeocode";
import { isOutsideCounty } from "@/lib/mapBounds";
import { requestIp } from "@/lib/publicRequest";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const answer = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: NO_STORE });

// Census answers in capitals ("1001 E ABRIENDO AVE, PUEBLO, CO, 81004"); the sender's card should read like
// an address ("1001 E Abriendo Ave, Pueblo, CO 81004"). Directions (N, NE…) and the state stay capitals.
// ponytail: plain title case, so "MCCULLOCH" becomes "Mcculloch"; good enough for a draft the admin reviews.
const KEEP_CAPS = /^(N|S|E|W|NE|NW|SE|SW|CO)$/;
function tidyAddress(a: string): string {
  return a
    .replace(/,\s*(\d{5}(-\d{4})?)$/, " $1")
    .replace(/[A-Z0-9']+/g, (w) => (KEEP_CAPS.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > FIELD_LIMITS.SUGGEST_ADDRESS) return answer(400, { ok: false, error: "Bad request" });

  const secret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return answer(503, { ok: false, error: "unavailable" });
  }
  if (!(await checkFormRateLimit(db, secret, "event-geocode", requestIp(req), EVENT_GEOCODE_CAPS))) {
    return answer(429, { ok: false, error: "rate_limit" });
  }

  try {
    const matches = (await geocodeAddress(q))
      .filter((m) => !isOutsideCounty(m))
      .map((m) => ({ ...m, matchedAddress: tidyAddress(m.matchedAddress) }));
    return answer(200, { ok: true, matches });
  } catch {
    return answer(502, { ok: false, error: "lookup_failed" });
  }
}
