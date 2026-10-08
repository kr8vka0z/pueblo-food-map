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

const SAMPLE = { id: "pantry-sample", lng: -104.6, lat: 38.26 };
const EN = TOUR_COPY.en;
const cardIndex = TOUR_STEPS.findIndex((s) => s.id === "card");
const pinIndex = TOUR_STEPS.findIndex((s) => s.id === "pin");

function makeMap() {
  return {
    getCenter: vi.fn(() => ({ lng: -104.1, lat: 38.1 })),
    getZoom: vi.fn(() => 11),
    jumpTo: vi.fn(),
  };
}

function renderTour(overrides: Partial<React.ComponentProps<typeof GuidedTour>> = {}) {
  const props = {
    locale: "en" as const,
    sampleVenue: SAMPLE,
    mapboxMap: null,
    onShowVenue: vi.fn(),
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

  test("the close (X) button ends the tour from any step", () => {
    const { props } = renderTour();
    clickNext(2);
    fireEvent.click(screen.getByRole("button", { name: EN.close }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test("Spanish copy when locale is es", () => {
    renderTour({ locale: "es" });
    expect(title()).toBe(TOUR_COPY.es.steps.welcome.title);
    expect(screen.getByRole("button", { name: TOUR_COPY.es.next })).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: EN.close }));
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [-104.1, 38.1], zoom: 11 });
    expect(props.onClose).toHaveBeenCalled();
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

describe("GuidedTour — focus management", () => {
  test("focus that escapes the dialog is pulled back in", () => {
    renderTour();
    const outside = screen.getByTestId("return-here");
    act(() => outside.focus());
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  test("closing returns focus to the element that launched the tour", async () => {
    const { props } = renderTour();
    fireEvent.click(screen.getByRole("button", { name: EN.close }));
    expect(props.onClose).toHaveBeenCalled();
    // The component is still mounted in this harness; unmount like MapWrapper would.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(document.activeElement).toBe(screen.getByTestId("return-here"));
  });
});
