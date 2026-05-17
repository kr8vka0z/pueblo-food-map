/**
 * Leaflet runtime stub for Vite/Vitest — used after Leaflet was removed in #44.
 *
 * VenueMarker.tsx and its test still reference the "leaflet" module.
 * VenueMarker will be rewritten in #45 at which point this stub and
 * src/types/leaflet.d.ts can both be deleted.
 *
 * TODO(#45): delete this file once VenueMarker is rewritten for Mapbox.
 */

const L = {
  divIcon: (opts: unknown) => ({ _iconOpts: opts }),
  control: {
    attribution: () => ({
      addTo: () => ({}),
      remove: () => ({}),
      getContainer: () => undefined,
    }),
  },
};

export default L;
export const { divIcon, control } = L;
