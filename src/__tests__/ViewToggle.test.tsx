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

describe("ViewToggle — size variants (#191)", () => {
  test('default (no size prop) renders the 28px "sm" group height', () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} />);
    const group = screen.getByRole("group");
    expect(group.style.height).toBe("28px");
  });

  test('size="sm" is explicitly 28px (unchanged HamburgerMenu treatment)', () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} size="sm" />);
    const group = screen.getByRole("group");
    expect(group.style.height).toBe("28px");
  });

  test(
    'size="md" group height is 38px, not 36px — Preflight\'s border-box ' +
      "sizing plus the group's 1px top+bottom border would otherwise shrink " +
      "the h-full buttons inside to 34px, 2px under the 36px tap-target floor",
    () => {
      render(<ViewToggle mode="map" onChange={vi.fn()} size="md" />);
      const group = screen.getByRole("group");
      expect(group.style.height).toBe("38px");
    },
  );
});
