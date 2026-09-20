/**
 * WalkStepper tests — issue #555 step-through walking directions.
 *
 * Two units, both new in this issue:
 *   1. `parseWalkSteps` (MapWrapper.tsx) dropping any step whose
 *      `maneuver.location` is missing or malformed — the stepper flies the
 *      map's camera to that coordinate on every arrow tap, so a step without
 *      one can't be shown safely. See WalkingRoute.test.tsx for this
 *      function's pre-existing coverage (instruction-based dropping); this
 *      file covers only the location-based half added by #555.
 *   2. `WalkStepper` (DirectionButtons.tsx) — the "Step N of M" panel: one
 *      turn at a time, Back/Next (disabled at the ends), the "Then: <next>"
 *      peek, and the "All turns" disclosure that reuses WalkStepsList.
 *
 * Mocks mapbox-gl the same way WalkingRoute.test.tsx does — MapWrapper.tsx
 * is imported here only for the pure `parseWalkSteps` function, but Vitest
 * still evaluates the whole module (and its react-map-gl import) at import
 * time, which needs a WebGL canvas jsdom doesn't have.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));
vi.mock("react-map-gl/mapbox", async () => {
  const React = await import("react");
  return {
    default: vi.fn(({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    ),
    Marker: vi.fn(() => null),
    Popup: vi.fn(() => null),
    AttributionControl: vi.fn(() => null),
    Source: vi.fn(() => null),
    Layer: vi.fn(() => null),
  };
});

import { parseWalkSteps } from "@/components/MapWrapper";
import { WalkStepper, type WalkStepperProps } from "@/components/DirectionButtons";

// ─── parseWalkSteps — location-drop behavior (#555) ───────────────────────────

describe("parseWalkSteps — drops steps with no usable maneuver.location (#555)", () => {
  test("a step with a valid [lng, lat] location is kept, carrying location/type/modifier", () => {
    const route = {
      legs: [
        {
          steps: [
            {
              maneuver: { instruction: "Turn left onto Main St", location: [-104.6, 38.25], type: "turn", modifier: "left" },
              distance: 120,
            },
          ],
        },
      ],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({
      instruction: "Turn left onto Main St",
      distance: 120,
      location: [-104.6, 38.25],
      maneuverType: "turn",
      maneuverModifier: "left",
    });
  });

  test("a step with no maneuver.location at all is dropped", () => {
    const route = {
      legs: [
        {
          steps: [
            { maneuver: { instruction: "Turn left" }, distance: 120 },
            { maneuver: { instruction: "Arrive", location: [-104.6, 38.25] }, distance: 0 },
          ],
        },
      ],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(1);
    expect(steps[0].instruction).toBe("Arrive");
  });

  test("a malformed location (wrong length, or non-number entries) is dropped", () => {
    const route = {
      legs: [
        {
          steps: [
            { maneuver: { instruction: "Bad 1", location: [1] }, distance: 10 },
            { maneuver: { instruction: "Bad 2", location: ["-104.6", "38.25"] }, distance: 10 },
            { maneuver: { instruction: "Bad 3", location: [1, 2, 3] }, distance: 10 },
            { maneuver: { instruction: "Good", location: [-104.6, 38.25] }, distance: 10 },
          ],
        },
      ],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(1);
    expect(steps[0].instruction).toBe("Good");
  });

  test("maneuverType/maneuverModifier are omitted (not crashed on) when Mapbox doesn't send them", () => {
    const route = {
      legs: [{ steps: [{ maneuver: { instruction: "Head north", location: [0, 0] }, distance: 50 }] }],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(1);
    expect(steps[0].maneuverType).toBeUndefined();
    expect(steps[0].maneuverModifier).toBeUndefined();
  });
});

// ─── WalkStepper — rendering + Back/Next/All-turns behavior (#555) ────────────

const THREE_STEPS: WalkStepperProps["steps"] = [
  { instruction: "Head north on Main St", distance: 200, location: [-104.6, 38.25], maneuverType: "depart" },
  { instruction: "Turn right on Union Ave", distance: 300, location: [-104.61, 38.26], maneuverType: "turn", maneuverModifier: "right" },
  { instruction: "Arrive at destination", distance: 0, location: [-104.62, 38.27], maneuverType: "arrive" },
];

function renderStepper(overrides: Partial<WalkStepperProps> = {}) {
  const onStepChange = vi.fn();
  const props: WalkStepperProps = {
    steps: THREE_STEPS,
    activeIndex: 0,
    onStepChange,
    locale: "en",
    ...overrides,
  };
  render(<WalkStepper {...props} />);
  return { onStepChange };
}

describe("WalkStepper — counter, instruction, and the Then: peek", () => {
  test("shows the Step N of M counter and the current instruction", () => {
    renderStepper({ activeIndex: 0 });
    expect(screen.getByTestId("walk-stepper-counter").textContent).toBe("Step 1 of 3");
    expect(screen.getByTestId("walk-stepper-instruction").textContent).toContain("Head north on Main St");
  });

  test("shows a 'Then: <next instruction>' peek when a next step exists", () => {
    renderStepper({ activeIndex: 0 });
    expect(screen.getByTestId("walk-stepper-then").textContent).toBe("Then: Turn right on Union Ave");
  });

  test("no Then peek on the last step", () => {
    renderStepper({ activeIndex: 2 });
    expect(screen.queryByTestId("walk-stepper-then")).toBeNull();
  });

  test("the last step (distance 0) shows 'You have arrived' instead of a distance", () => {
    renderStepper({ activeIndex: 2 });
    expect(screen.getByTestId("walk-stepper-distance").textContent).toBe("You have arrived");
  });
});

describe("WalkStepper — Back/Next disable at the ends and call onStepChange", () => {
  test("Back is disabled and Next is enabled on the first step", () => {
    renderStepper({ activeIndex: 0 });
    expect(screen.getByTestId("walk-stepper-back")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("walk-stepper-next")).toHaveProperty("disabled", false);
  });

  test("Next is disabled and Back is enabled on the last step", () => {
    renderStepper({ activeIndex: 2 });
    expect(screen.getByTestId("walk-stepper-next")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("walk-stepper-back")).toHaveProperty("disabled", false);
  });

  test("both are enabled on a middle step", () => {
    renderStepper({ activeIndex: 1 });
    expect(screen.getByTestId("walk-stepper-back")).toHaveProperty("disabled", false);
    expect(screen.getByTestId("walk-stepper-next")).toHaveProperty("disabled", false);
  });

  test("clicking Next calls onStepChange(activeIndex + 1)", async () => {
    const user = userEvent.setup();
    const { onStepChange } = renderStepper({ activeIndex: 0 });
    await user.click(screen.getByTestId("walk-stepper-next"));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  test("clicking Back calls onStepChange(activeIndex - 1)", async () => {
    const user = userEvent.setup();
    const { onStepChange } = renderStepper({ activeIndex: 1 });
    await user.click(screen.getByTestId("walk-stepper-back"));
    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  test("Back/Next have real (non-empty) aria-labels, not icon-only silence", () => {
    renderStepper({ activeIndex: 1 });
    expect(screen.getByTestId("walk-stepper-back").getAttribute("aria-label")).toBeTruthy();
    expect(screen.getByTestId("walk-stepper-next").getAttribute("aria-label")).toBeTruthy();
  });

  test("the instruction region is a polite live region", () => {
    renderStepper({ activeIndex: 0 });
    expect(screen.getByTestId("walk-stepper-instruction").getAttribute("aria-live")).toBe("polite");
  });
});

describe("WalkStepper — 'All turns' disclosure", () => {
  test("collapsed by default: the full step list is present but hidden (screen readers skip it)", () => {
    renderStepper();
    expect(screen.getByTestId("walk-steps-list")).toHaveProperty("hidden", true);
    const toggle = screen.getByTestId("walk-stepper-all-turns-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("opening it shows every step and flips aria-expanded", async () => {
    const user = userEvent.setup();
    renderStepper();
    await user.click(screen.getByTestId("walk-stepper-all-turns-toggle"));
    expect(screen.getByTestId("walk-stepper-all-turns-toggle").getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByTestId("walk-steps-list");
    expect(list.querySelectorAll("li")).toHaveLength(THREE_STEPS.length);
  });

  test("clicking a row in the open list jumps the stepper to that turn", async () => {
    const user = userEvent.setup();
    const { onStepChange } = renderStepper({ activeIndex: 0 });
    await user.click(screen.getByTestId("walk-stepper-all-turns-toggle"));
    await user.click(screen.getByText("Turn right on Union Ave"));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });
});
