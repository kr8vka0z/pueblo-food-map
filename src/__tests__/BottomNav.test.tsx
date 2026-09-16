/**
 * BottomNav tests — docs/bottom-nav-spec.md §13, items 1–4.
 *
 * Class-and-attribute contract assertions in the style of
 * SearchBarViewSwitch.test.tsx: jsdom has no layout engine, so the geometry
 * (bar height, pill placement, credits clearance) is verified by hand on dev
 * (§14), not here. Items 2–3 at the real-MapWrapper level live in
 * MapWrapperViewSwitch.test.tsx; item 5 (the band) too.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BottomNav from "@/components/BottomNav";
import type { GeoState } from "@/lib/useGeolocation";

const GEO_IDLE: GeoState = { permission: "prompt", position: null };
const GEO_LOCATED: GeoState = { permission: "granted", position: { lat: 38.25, lng: -104.6 } };

type Props = React.ComponentProps<typeof BottomNav>;

function renderNav(overrides: Partial<Props> = {}) {
  const props: Props = {
    locale: "en",
    openSection: null,
    onSectionTap: vi.fn(),
    geoState: GEO_IDLE,
    isLocating: false,
    isDrifted: false,
    onNearMe: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<BottomNav {...props} />) };
}

describe("BottomNav", () => {
  test("renders four items, each with a visible text label (§13.1)", () => {
    renderNav();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Near me", "Saved", "Resources", "Menu"]);
    for (const b of buttons) {
      const label = b.querySelector("span");
      expect(label?.className ?? "").not.toContain("sr-only");
    }
  });

  test("Spanish labels (§11)", () => {
    renderNav({ locale: "es" });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Cerca de mí",
      "Guardados",
      "Recursos",
      "Menú",
    ]);
  });

  test("no item carries aria-current when no panel is open (§13.2)", () => {
    const { container } = renderNav();
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);
  });

  test("the open panel's item — and only it — carries aria-current (§13.3)", () => {
    const { container } = renderNav({ openSection: "saved" });
    const current = container.querySelectorAll("[aria-current]");
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("aria-current")).toBe("true");
    expect(current[0].textContent).toBe("Saved");
  });

  test("Resources opens the help section, Menu the top, Saved the saved section (§7)", () => {
    const onSectionTap = vi.fn();
    renderNav({ onSectionTap });
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    fireEvent.click(screen.getByRole("button", { name: "Resources" }));
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(onSectionTap.mock.calls).toEqual([["saved"], ["help"], ["top"]]);
  });

  test("Near me is disabled and shows the spinner while locating; label unchanged (§13.4, §6)", () => {
    const onNearMe = vi.fn();
    renderNav({ isLocating: true, onNearMe });
    const btn = screen.getByTestId("nav-near-me") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.textContent).toBe("Near me");
    expect(btn.querySelector("svg")?.getAttribute("class")).toContain("animate-spin");
    fireEvent.click(btn);
    expect(onNearMe).not.toHaveBeenCalled();
  });

  test("Near me swaps only its icon when the map drifts from a located resident (§6)", () => {
    const { rerender, props } = renderNav({ geoState: GEO_LOCATED });
    const iconClass = () =>
      screen.getByTestId("nav-near-me").querySelector("svg")?.getAttribute("class") ?? "";
    expect(iconClass()).toContain("lucide-locate ");
    rerender(<BottomNav {...props} isDrifted />);
    expect(iconClass()).toContain("lucide-locate-fixed");
    expect(screen.getByTestId("nav-near-me").textContent).toBe("Near me");
  });

  test("tapping Near me calls onNearMe", () => {
    const onNearMe = vi.fn();
    renderNav({ onNearMe });
    fireEvent.click(screen.getByRole("button", { name: "Near me" }));
    expect(onNearMe).toHaveBeenCalledTimes(1);
  });

  test("is a labelled navigation landmark (§12)", () => {
    renderNav();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeDefined();
  });
});
