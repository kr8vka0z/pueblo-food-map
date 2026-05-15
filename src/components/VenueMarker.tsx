"use client";

/**
 * VenueMarker — produces an L.divIcon from a Venue for use with
 * react-leaflet's <Marker>. Returns an SVG pin shape with the
 * category Lucide icon centered inside and an optional sage ring
 * when selected.
 *
 * This module must only be imported inside "use client" context because
 * it references `L` (Leaflet). Map.tsx lives behind next/dynamic ssr:false
 * so the import chain is safe.
 */

import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ShoppingBasket,
  ShoppingCart,
  Store,
  Tractor,
  Sprout,
  Leaf,
  Utensils,
} from "lucide-react";
import type { VenueCategory } from "@/types/venue";
import { categoryColors } from "@/data/venues";

type LucideProps = { size?: number; color?: string; strokeWidth?: number };
type LucideComponent = React.ComponentType<LucideProps>;

// Map category → Lucide icon component
const ICON_MAP: Record<VenueCategory, LucideComponent> = {
  pantry: ShoppingBasket,
  grocery: ShoppingCart,
  convenience: Store,
  farm: Tractor,
  garden: Sprout,
  edible_landscape: Leaf,
  meal_site: Utensils,
};

interface MarkerOptions {
  category: VenueCategory;
  selected?: boolean;
}

/** Build the inline SVG string for a venue pin. */
function buildPinHtml({
  color,
  selected,
  category,
}: {
  color: string;
  selected: boolean;
  category: VenueCategory;
}): string {
  // Default: 32×40px. Selected: 40×50px.
  const w = selected ? 40 : 32;
  const h = selected ? 50 : 40;
  const r = (w - 4) / 2;
  const cx = w / 2;
  const cy = r + 2;
  const iconSize = selected ? 14 : 11;

  const IconComponent = ICON_MAP[category];
  // Render the Lucide icon to an SVG string so we can embed it as a
  // nested <svg> inside the outer container SVG.
  const innerSvg = renderToStaticMarkup(
    <IconComponent size={iconSize} color="#FBFAF6" strokeWidth={2.5} />,
  );

  const ringColor = selected ? "#4A8466" : "#FBFAF6";
  const ringWidth = selected ? 3 : 1.5;
  const tipStrokeWidth = selected ? 2 : 1;

  // Nested SVG positioned at the icon center
  const iconX = cx - iconSize / 2;
  const iconY = cy - iconSize / 2;

  // Replace the outer <svg ...> wrapper tag so we can position it inside the pin
  const innerSvgBody = innerSvg.replace(
    /^<svg[^>]*>/,
    `<svg x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">`,
  );

  const filter = `drop-shadow(0 2px 4px rgba(26,24,23,0.25))`;

  return (
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ` +
    `xmlns="http://www.w3.org/2000/svg" style="filter:${filter}">` +
    // Pin head
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" ` +
    `stroke="${ringColor}" stroke-width="${ringWidth}"/>` +
    // Pin tip triangle
    `<polygon points="${cx - 5},${cy + r - 4} ${cx + 5},${cy + r - 4} ${cx},${h - 2}" ` +
    `fill="${color}" stroke="${ringColor}" stroke-width="${tipStrokeWidth}" stroke-linejoin="round"/>` +
    // Category icon (nested SVG)
    innerSvgBody +
    "</svg>"
  );
}

/** Build a Leaflet divIcon for a venue. */
export function createVenueIcon({
  category,
  selected = false,
}: MarkerOptions): L.DivIcon {
  const color = categoryColors[category];
  const w = selected ? 40 : 32;
  const h = selected ? 50 : 40;

  return L.divIcon({
    html: buildPinHtml({ color, selected, category }),
    className: "", // clear Leaflet's default white-box style
    iconSize: [w, h],
    iconAnchor: [w / 2, h], // anchor at the pin tip
    popupAnchor: [0, -(h + 4)],
  });
}
