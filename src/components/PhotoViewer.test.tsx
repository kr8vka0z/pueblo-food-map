/**
 * PhotoViewer tests (#508) — open/close via each of the four paths the
 * issue's acceptance criteria name: the × button, a tap outside the photo,
 * Escape, and (implicitly, same native mechanism as Escape) the browser
 * back/cancel gesture. Also covers the one thing a naive "click anywhere
 * closes" implementation would get wrong: tapping the photo itself must NOT
 * close it.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotoViewer from "@/components/PhotoViewer";

const PROPS = {
  src: "/api/public/box-photos/42",
  alt: "Photo of Test Blessing Box, shared 2 hours ago",
  caption: "Photo · 2 hours ago",
  locale: "en" as const,
};

describe("PhotoViewer", () => {
  test("open=false renders a closed dialog (not showing)", () => {
    render(<PhotoViewer {...PROPS} open={false} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  test("open=true shows the photo, its alt text, and the caption", () => {
    render(<PhotoViewer {...PROPS} open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    const img = screen.getByRole("img", { name: PROPS.alt });
    expect(img.getAttribute("src")).toBe(PROPS.src);
    expect(screen.getByText("Photo · 2 hours ago")).toBeDefined();
  });

  test("no caption prop -> no caption paragraph rendered", () => {
    render(<PhotoViewer {...PROPS} caption={undefined} open={true} onClose={vi.fn()} />);
    expect(screen.queryByText("Photo · 2 hours ago")).toBeNull();
  });

  test("clicking the × button closes it", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PhotoViewer {...PROPS} open={true} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  test("tapping outside the photo (the dark overlay) closes it", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PhotoViewer {...PROPS} open={true} onClose={onClose} />);
    const img = screen.getByRole("img", { name: PROPS.alt });
    // Click the overlay itself, not the image — its immediate parent.
    await user.click(img.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  test("tapping the photo itself does NOT close it", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PhotoViewer {...PROPS} open={true} onClose={onClose} />);
    await user.click(screen.getByRole("img", { name: PROPS.alt }));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Escape/cancel closes it (native <dialog> cancel event)", () => {
    const onClose = vi.fn();
    render(<PhotoViewer {...PROPS} open={true} onClose={onClose} />);
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    // jsdom doesn't synthesize a real Escape-triggers-cancel keyboard path
    // for showModal() dialogs, so this fires the same `close` event the
    // component listens on — proving OUR event wiring, which is the part
    // under test; the browser's native Escape->cancel->close chain itself
    // is platform behavior, not this component's code.
    fireEvent(dialog, new Event("close"));
    expect(onClose).toHaveBeenCalled();
  });
});
