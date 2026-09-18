/**
 * BlessingBoxesMapButton tests — entry-point candidate "map" (Blessing
 * Boxes slice 4, story B4). See BottomNav.test.tsx's own "Blessing Boxes
 * entry candidate 'nav'" block for the other candidate's tests.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BlessingBoxesMapButton from "@/components/BlessingBoxesMapButton";

describe("BlessingBoxesMapButton", () => {
  test("renders a real link to /boxes with a visible (never icon-only) label", () => {
    render(<BlessingBoxesMapButton locale="en" />);
    const link = screen.getByRole("link", { name: "Boxes" });
    expect(link.getAttribute("href")).toBe("/boxes");
    expect(screen.getByTestId("map-boxes-button").textContent).toContain("Boxes");
  });

  test("Spanish label", () => {
    render(<BlessingBoxesMapButton locale="es" />);
    expect(screen.getByRole("link", { name: "Cajas" })).toBeDefined();
  });
});
