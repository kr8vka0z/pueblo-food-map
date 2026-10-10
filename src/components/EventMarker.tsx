"use client";

/**
 * EventMarker — the star pin for one special event (#758, umbrella #156).
 *
 * A DOM <Marker> wrapping a <button>, same approach as VenueMarker (native
 * keyboard activation, no ARIA role needed). Larger than a place pin (44px
 * coming up, 52px going on now) in the owner-approved orange, so an event
 * reads as different from a place at arm's length. While live it also carries
 * two pulsing rings (one CSS keyframe, transform/opacity only) and a NOW label.
 * All visuals live in globals.css (`.pfm-event-*`) so the colors come from the
 * `--color-event-*` tokens and the global prefers-reduced-motion block calms
 * the rings with no per-component guard.
 *
 * The label text and accessible name are computed by the parent (EventLayer)
 * and passed in as strings: this component stays memo-friendly (primitive props
 * plus one stable event object), so the once-a-minute clock re-renders only
 * the pins whose text actually changed.
 */

import { memo } from "react";
import { Marker } from "react-map-gl/mapbox";
import type { PublicEvent } from "@/lib/events";

// Pin height in px. Place pins are 28 (36 selected), so events read larger.
const SIZE_UPCOMING = 44;
const SIZE_LIVE = 52;
// Touch-target floor: the 44px pin sits in an invisible 48px button.
const MIN_HIT_SIZE = 48;

// Lucide MapPin outline (24 box) with a five-point star in the head, drawn in
// a viewBox cropped to the pin so the tip sits on the bottom edge. The
// Marker anchor="bottom" then puts that tip exactly on the event's coordinate.
const PIN_PATH =
  "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0";
const STAR_POINTS =
  "12,5.6 13.12,8.46 16.19,8.64 13.81,10.59 14.59,13.56 12,11.9 9.41,13.56 10.19,10.59 7.82,8.64 10.88,8.46";
const VIEWBOX_W = 20;
const VIEWBOX_H = 21.5;

interface EventMarkerProps {
  event: PublicEvent;
  live: boolean;
  selected: boolean;
  /** Visible text on the pin ("Sat 2 PM" / "NOW, until 2 PM"). */
  label: string;
  /** Accessible name: the event name and when. */
  ariaLabel: string;
  onSelect: (id: string) => void;
}

function EventMarker({ event, live, selected, label, ariaLabel, onSelect }: EventMarkerProps) {
  const size = live ? SIZE_LIVE : SIZE_UPCOMING;
  const hit = Math.max(size, MIN_HIT_SIZE);

  return (
    <Marker
      longitude={event.lng}
      latitude={event.lat}
      anchor="bottom"
      // Above every place pin (those use the default stacking), and the
      // selected / live pin above the other event pins.
      style={{ zIndex: selected ? 4 : live ? 3 : 2 }}
    >
      <button
        type="button"
        className="pfm-event-pin"
        data-live={live ? "true" : "false"}
        data-selected={selected ? "true" : "false"}
        aria-label={ariaLabel}
        aria-pressed={selected}
        onClick={() => onSelect(event.id)}
        style={{ width: hit, height: hit }}
      >
        <span className="pfm-event-pin__body" style={{ ["--pin" as string]: `${size}px` }}>
          {live && (
            <>
              <span className="pfm-event-ring" aria-hidden="true" />
              <span className="pfm-event-ring pfm-event-ring--late" aria-hidden="true" />
            </>
          )}
          {selected && <span className="pfm-event-selected" aria-hidden="true" />}
          <svg
            className="pfm-event-pin__svg"
            width={(size * VIEWBOX_W) / VIEWBOX_H}
            height={size}
            viewBox={`2 1 ${VIEWBOX_W} ${VIEWBOX_H}`}
            aria-hidden="true"
          >
            <path d={PIN_PATH} className="pfm-event-pin__shape" />
            <polygon points={STAR_POINTS} className="pfm-event-pin__star" />
          </svg>
          <span className="pfm-event-label" aria-hidden="true">{label}</span>
        </span>
      </button>
    </Marker>
  );
}

export default memo(EventMarker);
