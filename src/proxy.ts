/**
 * Proxy: redirect legacy ?venue=<id> deep-links to canonical /venue/<id>.
 *
 * WHY: Before PR2, venue share URLs used the query-param form /?venue=<id>.
 * Crawlers and shared links that hit the old format should land on the rich
 * per-venue page, not the client-only homepage. A 308 Permanent Redirect is
 * appropriate — the resource has permanently moved to its canonical URL so
 * crawlers update their indexes.
 *
 * Named "proxy" (not "middleware") per the Next.js 16 file convention — the
 * old `middleware` name was deprecated in v16 and renamed to `proxy`.
 *
 * Scoped to matcher "/" only — zero impact on any other route.
 *
 * The in-app "View on the map" CTA uses the fragment form /#venue=<id>
 * intentionally so it bypasses this redirect (fragments are never sent to
 * the server).
 */

import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("venue");
  if (id) {
    const url = req.nextUrl.clone();
    url.pathname = `/venue/${encodeURIComponent(id)}`;
    url.searchParams.delete("venue"); // keep any other params (utm_*, etc.)
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
