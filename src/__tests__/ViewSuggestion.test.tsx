/**
 * ViewSuggestion tests (#514) — the one-line drop-down under an empty,
 * focused search bar that offers the other view.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewSuggestion from "@/components/ViewSuggestion";

describe("ViewSuggestion — on the map", () => {
  test('offers "See all places as a list" with the count', () => {
    render(<ViewSuggestion mode="map" count={128} onSelect={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /See all places as a list/i });
    expect(btn).toBeDefined();
    expect(btn.textContent).toContain("128 places");
  });

  test("clicking calls onSelect", async () => {
    const onSelect = vi.fn();
    render(<ViewSuggestion mode="map" count={5} onSelect={onSelect} />);
    screen.getByRole("button").click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("mousedown preempts blur — preventDefault is called so the input stays focused", () => {
    render(<ViewSuggestion mode="map" count={5} onSelect={vi.fn()} />);
    const btn = screen.getByRole("button");
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    btn.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("ViewSuggestion — on the list", () => {
  test('offers "Back to the map" with the count', () => {
    render(<ViewSuggestion mode="list" count={42} onSelect={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Back to the map/i });
    expect(btn).toBeDefined();
    expect(btn.textContent).toContain("42 places");
  });

  test("renders nothing when the map is disabled (#165) — no dead button", () => {
    const { container } = render(
      <ViewSuggestion mode="list" count={10} onSelect={vi.fn()} mapDisabled />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders normally on the list when the map is NOT disabled", () => {
    render(<ViewSuggestion mode="list" count={10} onSelect={vi.fn()} mapDisabled={false} />);
    expect(screen.getByRole("button", { name: /Back to the map/i })).toBeDefined();
  });
});

describe("ViewSuggestion — onFocus/onBlur (keyboard-a11y fix, reviewer, PR #522)", () => {
  test("the button forwards focus/blur to the parent's handlers", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(<ViewSuggestion mode="map" count={5} onSelect={vi.fn()} onFocus={onFocus} onBlur={onBlur} />);
    const btn = screen.getByRole("button");

    // fireEvent.focus/blur (not raw dispatchEvent) — React's delegated
    // synthetic focus/blur listens for the bubbling focusin/focusout events,
    // which is what fireEvent's FocusEvent map produces; a bare "focus"/
    // "blur" dispatch (non-bubbling natively) never reaches it.
    fireEvent.focus(btn);
    expect(onFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(btn);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("ViewSuggestion — ES locale", () => {
  test("map mode renders the Spanish label", () => {
    render(<ViewSuggestion mode="map" count={7} onSelect={vi.fn()} locale="es" />);
    expect(
      screen.getByRole("button", { name: /Ver todos los lugares en una lista/i }),
    ).toBeDefined();
  });

  test("list mode renders the Spanish label", () => {
    render(<ViewSuggestion mode="list" count={7} onSelect={vi.fn()} locale="es" />);
    expect(screen.getByRole("button", { name: /Volver al mapa/i })).toBeDefined();
  });
});
