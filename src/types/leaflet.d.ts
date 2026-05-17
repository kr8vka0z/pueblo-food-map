/**
 * Minimal Leaflet type stubs — kept only to allow VenueMarker.tsx and its
 * tests to compile after Leaflet was removed in #44.
 *
 * VenueMarker.tsx is intentionally NOT modified in #44 (it will be rewritten in
 * #45). This stub covers the exact surface VenueMarker uses so TypeScript stays
 * green without reinstalling the leaflet package.
 *
 * TODO(#45): delete this file once VenueMarker is rewritten for Mapbox.
 */

declare namespace L {
  interface DivIconOptions {
    html?: string;
    className?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
  }

  interface DivIcon {
    options: DivIconOptions;
  }

  interface ControlOptions {
    position?: string;
    prefix?: boolean | string;
  }

  interface Control {
    addTo(map: Map): this;
    remove(): this;
    getContainer(): HTMLElement | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ControlAttribution extends Control {}

  /** Minimal Map interface (used by DesktopVenueWindow stub) */
  interface Map {
    latLngToContainerPoint(latlng: [number, number]): { x: number; y: number };
    getContainer(): HTMLElement;
    on(event: string, fn: () => void): this;
    off(event: string, fn: () => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  interface ControlStatic {
    attribution(options?: ControlOptions): ControlAttribution;
  }

  const control: ControlStatic;

  function divIcon(options: DivIconOptions): DivIcon;
}

declare module "leaflet" {
  export = L;
}
