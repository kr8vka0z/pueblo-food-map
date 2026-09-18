/**
 * Share helpers (#132) — share a venue via the Web Share API with a
 * copy-to-clipboard fallback. SSR-safe; reads navigator at call time so UA
 * capabilities (and test mocks) are evaluated per call, not at module load.
 */

export type ShareResult = "shared" | "copied" | "cancelled" | "unsupported";

/**
 * Build the canonical share URL for a venue: /venue/<id>, or /box/<id> for a
 * blessing box.
 *
 * WHY: Changed from /?venue=<id> to /venue/<id> in PR2 (#164 6.4). The new
 * form is the rich per-venue page — better crawlability, better link previews,
 * and a permanent redirect from the old form covers legacy shares.
 *
 * WHY /box/<id> instead of /venue/<id> for a box (map-first rework,
 * 2026-09-18): /venue/[id]/page.tsx is a STATIC route restricted to known
 * venue ids (generateStaticParams + dynamicParams=false) — a box's id was
 * never in that build-time set (boxes are live, not published), so it would
 * 404. /box/<id> still exists as its own route (BoxRedirectClient.tsx) with
 * box-specific generateMetadata, which client-redirects to /?venue=<id> —
 * the extra hop is the price of keeping a real per-box link preview.
 */
export function venueShareUrl(venueId: string, isBox = false): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://pueblofoodmap.com";
  const path = isBox ? "box" : "venue";
  return `${origin}/${path}/${encodeURIComponent(venueId)}`;
}

interface ShareVenueOptions {
  venueId: string;
  title: string;
  text?: string;
  /** See venueShareUrl's own header — a blessing box shares /box/<id>, not /venue/<id>. */
  isBox?: boolean;
}

/**
 * Try the native share sheet first; if it's absent or fails (other than the
 * user dismissing it), copy the link instead. Returns what happened so the UI
 * can show a "Link copied" confirmation only when appropriate.
 */
export async function shareVenue({
  venueId,
  title,
  text,
  isBox = false,
}: ShareVenueOptions): Promise<ShareResult> {
  const url = venueShareUrl(venueId, isBox);
  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  // Preferred: native share sheet (mobile + some desktop browsers).
  if (nav && typeof nav.share === "function") {
    try {
      await nav.share({ title, text, url });
      return "shared";
    } catch (err) {
      // User dismissed the sheet — not an error; do NOT fall through to copy.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
      // Any other failure: fall through to the clipboard path.
    }
  }

  // Fallback: copy the link to the clipboard.
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
    try {
      await nav.clipboard.writeText(url);
      return "copied";
    } catch {
      return "unsupported";
    }
  }

  return "unsupported";
}
