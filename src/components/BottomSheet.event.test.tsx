/**
 * BottomSheet.event.test.tsx — the phone event card inside the REAL (unmocked)
 * vaul sheet (#759), the same approach as BottomSheet.escapeGuard.test.tsx
 * because a mock can't prove anything about vaul's own Escape/focus wiring.
 * Covers: focus moves into the card on open and returns to the pin on close,
 * Escape and the close button both call onClose (which MapWrapper turns into
 * "deselect the pin and clear ?event="), and the collapsed first view already
 * has the badge, name and Get directions.
 */

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
import type { PublicEventDetail } from "@/lib/events";

beforeAll(() => {
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = vi.fn();
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = vi.fn();
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

const NOW = Date.now();
const event: PublicEventDetail = {
  id: "evt-1",
  name: "Turkey drive",
  name_es: null,
  host: "Pueblo Food Project",
  host_es: null,
  description: "Free turkeys",
  description_es: null,
  what_to_bring: null,
  what_to_bring_es: null,
  starts_at: new Date(NOW + 2 * 3_600_000).toISOString(),
  ends_at: new Date(NOW + 6 * 3_600_000).toISOString(),
  lat: 38.25,
  lng: -104.6,
  address: "1 Main St, Pueblo, CO",
  venue_id: null,
  link_url: null,
  status: "published",
  cancel_note: null,
  cancel_note_es: null,
};

function Pin() {
  return (
    <button type="button" className="pfm-event-pin" aria-pressed="true">
      pin
    </button>
  );
}

describe("BottomSheet with an event", () => {
  test("opens on the card: first view has badge, name and Get directions; focus lands in it", async () => {
    render(
      <>
        <Pin />
        <BottomSheet venue={null} event={event} onClose={vi.fn()} locale="en" />
      </>,
    );

    // The card is lazy-loaded; its badge appearing means it has mounted.
    await screen.findByTestId("event-badge");
    expect(screen.getByRole("link", { name: /Get directions/i })).toBeTruthy();
    const heading = document.getElementById("event-card-title-evt-1");
    expect(heading?.tagName).toBe("H2");
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  test("Escape closes it, and the close button closes it", async () => {
    const onClose = vi.fn();
    render(<BottomSheet venue={null} event={event} onClose={onClose} locale="en" />);
    await screen.findByTestId("event-badge");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: /Close event details/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("closing returns focus to the pin that opened it", async () => {
    const view = render(
      <>
        <Pin />
        <BottomSheet venue={null} event={null} onClose={vi.fn()} locale="en" />
      </>,
    );
    const pin = document.querySelector<HTMLElement>(".pfm-event-pin")!;
    pin.focus();

    view.rerender(
      <>
        <Pin />
        <BottomSheet venue={null} event={event} onClose={vi.fn()} locale="en" />
      </>,
    );
    await screen.findByTestId("event-badge");
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("event-card-title-evt-1")));

    view.rerender(
      <>
        <Pin />
        <BottomSheet venue={null} event={null} onClose={vi.fn()} locale="en" />
      </>,
    );

    await waitFor(() => expect(document.activeElement).toBe(pin));
  });
});
