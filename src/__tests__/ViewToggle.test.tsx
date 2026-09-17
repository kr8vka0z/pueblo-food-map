/**
 * ViewToggle tests (#129)
 *
 * Segmented Map|List control — aria-pressed state and onChange callback.
 * sm/md size variants (#191) were removed 2026-09-16: SearchBar (the only
 * caller left, since HamburgerMenu's own row was deleted with the bottom
 * nav) always rendered the flush treatment, so the prop was collapsed away.
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

  test("fills its container's height and has no border of its own", () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} />);
    const group = screen.getByRole("group");
    expect(group.style.height).toBe("100%");
    expect(group.className).not.toContain("border");
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

describe("ViewToggle — mapDisabled (#191 follow-up)", () => {
  test("map button is disabled and does not fire onChange when mapDisabled", () => {
    const onChange = vi.fn();
    render(<ViewToggle mode="list" onChange={onChange} mapDisabled />);
    const mapBtn = screen.getByRole("button", { name: /^Map$/i });
    expect((mapBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(mapBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("list button stays usable while the map side is disabled", () => {
    const onChange = vi.fn();
    render(<ViewToggle mode="list" onChange={onChange} mapDisabled />);
    const listBtn = screen.getByRole("button", { name: /^List$/i });
    expect((listBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(listBtn);
    expect(onChange).toHaveBeenCalledWith("list");
  });

  test("neither button is disabled by default", () => {
    render(<ViewToggle mode="map" onChange={vi.fn()} />);
    for (const name of [/^Map$/i, /^List$/i]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });
});

describe("ViewToggle — labels (docs/bottom-nav-spec.md §4.1, §4.3)", () => {
  // WHY class names rather than computed styles: jsdom does not evaluate
  // Tailwind's generated CSS or media queries. The contract worth locking down
  // is which spans carry visual-hiding classes, and that label text always
  // stays in the accessibility tree.
  // Icons only on phones, words from md up (Kyle, 2026-09-16).
  test("labels are hidden under md only, keeping accessible names", () => {
    const { container } = render(<ViewToggle mode="map" onChange={vi.fn()} />);
    const spans = Array.from(container.querySelectorAll("span"));
    expect(spans.map((s) => s.textContent)).toEqual(["Map", "List"]);
    for (const span of spans) {
      expect(span.className).toBe("max-md:sr-only");
    }
    expect(screen.getByRole("button", { name: /^Map$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^List$/i })).toBeDefined();
  });
});
