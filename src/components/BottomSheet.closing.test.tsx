/**
 * BottomSheet.closing.test.tsx — the card stays on the closing sheet until
 * its close slide ends (#882 preview feedback: the card used to empty in one
 * frame on close, so there was nothing to slide away). The card sheet is the
 * native scroll sheet (ScrollSheet.tsx), whose close is a smooth scroll; the
 * held card is dropped on a timer. The slide itself was checked on the iOS
 * simulator (#923).
 */

import { describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";

const venue: Venue = {
  id: "v1",
  name: "Pueblo Test Pantry",
  category: "pantry",
  lat: 38.25,
  lng: -104.6,
  address: "123 Main St, Pueblo, CO 81003",
  hours_weekly: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
  source: "test",
  last_verified: "2026-01-01",
};

describe("BottomSheet closing", () => {
  test("keeps the last card (inert) while the sheet slides closed, then drops it", () => {
    vi.useFakeTimers();
    const view = render(<BottomSheet venue={venue} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Pueblo Test Pantry" })).toBeTruthy();

    view.rerender(<BottomSheet venue={null} onClose={() => {}} />);

    // Still there to slide away, but nothing on it can take focus or be read.
    expect(screen.getByText("Pueblo Test Pantry", { selector: "h2, h2 *" })).toBeTruthy();
    expect(document.querySelector("[data-scroll-sheet]")!.hasAttribute("inert")).toBe(true);

    // The close slide is a smooth scroll; the held card is dropped after SHEET_CLOSE_MS.
    act(() => vi.advanceTimersByTime(700));

    expect(screen.queryByText("Pueblo Test Pantry")).toBeNull();
    vi.useRealTimers();
  });
});
