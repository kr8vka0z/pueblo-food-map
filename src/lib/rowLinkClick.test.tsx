/**
 * rowLinkClick.test.tsx — a click anywhere on an admin table row opens the
 * row's own link, and only a plain left click on the row's own cells does
 * (#926). Driven through the real Events table (EventsList), one of the
 * three tables that use it.
 */

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EventsList from "@/components/EventsList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

function renderTable() {
  render(
    <EventsList
      events={[{ id: "evt-1", name: "Turkey drive", starts_at: "2026-11-20T17:00:00.000Z", ends_at: "2026-11-20T19:00:00.000Z", status: "published" }]}
    />,
  );
  const link = screen.getByRole("link", { name: "Edit Turkey drive" });
  // Count the clicks that reach the real link; stop them there, since jsdom
  // cannot navigate.
  const opened = vi.fn((e: Event) => e.preventDefault());
  link.addEventListener("click", opened);
  return { link, opened, cell: screen.getByText("Turkey drive") };
}

describe("openRowLink", () => {
  test("a plain click on a row's cell opens the row's link once", () => {
    const { cell, opened, link } = renderTable();
    fireEvent.click(cell);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0][0].target).toBe(link);
  });

  test("a click on the link itself is the link's own click, not a second one", () => {
    const { link, opened } = renderTable();
    fireEvent.click(link);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["a non-left button", { button: 1 }],
  ])("%s on a cell leaves the row alone (only the real link opens a new tab)", (_name, init) => {
    const { cell, opened } = renderTable();
    fireEvent.click(cell, init);
    expect(opened).not.toHaveBeenCalled();
  });

  test("a click that ends a text selection in the row does not open it", () => {
    const { cell, opened } = renderTable();
    const range = document.createRange();
    range.selectNodeContents(cell);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.click(cell);
    selection.removeAllRanges();
    expect(opened).not.toHaveBeenCalled();
  });
});
