"use client";

/**
 * VenueMarker — Mapbox GL JS marker component for a single venue.
 *
 * Wraps react-map-gl/mapbox's `Marker` with a <button> child so the marker
 * is natively keyboard-focusable (Tab) and activatable (Enter / Space).
 *
 * Visual design:
 *   - Default: Lucide MapPin filled with category color, white stroke, drop shadow.
 *   - Selected: same pin + 4px sage ring rendered as an outer SVG circle.
 *   - Hover: slight scale-up (CSS transform) for interactive affordance.
 *
 * Accessibility:
 *   - aria-label: "<name>, <readable-category>[, <distance>]"
 *   - Keyboard: Enter/Space fires onClick via onKeyDown handler.
 *   - The <button> element provides native role="button" — no ARIA role needed.
 *
 * #44 stub files removed in this PR:
 *   - src/types/leaflet.d.ts
 *   - src/__mocks__/leaflet.ts
 *   - vitest.config.mts leaflet alias
 */

import { memo, useRef, type KeyboardEvent } from "react";
import { Marker } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import type { Venue, VenueCategory } from "@/types/venue";
import { formatMiles } from "@/lib/distance";
import { t, type Locale } from "@/lib/i18n";

// ─── Category color map (mirrors --color-cat-* tokens in globals.css) ─────────
// Hardcoded hex values so the icon is renderable without DOM/CSSOM.
const CATEGORY_COLORS: Record<VenueCategory, string> = {
  pantry: "#BE2D45",
  grocery: "#1F4E8C",
  convenience: "#0F6573",
  farm: "#92591D",
  garden: "#2C5F4F",
  edible_landscape: "#58772B",
  meal_site: "#6B3FA0",
  blessing_box: "#C2447B",
};

// ─── Sage selected ring color (--color-sage-500) ──────────────────────────────
const SAGE_500 = "#4A8466";

// ─── Marker size constants ─────────────────────────────────────────────────────
const SIZE_DEFAULT = 28;
const SIZE_SELECTED = 36;
// Extra padding around the pin to accommodate the outer ring.
const RING_PAD = 5;
// Invisible tap-target floor (mobile review #13) — the default 28px pin sits
// well under 44px. Selected pins are already 36+2*RING_PAD=46px, over the
// floor, so this only ever grows the default state.
const MIN_HIT_SIZE = 44;

// ─── Props ────────────────────────────────────────────────────────────────────

interface VenueMarkerProps {
  venue: Venue;
  selected: boolean;
  /** Distance from user in miles, appended to aria-label when available. */
  distanceMiles?: number;
  onClick?: () => void;
  /** Stable venue selector callback (#291). */
  onSelect?: (id: string) => void;
  /** Called with venue.id on mouseenter/focusin — hover tooltip is managed in Map.tsx. */
  onHover?: (id: string) => void;
  /** Called on mouseleave/focusout — dismisses hover tooltip in Map.tsx. */
  onLeave?: () => void;
  locale?: Locale;
}

// ─── Component ────────────────────────────────────────────────────────────────

function VenueMarker({
  venue,
  selected,
  distanceMiles,
  onClick,
  onSelect,
  onHover,
  onLeave,
  locale = "en",
}: VenueMarkerProps) {
  const color = CATEGORY_COLORS[venue.category];
  // marker.category.* stays short; category.full.* is for chips and detail panels (#162).
  const readableName = t(`marker.category.${venue.category}`, locale);
  const pinSize = selected ? SIZE_SELECTED : SIZE_DEFAULT;
  const totalSize = selected ? pinSize + RING_PAD * 2 : pinSize;
  // The pin itself always renders at totalSize, in the same spot. hitSize only
  // grows the transparent button around it (bottom-anchored, see below) — the
  // visible pin never changes size or position.
  const hitSize = Math.max(totalSize, MIN_HIT_SIZE);
  const pinWrapperRef = useRef<HTMLSpanElement>(null);

  // Build aria-label: "<name>, <category>[, <distance>]"
  const distLabel = distanceMiles !== undefined ? formatMiles(distanceMiles) : "";
  const ariaLabel = distLabel
    ? `${venue.name}, ${readableName}, ${distLabel}`
    : `${venue.name}, ${readableName}`;

  function handleAction() {
    if (onClick) onClick();
    if (onSelect) onSelect(venue.id);
  }

  // Keyboard handler: fire click on Enter or Space (native <button> behaviour
  // covers this already in most browsers, but we add it explicitly for clarity
  // and to satisfy the acceptance criteria note in the issue).
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAction();
    }
  }

  // ─── Pin SVG ──────────────────────────────────────────────────────────────
  // When selected, wrap the MapPin in a larger SVG that adds the sage ring.
  // When not selected, render the MapPin directly.

  const pinElement = selected ? (
    <svg
      width={totalSize}
      height={totalSize}
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {/* Sage ring sits behind the pin */}
      <circle
        cx={totalSize / 2}
        cy={totalSize / 2}
        r={totalSize / 2 - 2}
        fill="none"
        stroke={SAGE_500}
        strokeWidth={4}
      />
      {/* Offset the MapPin to sit centred within the ring padding */}
      <foreignObject x={RING_PAD} y={RING_PAD} width={pinSize} height={pinSize}>
        <MapPin
          size={pinSize}
          fill={color}
          color="#FFFFFF"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </foreignObject>
    </svg>
  ) : (
    <MapPin
      size={pinSize}
      fill={color}
      color="#FFFFFF"
      strokeWidth={1.5}
      aria-hidden="true"
      style={{ display: "block" }}
    />
  );

  return (
    <Marker
      longitude={venue.lng}
      latitude={venue.lat}
      anchor="bottom"
    >
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={handleAction}
        onKeyDown={handleKeyDown}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          // flex + align-items:flex-end keeps the visible pin flush to the
          // BOTTOM of this (possibly larger) box — Mapbox's anchor="bottom"
          // pins that same bottom edge to the venue's coordinate, so growing
          // the box only ever adds invisible space above/beside the pin; the
          // pin's rendered tip never moves off the coordinate (mobile review #13).
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          width: `${hitSize}px`,
          height: `${hitSize}px`,
          lineHeight: 0,
        }}
        onMouseEnter={() => {
          if (pinWrapperRef.current) pinWrapperRef.current.style.transform = "scale(1.15)";
          onHover?.(venue.id);
        }}
        onMouseLeave={() => {
          if (pinWrapperRef.current) pinWrapperRef.current.style.transform = "scale(1)";
          onLeave?.();
        }}
        onFocus={() => onHover?.(venue.id)}
        onBlur={() => onLeave?.()}
      >
        {/* This wrapper is exactly totalSize — the pin's real visual box.
            Hover-scale now targets it directly (not the enlarged button)
            so the zoom still happens around the pin itself. */}
        <span
          ref={pinWrapperRef}
          style={{
            display: "block",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
            transform: "scale(1)",
            transition: "transform 0.1s ease",
            width: `${totalSize}px`,
            height: `${totalSize}px`,
            lineHeight: 0,
          }}
        >
          {pinElement}
        </span>
      </button>
    </Marker>
  );
}

export default memo(VenueMarker);
