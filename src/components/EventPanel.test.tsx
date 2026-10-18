/**
 * EventPanel.test.tsx — the desktop event card inside the real
 * DesktopSidePanel shell (#759): focus moves to the card's heading on open,
 * returns to the pin on close, and Escape closes it. Closing is what MapWrapper
 * turns into "deselect the pin and clear ?event=" (syncEventParam, covered in
 * eventPins.test.ts).
 */

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DesktopSidePanel from "@/components/DesktopSidePanel";
import EventPanel from "@/components/EventPanel";
import type { PublicEventDetail } from "@/lib/events";

const NOW = Date.now();
const event: PublicEventDetail = {
  id: "evt-1",
  name: "Turkey drive",
  name_es: null,
  host: null,
  host_es: null,
  description: null,
  description_es: null,
  what_to_bring: null,
  what_to_bring_es: null,
  starts_at: new Date(NOW + 3_600_000).toISOString(),
  ends_at: new Date(NOW + 5 * 3_600_000).toISOString(),
  lat: 38.25,
  lng: -104.6,
  address: "1 Main St",
  venue_id: null,
  link_url: null,
  status: "published",
  cancel_note: null,
  cancel_note_es: null,
};

function Harness({ onClose }: { onClose: () => void }) {
  return (
    <>
      <DesktopSidePanel open onClose={onClose} headingId="event-card-title-evt-1">
        {(close) => (
          <EventPanel
            event={event}
            locale="en"
            userLocation={null}
            headingId="event-card-title-evt-1"
            onClose={close}
            onSeeOpenNow={vi.fn()}
          />
        )}
      </DesktopSidePanel>
    </>
  );
}

describe("EventPanel in the desktop side panel", () => {
  test("focus moves into the card's heading when it opens", () => {
    render(<Harness onClose={vi.fn()} />);

    expect(document.activeElement).toBe(document.getElementById("event-card-title-evt-1"));
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe("event-card-title-evt-1");
  });

  test("Escape closes it", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("the close button closes it", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Close event details/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
