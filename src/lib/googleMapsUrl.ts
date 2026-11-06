/**
 * googleMapsUrl.ts — the one Google Maps directions deeplink builder.
 *
 * WHY it lives here and not in DirectionButtons.tsx: that file is a "use
 * client" module, and a function imported from a client module cannot be
 * CALLED from a server component (Next hands the server a reference, not the
 * function). The event page (#762) is a server component that needs the same
 * URL the event card builds, so the pure function sits in a plain lib file and
 * DirectionButtons re-exports it — every existing import keeps working.
 */

// `travelmode` is optional: a box card omits it so Google Maps lets the
// person pick walk/bus/drive once it opens.
export function googleMapsUrl(
  lat: number,
  lng: number,
  travelmode?: "transit" | "driving" | "walking",
): string {
  // WHY URLSearchParams: avoids manual encoding bugs (e.g. commas in destination).
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
    ...(travelmode ? { travelmode } : {}),
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
