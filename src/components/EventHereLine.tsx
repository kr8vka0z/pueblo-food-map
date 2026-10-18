"use client";

/**
 * EventHereLine — the single line a place's own card shows when an upcoming
 * or live special event is tied to that place (#759): "Event here Saturday".
 * A real button (48px tall) that opens the event's card. Shared by BottomSheet
 * and DesktopVenueWindow so the venue cards each need only one line of JSX.
 */

import { Star } from "lucide-react";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

export interface EventHere {
  label: string;
  onOpen: () => void;
}

export default function EventHereLine({ label, onOpen }: EventHere) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        "flex min-h-12 w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-event-outline)] " +
        "bg-[var(--color-bone-50)] px-3 text-left text-sm font-semibold text-[var(--color-event-outline)] " +
        "touch-manipulation " + PRESS_FEEDBACK +
        " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
      }
    >
      <Star size={16} aria-hidden className="shrink-0 fill-[var(--color-event-pin)] stroke-[var(--color-event-outline)]" />
      {label}
    </button>
  );
}
