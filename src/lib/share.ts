/**
 * Share helpers (#132) — share a venue via the Web Share API with a
 * copy-to-clipboard fallback. SSR-safe; reads navigator at call time so UA
 * capabilities (and test mocks) are evaluated per call, not at module load.
 */

export type ShareResult = "shared" | "copied" | "cancelled" | "unsupported";

/** Build the deep-link URL for a venue (the `/?venue=<id>` form from slice 9a). */
export function venueShareUrl(venueId: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://pueblofoodmap.com";
  return `${origin}/?venue=${encodeURIComponent(venueId)}`;
}

interface ShareVenueOptions {
  venueId: string;
  title: string;
  text?: string;
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
}: ShareVenueOptions): Promise<ShareResult> {
  const url = venueShareUrl(venueId);
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
