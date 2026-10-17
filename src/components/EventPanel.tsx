"use client";

/**
 * EventPanel — the desktop shell content for an event card (#759): the
 * dialog wrapper and scroll area that DesktopVenueWindow gives a place card,
 * around the one shared EventCardBody. DesktopSidePanel (the real shell)
 * already owns Escape, focus-to-heading on open and focus-return on close; this
 * adds only the `role="dialog"` name (the card's own heading) and the scroller.
 * Kept separate from DesktopVenueWindow on purpose: that component requires a
 * place and refactoring it is out of scope (#725).
 */

import EventCardBody, { type EventCardBodyProps } from "@/components/EventCardBody";

export default function EventPanel(props: Omit<EventCardBodyProps, "layout">) {
  return (
    <div role="dialog" aria-modal="false" aria-labelledby={props.headingId} className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <EventCardBody {...props} layout="panel" />
      </div>
    </div>
  );
}
