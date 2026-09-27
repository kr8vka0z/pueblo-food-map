/**
 * DesktopSidePanel — #682, the fixed right-hand shell.
 *
 * Unit-level coverage of the shell in isolation (MapWrapperDesktopPanel.test.tsx
 * covers it wired up with a real venue card and the map's pan-on-select
 * effect): renders children only while open, and carries the fixed
 * inset/width chrome the mockup calls for.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DesktopSidePanel, {
  DESKTOP_PANEL_WIDTH_PX,
  DESKTOP_PANEL_INSET_PX,
} from "@/components/DesktopSidePanel";

describe("DesktopSidePanel", () => {
  test("renders children when open", () => {
    render(
      <DesktopSidePanel open={true}>
        <p>panel content</p>
      </DesktopSidePanel>,
    );
    expect(screen.getByText("panel content")).toBeDefined();
  });

  test("renders nothing when closed", () => {
    render(
      <DesktopSidePanel open={false}>
        <p>panel content</p>
      </DesktopSidePanel>,
    );
    expect(screen.queryByText("panel content")).toBeNull();
    expect(screen.queryByTestId("desktop-side-panel")).toBeNull();
  });

  test("carries the mockup's fixed inset and width", () => {
    render(
      <DesktopSidePanel open={true}>
        <p>panel content</p>
      </DesktopSidePanel>,
    );
    const panel = screen.getByTestId("desktop-side-panel");
    expect(panel.style.top).toBe(`${DESKTOP_PANEL_INSET_PX}px`);
    expect(panel.style.right).toBe(`${DESKTOP_PANEL_INSET_PX}px`);
    expect(panel.style.bottom).toBe(`${DESKTOP_PANEL_INSET_PX}px`);
    expect(panel.style.width).toBe(`${DESKTOP_PANEL_WIDTH_PX}px`);
    // Mockup floor: "at least 340px" — trivially true for a fixed value,
    // but proves nobody accidentally shrinks it below the floor later.
    expect(DESKTOP_PANEL_WIDTH_PX).toBeGreaterThanOrEqual(340);
  });
});
