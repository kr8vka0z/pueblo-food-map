"use client";

/**
 * EventLayer — every special-event star pin on the map, plus the one clock that
 * keeps them honest (#758, umbrella #156).
 *
 * Rendered inside <MapGL> by Map.tsx after the place pins, so event markers sit
 * above them. It owns the minute clock (useMinuteClock) on purpose: the tick
 * re-renders THIS component only, never Map or the place pins, and EventMarker
 * is memoized on primitive props, so a minute that changes nothing repaints
 * nothing. One timer for the whole map, not one per pin. Map.tsx mounts this
 * only when there is at least one event, so an empty, failed or not-yet-loaded
 * feed means no timer and no DOM at all.
 *
 * Selecting a pin selects and centers it; the card itself is opened by
 * MapWrapper off the selection (#759).
 */

import { useCallback, useEffect, useMemo } from "react";
import { useMap } from "react-map-gl/mapbox";
import EventMarker from "@/components/EventMarker";
import type { PublicEvent } from "@/lib/events";
import type { Locale } from "@/lib/i18n";
import { pinAriaLabel, pinLabel, pinsAt } from "@/lib/eventPins";
import { useMinuteClock } from "@/lib/useMinuteClock";
import { MOBILE_QUERY } from "@/lib/useMediaQuery";

interface EventLayerProps {
  events: readonly PublicEvent[];
  selectedEventId: string | null;
  /** Pass null to deselect (tapping the selected pin again). */
  onSelectEvent: (id: string | null) => void;
  locale: Locale;
  /** The Events filter is on: pin every upcoming event, not just those within the 7-day window (#761). */
  allUpcoming?: boolean;
}

export default function EventLayer({ events, selectedEventId, onSelectEvent, locale, allUpcoming = false }: EventLayerProps) {
  const { current: map } = useMap();
  const now = useMinuteClock();
  const pins = useMemo(() => pinsAt(events, now, allUpcoming ? Infinity : undefined), [events, now, allUpcoming]);

  // Centering depends on the selected pin's id and position, not on `pins`
  // itself, so the minute tick never re-centers a map the visitor has panned.
  const selected = pins.find((p) => p.event.id === selectedEventId)?.event;
  const selId = selected?.id;
  const selLng = selected?.lng;
  const selLat = selected?.lat;
  useEffect(() => {
    if (!map || selId === undefined || selLng === undefined || selLat === undefined) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // On a phone the event card (#759) covers the lower ~45% of the screen, so
    // a pin centered on the map would sit under it: lift the target into the
    // visible strip above. The desktop panel is at the side and needs none.
    const phone = window.matchMedia(MOBILE_QUERY).matches;
    const target = {
      center: [selLng, selLat] as [number, number],
      ...(phone ? { offset: [0, -Math.round(window.innerHeight * 0.22)] as [number, number] } : {}),
    };
    if (reduced) map.jumpTo(target);
    else map.flyTo({ ...target, duration: 800 });
  }, [map, selId, selLng, selLat]);

  // A second tap on the selected pin deselects it.
  const handleSelect = useCallback(
    (id: string) => onSelectEvent(id === selectedEventId ? null : id),
    [onSelectEvent, selectedEventId],
  );

  return (
    <>
      {pins.map((pin) => (
        <EventMarker
          key={pin.event.id}
          event={pin.event}
          live={pin.live}
          selected={pin.event.id === selectedEventId}
          label={pinLabel(pin, locale)}
          ariaLabel={pinAriaLabel(pin, locale)}
          onSelect={handleSelect}
        />
      ))}
    </>
  );
}
