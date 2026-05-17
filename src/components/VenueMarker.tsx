"use client";

/**
 * VenueMarker — produces an L.divIcon from a Venue for use with
 * react-leaflet's <Marker>. Returns a Lucide MapPin SVG pin colored by
 * category, with a 4px sage outer ring on the selected state.
 *
 * This module must only be imported inside "use client" context because
 * it references `L` (Leaflet). Map.tsx lives behind next/dynamic ssr:false
 * so the import chain is safe.
 *
 * Keyboard accessibility:
 *   The divIcon container div carries tabindex="0" so it participates in
 *   keyboard tab order. Enter→click binding is NOT wired here because the
 *   HTML string has no access to Leaflet's event system. Map.tsx should
 *   add `keydown` to its eventHandlers to call onSelectVenue on Enter/Space.
 *   See PR 4 notes — flagged for PR 2 / post-merge wiring in Map.tsx.
 */

import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin } from "lucide-react";
import type { VenueCategory } from "@/types/venue";

// ─── Category color map (mirrors --color-cat-* tokens in globals.css) ─────────
// Hardcoded hex values so the icon is renderable during SSR (no DOM/CSSOM).
const CATEGORY_COLORS: Record<VenueCategory, string> = {
  pantry:           "#BE2D45",
  grocery:          "#1F4E8C",
  convenience:      "#0F6573",
  farm:             "#92591D",
  garden:           "#2C5F4F",
  edible_landscape: "#58772B",
  meal_site:        "#6B3FA0",
};

// ─── Accessible readable-name labels ──────────────────────────────────────────
const CATEGORY_READABLE: Record<VenueCategory, string> = {
  pantry:           "Food pantry",
  grocery:          "Grocery store",
  convenience:      "Convenience store",
  farm:             "Farm",
  garden:           "Community garden",
  edible_landscape: "Edible landscape",
  meal_site:        "Meal site",
};

// ─── Sage selected ring color (--color-sage-500) ──────────────────────────────
const SAGE_500 = "#4A8466";

// ─── Marker size constants ─────────────────────────────────────────────────────
// Default: 28×28. Selected: 36×36 (spec §PR4).
const SIZE_DEFAULT = 28;
const SIZE_SELECTED = 36;
// Ring padding on the outer ring (px on each side)
const RING_PAD = 5;

interface MarkerOptions {
  /** Venue category — drives fill color. */
  category: VenueCategory;
  /** Whether this marker is the currently selected venue. */
  selected?: boolean;
  /**
   * Venue name, used in aria-label: "<name>, <readable-category>".
   * If omitted the aria-label falls back to the readable category name alone.
   * Pass venue.name from Map.tsx for full accessibility.
   */
  name?: string;
}

/**
 * Build the divIcon HTML for a venue pin.
 *
 * Structure (outermost → innermost):
 *   <div role="img" aria-label="…" tabindex="0">
 *     <svg>                          ← ring SVG (selected only, else transparent)
 *       <circle …/>                  ← sage 4px ring
 *       <g transform="translate(…)"> ← offset MapPin inside ring area
 *         <!-- Lucide MapPin SVG contents -->
 *       </g>
 *     </svg>
 *   </div>
 *
 * The outer <div> carries tabindex="0" so that keyboard users can Tab to the
 * marker. Enter→click must be wired by Map.tsx via marker.getElement().
 */
function buildPinHtml({
  category,
  selected,
  name,
}: Required<Pick<MarkerOptions, "category" | "selected">> &
  Pick<MarkerOptions, "name">): string {
  const color = CATEGORY_COLORS[category];
  const pinSize = selected ? SIZE_SELECTED : SIZE_DEFAULT;
  // When selected, the container must be larger to accommodate the ring.
  const totalSize = selected ? pinSize + RING_PAD * 2 : pinSize;
  const readableName = CATEGORY_READABLE[category];
  const ariaLabel = name ? `${name}, ${readableName}` : readableName;

  // Render Lucide MapPin to an SVG string.
  // MapPin renders a filled teardrop/drop-pin shape. We pass:
  //   fill = category color (opaque fill)
  //   color = white (stroke color for the inner circle cutout)
  //   strokeWidth = 1.5 (white border for legibility on varied tile backgrounds)
  const mapPinSvg = renderToStaticMarkup(
    <MapPin
      size={pinSize}
      fill={color}
      color="#FFFFFF"
      strokeWidth={1.5}
      aria-hidden="true"
    />,
  );

  // Drop shadow via CSS filter on the container div.
  const shadowStyle = "filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))";

  if (!selected) {
    // Default state: plain MapPin, no ring.
    return (
      `<div role="img" aria-label="${ariaLabel}" tabindex="0" ` +
      `style="width:${pinSize}px;height:${pinSize}px;${shadowStyle};line-height:0">` +
      mapPinSvg +
      `</div>`
    );
  }

  // Selected state: MapPin offset inside ring area, plus sage circle ring.
  // Ring drawn as SVG circle on a larger canvas so it sits behind the pin.
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  const ringR = cx - 2; // 2px inset so ring doesn't clip

  // Translate the MapPin SVG so it's centered within the larger container.
  const pinOffset = RING_PAD;

  // Rewrite the MapPin SVG's root <svg> element to add a translate so it
  // sits centered in the totalSize canvas.
  const shiftedPin = mapPinSvg.replace(
    /^<svg([^>]*)>/,
    `<svg$1 x="${pinOffset}" y="${pinOffset}">`,
  );

  const ringSvg =
    `<svg width="${totalSize}" height="${totalSize}" ` +
    `viewBox="0 0 ${totalSize} ${totalSize}" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" ` +
    `stroke="${SAGE_500}" stroke-width="4"/>` +
    shiftedPin +
    `</svg>`;

  return (
    `<div role="img" aria-label="${ariaLabel}" tabindex="0" ` +
    `style="width:${totalSize}px;height:${totalSize}px;${shadowStyle};line-height:0">` +
    ringSvg +
    `</div>`
  );
}

/**
 * Build a Leaflet divIcon for a venue.
 *
 * @example
 * ```tsx
 * const icon = createVenueIcon({ category: venue.category, selected: isSelected, name: venue.name });
 * ```
 */
export function createVenueIcon({
  category,
  selected = false,
  name,
}: MarkerOptions): L.DivIcon {
  const pinSize = selected ? SIZE_SELECTED : SIZE_DEFAULT;
  const totalSize = selected ? pinSize + RING_PAD * 2 : pinSize;
  const halfTotal = totalSize / 2;

  return L.divIcon({
    html: buildPinHtml({ category, selected, name }),
    className: "", // clear Leaflet's default white-box style
    iconSize: [totalSize, totalSize],
    // Anchor at the bottom-center of the pin tip.
    // MapPin's tip falls at the bottom of the SVG bounding box.
    iconAnchor: [halfTotal, totalSize],
    popupAnchor: [0, -(totalSize + 4)],
  });
}
