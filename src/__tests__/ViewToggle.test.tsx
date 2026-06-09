/**
 * ViewToggle tests (#129)
 *
 * Segmented Map|List control — aria-pressed state and onChange callback.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewToggle from "@/components/ViewToggle";

describe("ViewToggle — rendering", () => {
  test('renders two buttons: "Map" and "List"', () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Map$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^List$/i })).toBeDefined();
  });

  test("group has an aria-label", () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} />);
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBeTruthy();
  });
});

describe("ViewToggle — mode=map", () => {
  test("Map button has aria-pressed=true when mode=map", () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} />);
    const mapBtn = screen.getByRole("button", { name: /^Map$/i });
    expect(mapBtn.getAttribute("aria-pressed")).toBe("true");
  });

  test("List button has aria-pressed=false when mode=map", () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} />);
    const listBtn = screen.getByRole("button", { name: /^List$/i });
    expect(listBtn.getAttribute("aria-pressed")).toBe("false");
  });

  test("clicking List calls onChange with 'list'", () => {
    const onChange = vi.fn();
    render(<ViewToggle mode="map" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect(onChange).toHaveBeenCalledWith("list");
  });
});

describe("ViewToggle — mode=list", () => {
  test("List button has aria-pressed=true when mode=list", () => {
    render(<ViewToggle mode="list" onChange={vi.fn()} />);
    const listBtn = screen.getByRole("button", { name: /^List$/i });
    expect(listBtn.getAttribute("aria-pressed")).toBe("true");
  });

  test("Map button has aria-pressed=false when mode=list", () => {
    render(<ViewToggle mode="list" onChange={vi.fn()} />);
    const mapBtn = screen.getByRole("button", { name: /^Map$/i });
    expect(mapBtn.getAttribute("aria-pressed")).toBe("false");
  });

  test("clicking Map calls onChange with 'map'", () => {
    const onChange = vi.fn();
    render(<ViewToggle mode="list" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^Map$/i }));
    expect(onChange).toHaveBeenCalledWith("map");
  });
});

describe("ViewToggle — ES locale", () => {
  test("renders Mapa and Lista in es locale", () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} locale="es" />);
    expect(screen.getByRole("button", { name: /^Mapa$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Lista$/i })).toBeDefined();
  });
});
