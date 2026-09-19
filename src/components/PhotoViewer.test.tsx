/**
 * PhotoViewer tests (#508) — open/close via each of the four paths the
 * issue's acceptance criteria name: the × button, a tap outside the photo,
 * Escape, and (implicitly, same native mechanism as Escape) the browser
 * back/cancel gesture. Also covers the one thing a naive "click anywhere
 * closes" implementation would get wrong: tapping the photo itself must NOT
 * close it.
 */

import { useState } from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  test("Escape closes it (jsdom's Escape-closes-<dialog> polyfill, see vitest.setup.ts)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PhotoViewer {...PROPS} open={true} onClose={onClose} />);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("close() firing the native `close` event still calls onClose (e.g. programmatic close)", () => {
    const onClose = vi.fn();
    render(<PhotoViewer {...PROPS} open={true} onClose={onClose} />);
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    fireEvent(dialog, new Event("close"));
    expect(onClose).toHaveBeenCalled();
  });

  // Review fix pass item 2: focus explicitly returns to whatever opened the
  // viewer — not relied on native restore-focus (this file's own header).
  test("focus returns to the element that had focus when it opened", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            trigger
          </button>
          <PhotoViewer {...PROPS} open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "trigger" });
    await user.click(trigger);
    expect(screen.getByRole("dialog").querySelector("img")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(trigger);
  });
});
