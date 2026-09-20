/**
 * RouteStrip tests — #531 "Steps" control.
 *
 * #509's own baseline behavior (name/distance readout, Clear route, Show
 * card) is exercised indirectly wherever RouteStrip is used (RouteFit.test.tsx,
 * BottomSheet tests) — this file covers ONLY the new steps sheet: it's a real
 * (unmocked) native <dialog>, backed by vitest.setup.ts's showModal()/close()
 * polyfill (see that file's own header) — no vaul involved, so no mock needed
 * the way BottomSheet.test.tsx mocks vaul.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RouteStrip from "@/components/RouteStrip";

const STEPS = [
  { instruction: "Head north on Main St", distance: 50 },
  { instruction: "Turn right on Union Ave", distance: 300 },
  { instruction: "Arrive at destination", distance: 0 },
];

const baseProps = {
  venueName: "Test Food Pantry",
  routeInfo: { distance: "0.4 mi", duration: "8 min" },
  locale: "en" as const,
  onShowCard: vi.fn(),
  onClearRoute: vi.fn(),
};

describe("RouteStrip — Steps control (#531)", () => {
  test("no Steps control when walkSteps is omitted", () => {
    render(<RouteStrip {...baseProps} />);
    expect(screen.queryByTestId("route-strip-steps")).toBeNull();
  });

  test("no Steps control when walkSteps is an empty array", () => {
    render(<RouteStrip {...baseProps} walkSteps={[]} />);
    expect(screen.queryByTestId("route-strip-steps")).toBeNull();
  });

  test("Steps control renders when steps are present", () => {
    render(<RouteStrip {...baseProps} walkSteps={STEPS} />);
    expect(screen.getByTestId("route-strip-steps")).toBeDefined();
  });

  // #539: Kyle approved the mockup's shortened "Steps" wording for this
  // button specifically — DirectionButtons.tsx's own in-card toggle keeps
  // "Show steps"/"Hide steps" (a different i18n key, unaffected by this).
  test("the button reads 'Steps', not 'Show steps' (#539)", () => {
    render(<RouteStrip {...baseProps} walkSteps={STEPS} />);
    expect(screen.getByTestId("route-strip-steps").textContent).toBe("Steps");
  });

  test("tapping Steps opens the stepper, with the reused step-list markup behind All turns", async () => {
    const user = userEvent.setup();
    render(<RouteStrip {...baseProps} walkSteps={STEPS} />);

    expect(screen.queryByTestId("walk-steps-list")).toBeNull();
    await user.click(screen.getByTestId("route-strip-steps"));

    // #555: the sheet leads with ONE turn so the map keeps the screen —
    // Kyle's explicit ask. The full list still exists, one tap away.
    expect(screen.getByTestId("walk-stepper-instruction").textContent)
      .toContain("Head north on Main St");
    expect(screen.getByTestId("walk-stepper-counter").textContent)
      .toContain(`1 of ${STEPS.length}`);

    const list = screen.getByTestId("walk-steps-list");
    expect(list.tagName).toBe("OL");
    expect(list.querySelectorAll("li")).toHaveLength(STEPS.length);
    expect(list.textContent).toContain("Turn right on Union Ave");
  });

  test("the sheet shows the venue name as its own heading", async () => {
    const user = userEvent.setup();
    render(<RouteStrip {...baseProps} walkSteps={STEPS} />);
    await user.click(screen.getByTestId("route-strip-steps"));
    // Two copies of the venue name now exist (the strip's own + the sheet's) —
    // getAllByText, not getByText.
    expect(screen.getAllByText("Test Food Pantry").length).toBeGreaterThanOrEqual(2);
  });

  test("the × button closes the sheet", async () => {
    const user = userEvent.setup();
    render(<RouteStrip {...baseProps} walkSteps={STEPS} />);
    await user.click(screen.getByTestId("route-strip-steps"));
    expect(screen.getByTestId("walk-steps-list")).toBeDefined();

    await user.click(screen.getByTestId("route-strip-steps-close"));
    await waitFor(() => expect(screen.queryByTestId("walk-steps-list")).toBeNull());
  });

  test("Escape closes only the steps sheet — onShowCard/onClearRoute are not called", async () => {
    const onShowCard = vi.fn();
    const onClearRoute = vi.fn();
    const user = userEvent.setup();
    render(
      <RouteStrip {...baseProps} onShowCard={onShowCard} onClearRoute={onClearRoute} walkSteps={STEPS} />,
    );
    await user.click(screen.getByTestId("route-strip-steps"));
    expect(screen.getByTestId("walk-steps-list")).toBeDefined();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByTestId("walk-steps-list")).toBeNull());
    expect(onShowCard).not.toHaveBeenCalled();
    expect(onClearRoute).not.toHaveBeenCalled();
  });

  test("tapping the backdrop (a click directly on the dialog element) closes the sheet", async () => {
    render(<RouteStrip {...baseProps} walkSteps={STEPS} />);
    fireEvent.click(screen.getByTestId("route-strip-steps"));
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);

    fireEvent.click(dialog);

    await waitFor(() => expect(dialog.open).toBe(false));
  });

  test("the dialog has an accessible label reusing the same i18n key as the reused list", () => {
    render(<RouteStrip {...baseProps} walkSteps={STEPS} />);
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.getAttribute("aria-label")).toBe("Turn-by-turn directions");
  });

  test("Clear route and Show card still fire their own callbacks (unaffected by the Steps addition)", async () => {
    const onShowCard = vi.fn();
    const onClearRoute = vi.fn();
    const user = userEvent.setup();
    render(
      <RouteStrip {...baseProps} onShowCard={onShowCard} onClearRoute={onClearRoute} walkSteps={STEPS} />,
    );
    await user.click(screen.getByTestId("route-strip-clear"));
    expect(onClearRoute).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("route-strip-show-card"));
    expect(onShowCard).toHaveBeenCalledTimes(1);
  });
});
