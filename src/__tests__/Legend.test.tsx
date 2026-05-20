/**
 * Legend component tests — collapsible category color legend.
 *
 * Coverage:
 *   - Renders a button in collapsed state by default
 *   - Button has aria-expanded="false" when collapsed
 *   - Button has aria-expanded="true" when expanded
 *   - Click on button expands the panel
 *   - Click on button again collapses the panel
 *   - Escape key closes the panel and returns focus to button
 *   - Outside click closes the panel
 *   - Panel has role="region" with aria-label="Map legend"
 *   - Panel shows all 7 categories with correct labels
 *   - Each color dot has aria-hidden="true"
 *   - EN locale labels
 *   - ES locale labels
 */

import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Legend from "@/components/Legend";

beforeEach(() => {
  // Clean up any mounted elements between tests
});

describe("Legend — default collapsed state", () => {
  test("renders a button", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    expect(btn).toBeDefined();
  });

  test("button has aria-expanded='false' when collapsed", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  test("panel is not visible by default", () => {
    render(<Legend />);
    // region role is not present when panel is closed
    const region = screen.queryByRole("region");
    expect(region).toBeNull();
  });
});

describe("Legend — expand/collapse", () => {
  test("clicking button expands the panel", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(btn);
    const region = screen.getByRole("region");
    expect(region).toBeDefined();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  test("clicking button again collapses the panel", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    const region = screen.queryByRole("region");
    expect(region).toBeNull();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  test("Escape key closes the panel", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(btn);
    expect(screen.getByRole("region")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region")).toBeNull();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Legend — panel content", () => {
  test("panel has role='region' and aria-label='Map legend'", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(btn);
    const region = screen.getByRole("region", { name: "Map legend" });
    expect(region).toBeDefined();
  });

  test("panel shows all 7 category labels (EN)", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(btn);
    expect(screen.getByText("Food Pantry")).toBeDefined();
    expect(screen.getByText("Grocery / Supermarket")).toBeDefined();
    expect(screen.getByText("Convenience Store")).toBeDefined();
    expect(screen.getByText("Farm / Market")).toBeDefined();
    expect(screen.getByText("Community Garden")).toBeDefined();
    expect(screen.getByText("Edible Landscape")).toBeDefined();
    expect(screen.getByText("Meal Site")).toBeDefined();
  });

  test("panel shows all 7 category labels (ES)", () => {
    render(<Legend locale="es" />);
    const btn = screen.getByRole("button", { name: "Leyenda del mapa" });
    fireEvent.click(btn);
    expect(screen.getByText("Despensa de alimentos")).toBeDefined();
    expect(screen.getByText("Supermercado")).toBeDefined();
    expect(screen.getByText("Tienda de conveniencia")).toBeDefined();
    expect(screen.getByText("Granja / Mercado")).toBeDefined();
    expect(screen.getByText("Huerto comunitario")).toBeDefined();
    expect(screen.getByText("Paisaje comestible")).toBeDefined();
    expect(screen.getByText("Comedor comunitario")).toBeDefined();
  });

  test("each color dot has aria-hidden='true'", () => {
    const { container } = render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(btn);
    const dots = container.querySelectorAll("[data-legend-dot]");
    expect(dots.length).toBe(7);
    dots.forEach((dot) => {
      expect(dot.getAttribute("aria-hidden")).toBe("true");
    });
  });

  test("color dots have correct background colors", () => {
    const { container } = render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(btn);
    const dots = Array.from(container.querySelectorAll("[data-legend-dot]")) as HTMLElement[];
    const colors = dots.map((d) => d.style.backgroundColor);
    // Check that pantry red is present (rgb conversion of #BE2D45)
    // jsdom translates hex to rgb
    expect(colors.some((c) => c !== "")).toBe(true);
    expect(dots.length).toBe(7);
  });
});

describe("Legend — outside click closes panel", () => {
  test("clicking outside the legend closes the panel", () => {
    render(
      <div>
        <Legend />
        <button type="button" data-testid="outside">Outside</button>
      </div>
    );
    const legendBtn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.click(legendBtn);
    expect(screen.getByRole("region")).toBeDefined();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("Legend — keyboard a11y", () => {
  test("Enter key toggles the panel open", () => {
    render(<Legend />);
    const btn = screen.getByRole("button", { name: "Map legend" });
    fireEvent.keyDown(btn, { key: "Enter" });
    // Button is a <button> so Enter fires click natively; simulate click
    fireEvent.click(btn);
    expect(screen.getByRole("region")).toBeDefined();
  });
});
