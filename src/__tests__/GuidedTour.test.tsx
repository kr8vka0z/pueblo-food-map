/**
 * GuidedTour (#159) — the step overlay: Next/Back/keyboard, putting the UI
 * into each step's state and restoring it, Escape through the claim-once
 * overlay stack, and focus management.
 */
import { useCallback, useState } from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import GuidedTour from "@/components/GuidedTour";
import { useOverlayEscape } from "@/lib/overlayRegistry";
import { TOUR_STEPS, TOUR_COPY } from "@/lib/guidedTour";
import { hideOthers } from "aria-hidden";

const SAMPLE = { id: "pantry-sample", lng: -104.6, lat: 38.26 };
const EN = TOUR_COPY.en;
const cardIndex = TOUR_STEPS.findIndex((s) => s.id === "card");
const pinIndex = TOUR_STEPS.findIndex((s) => s.id === "pin");

function makeMap() {
  return {
    getCenter: vi.fn(() => ({ lng: -104.1, lat: 38.1 })),
    getZoom: vi.fn(() => 11),
    jumpTo: vi.fn(),
    // `idle` never fires on its own here; tests that need it call fireIdle().
    once: vi.fn(),
    off: vi.fn(),
    triggerRepaint: vi.fn(),
  };
}
function fireIdle(map: ReturnType<typeof makeMap>) {
  for (const [event, cb] of map.once.mock.calls) if (event === "idle") (cb as () => void)();
}

function renderTour(overrides: Partial<React.ComponentProps<typeof GuidedTour>> = {}) {
  const props = {
    locale: "en" as const,
    sampleVenue: SAMPLE,
    mapboxMap: null,
    onShowVenue: vi.fn(),
    onDemoSearch: vi.fn(),
    // A box, so every step (box steps included) is in the tour.
    sampleBox: { id: "box-sample" } as { id: string } | null,
    onDemoBoxes: vi.fn(),
    onShowFilters: vi.fn(),
    onClose: vi.fn(),
    returnFocusSelector: '[data-testid="return-here"]',
    ...overrides,
  };
  const utils = render(
    <>
      <button type="button" data-testid="return-here">Menu</button>
      <GuidedTour {...props} />
    </>,
  );
  return { ...utils, props };
}

function title() {
  return screen.getByRole("heading").textContent;
}

function clickNext(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole("button", { name: EN.next }));
}

describe("GuidedTour — steps and controls", () => {
  test("opens as a modal dialog on the welcome step with focus on Next", () => {
    renderTour();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(title()).toBe(EN.steps.welcome.title);
    expect(screen.getByText(EN.counter(1, TOUR_STEPS.length))).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: EN.next }));
    // No Back on the first step.
    expect(screen.queryByRole("button", { name: EN.back })).toBeNull();
  });

  test("Next and Back move through the steps", () => {
    renderTour();
    clickNext();
    expect(title()).toBe(EN.steps.search.title);
    fireEvent.click(screen.getByRole("button", { name: EN.back }));
    expect(title()).toBe(EN.steps.welcome.title);
  });

  test("ArrowRight / ArrowLeft inside the dialog work like Next / Back", () => {
    renderTour();
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(title()).toBe(EN.steps.filters.title);
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(title()).toBe(EN.steps.search.title);
  });

  test("the last step shows Done, which closes the tour", () => {
    const { props } = renderTour();
    clickNext(TOUR_STEPS.length - 1);
    expect(title()).toBe(EN.steps.menu.title);
    fireEvent.click(screen.getByRole("button", { name: EN.done }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test("Skip ends the tour from any step", () => {
    const { props } = renderTour();
    clickNext(2);
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

});

describe("GuidedTour — puts the UI in each step's state, then restores it", () => {
  test("the card step opens the sample venue; leaving it closes the card again", () => {
    const onShowVenue = vi.fn();
    renderTour({ onShowVenue });
    clickNext(cardIndex);
    expect(onShowVenue).toHaveBeenLastCalledWith(SAMPLE.id);
    clickNext();
    expect(onShowVenue).toHaveBeenLastCalledWith(null);
  });

  test("the pin step centers the map on the sample venue; closing restores the camera", () => {
    const map = makeMap();
    const { props } = renderTour({ mapboxMap: map as never });
    clickNext(pinIndex);
    expect(map.jumpTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ center: [SAMPLE.lng, SAMPLE.lat] }),
    );
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [-104.1, 38.1], zoom: 11 });
    expect(props.onClose).toHaveBeenCalled();
  });

  test("the camera to restore is read once the map settles (first idle), not when it first appears", () => {
    const map = makeMap();
    renderTour({ mapboxMap: map as never });
    // The map's initial fit lands after the tour mounted.
    map.getCenter.mockReturnValue({ lng: -104.6, lat: 38.27 });
    map.getZoom.mockReturnValue(12);
    fireIdle(map);
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [-104.6, 38.27], zoom: 12 });
  });

  test("map arriving mid-tour (slow phone): the pin step moves the camera and finds the pin", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    try {
      const props = {
        locale: "en" as const,
        sampleVenue: SAMPLE,
        onShowVenue: vi.fn(),
        onDemoSearch: vi.fn(),
        sampleBox: null,
        onDemoBoxes: vi.fn(),
        onShowFilters: vi.fn(),
        onClose: vi.fn(),
        returnFocusSelector: "body",
      };
      const { rerender } = render(<GuidedTour {...props} mapboxMap={null} />);
      clickNext(pinIndex);
      // No map yet, so no pin: the target search runs out and gives up.
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.queryByTestId("tour-highlight")).toBeNull();

      // The map (and with it the pins) arrives.
      const pin = document.createElement("button");
      pin.setAttribute("data-venue-id", SAMPLE.id);
      pin.getBoundingClientRect = () => ({ top: 300, left: 150, width: 40, height: 40 }) as DOMRect;
      document.body.appendChild(pin);
      const map = makeMap();
      rerender(<GuidedTour {...props} mapboxMap={map as never} />);
      act(() => vi.advanceTimersByTime(1000));

      expect(map.jumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: [SAMPLE.lng, SAMPLE.lat] }));
      expect(screen.getByTestId("tour-highlight")).toBeTruthy();
      pin.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("GuidedTour — Escape goes through the claim-once overlay stack", () => {
  test("Escape closes only the tour, even when an overlay opened AFTER it (the venue card)", () => {
    const cardEscape = vi.fn();
    const tourClose = vi.fn();

    // Stand-in for BottomSheet/DesktopVenueWindow: registers on the same
    // stack, and only mounts once the tour is already open — the exact
    // order the card step produces.
    function LateOverlay() {
      const onEscape = useCallback(() => cardEscape(), []);
      useOverlayEscape(true, onEscape);
      return null;
    }
    function Harness() {
      const [cardOpen, setCardOpen] = useState(false);
      const [tourOpen, setTourOpen] = useState(true);
      return (
        <>
          {tourOpen && (
            <GuidedTour
              locale="en"
              sampleVenue={SAMPLE}
              mapboxMap={null}
              onShowVenue={(id) => setCardOpen(id !== null)}
              onDemoSearch={() => {}}
              sampleBox={null}
              onDemoBoxes={() => {}}
              onShowFilters={() => {}}
              onClose={() => {
                tourClose();
                setTourOpen(false);
              }}
              returnFocusSelector="body"
            />
          )}
          {cardOpen && <LateOverlay />}
        </>
      );
    }
    render(<Harness />);
    clickNext(cardIndex);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tourClose).toHaveBeenCalledTimes(1);
    expect(cardEscape).not.toHaveBeenCalled();
  });
});

describe("GuidedTour — stays reachable over the phone card", () => {
  // vaul is mocked repo-wide, so this calls the real aria-hidden library the
  // way Radix's modal Dialog does when the phone card opens (vaul 1.1.2 never
  // hands modal={false} on to Radix — see GuidedTour.tsx's live-region note).
  test("Radix's hideOthers() for an open card leaves the tooltip's buttons exposed", () => {
    renderTour();
    clickNext();
    const card = document.createElement("div");
    document.body.appendChild(card);
    const undo = hideOthers(card);
    try {
      for (const name of [EN.next, EN.back, EN.skip]) {
        const button = screen.getByRole("button", { name, hidden: true });
        expect(button.closest('[aria-hidden="true"]')).toBeNull();
      }
    } finally {
      undo();
      card.remove();
    }
  });
});

describe("GuidedTour — focus management", () => {
  test("focus that escapes the dialog is pulled back in", () => {
    renderTour();
    const outside = screen.getByTestId("return-here");
    act(() => outside.focus());
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  test("Back onto step 1 (Back disappears) keeps focus in the dialog", () => {
    renderTour();
    clickNext();
    const back = screen.getByRole("button", { name: EN.back });
    act(() => back.focus());
    fireEvent.click(back);
    expect(screen.queryByRole("button", { name: EN.back })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: EN.next }));
  });

  test("closing returns focus to the element that launched the tour", async () => {
    const { props } = renderTour();
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    expect(props.onClose).toHaveBeenCalled();
    // The component is still mounted in this harness; unmount like MapWrapper would.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(document.activeElement).toBe(screen.getByTestId("return-here"));
  });
});
