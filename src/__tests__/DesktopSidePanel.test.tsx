/**
 * DesktopSidePanel — #682, the fixed right-hand shell.
 *
 * Unit-level coverage of the shell in isolation (MapWrapperDesktopPanel.test.tsx
 * covers it wired up with a real venue card, Saved/Menu views, and the map's
 * pan-on-select effect): renders children only while open, carries the fixed
 * inset/width chrome the mockup calls for, and owns Escape + focus-to-heading
 * + focus-return-to-trigger for whatever view is showing (#682 8b — lifted
 * out of DesktopVenueWindow once Saved/Menu views needed the same guards).
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopSidePanel, {
  DESKTOP_PANEL_WIDTH_PX,
  DESKTOP_PANEL_INSET_PX,
} from "@/components/DesktopSidePanel";

function Content({ close, headingId = "test-heading" }: { close: () => void; headingId?: string }) {
  return (
    <>
      <h2 id={headingId} tabIndex={-1}>
        Test view
      </h2>
      <button type="button" onClick={close}>
        Close
      </button>
      <input type="text" aria-label="note" />
    </>
  );
}

describe("DesktopSidePanel", () => {
  test("renders children when open", () => {
    render(
      <DesktopSidePanel open={true} onClose={vi.fn()} headingId="test-heading">
        {(close) => <Content close={close} />}
      </DesktopSidePanel>,
    );
    expect(screen.getByText("Test view")).toBeDefined();
  });

  test("renders nothing when closed", () => {
    render(
      <DesktopSidePanel open={false} onClose={vi.fn()} headingId="test-heading">
        {(close) => <Content close={close} />}
      </DesktopSidePanel>,
    );
    expect(screen.queryByText("Test view")).toBeNull();
    expect(screen.queryByTestId("desktop-side-panel")).toBeNull();
  });

  test("carries the mockup's fixed inset and width", () => {
    render(
      <DesktopSidePanel open={true} onClose={vi.fn()} headingId="test-heading">
        {(close) => <Content close={close} />}
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

  test("focuses the view's heading on mount", async () => {
    render(
      <DesktopSidePanel open={true} onClose={vi.fn()} headingId="test-heading">
        {(close) => <Content close={close} />}
      </DesktopSidePanel>,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText("Test view")));
  });

  test("Escape calls onClose and restores focus to the outside trigger", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">Open trigger</button>
          <DesktopSidePanel open={open} onClose={onClose} headingId="test-heading">
            {(close) => <Content close={close} />}
          </DesktopSidePanel>
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    // Focus the trigger BEFORE the panel mounts — DesktopSidePanel's capture
    // effect runs once on mount, same as clicking a pin/bar item for real.
    screen.getByRole("button", { name: "Open trigger" }).focus();
    rerender(<Harness open={true} />);
    await waitFor(() => expect(screen.getByText("Test view")).toBeDefined());

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open trigger" })),
    );
  });

  test("Escape does not close while focus is on a form control inside the panel", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <DesktopSidePanel open={true} onClose={onClose} headingId="test-heading">
        {(close) => <Content close={close} />}
      </DesktopSidePanel>,
    );
    screen.getByLabelText("note").focus();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  test("close() render-prop calls onClose and restores focus", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">Open trigger</button>
          <DesktopSidePanel open={open} onClose={onClose} headingId="test-heading">
            {(close) => <Content close={close} />}
          </DesktopSidePanel>
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    screen.getByRole("button", { name: "Open trigger" }).focus();
    rerender(<Harness open={true} />);
    await waitFor(() => expect(screen.getByText("Test view")).toBeDefined());
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open trigger" })),
    );
  });
});
