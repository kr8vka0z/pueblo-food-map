/**
 * safeUrl — allow-list URL scheme guard.
 *
 * Venue website URLs come from OpenStreetMap, which anyone can edit.
 * A malicious editor could set website=javascript:alert(1) and the URL
 * would render as a tappable link. This guard rejects everything except
 * http:// and https://.
 *
 * Returns the original URL string if safe, null otherwise.
 * Call sites: BottomSheet.tsx, DesktopVenueWindow.tsx (render),
 * and scripts/ingest-osm-grocery.py (ingest — separate enforcement there).
 */

export function safeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  // URL constructor throws on malformed input — treat that as unsafe.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Only http and https are permitted.
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return url;
  }
  return null;
}
