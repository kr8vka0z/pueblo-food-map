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

// Exported (2026-09-19, Blessing Box card redesign) so BoxCardBody's plain
// address-as-directions-link can build the same deeplink this component's own
// Bus/Drive buttons use — one URL builder, not a second copy of the
// query-string logic. `travelmode` is OPTIONAL (fix pass, 2026-09-19): a box
// card omits it entirely rather than forcing "driving" — many box visitors
// walk or ride the bus, and Google Maps' own destination-only deeplink
// already lets the person pick a mode once it opens.
export function googleMapsUrl(
  lat: number,
  lng: number,
  travelmode?: "transit" | "driving" | "walking",
): string {
  // WHY URLSearchParams: avoids manual encoding bugs (e.g. commas in destination).
  // Using a base URL + params avoids the OpenNext routing trap of server-side
  // redirects on "/" — this is purely a client-side href value.
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
    ...(travelmode ? { travelmode } : {}),
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
