/**
 * BottomSheet.closing.test.tsx — the card stays on the closing sheet until
 * vaul's close animation ends (#882 preview feedback: the card used to empty
 * in one frame on close, so vaul had nothing to slide away). vaul is mocked the
 * way Radix Presence behaves for real: the content stays mounted while closing,
 * and the test fires `onAnimationEnd(false)` where vaul would. The slide itself
 * was checked in a real browser (see the PR).
 */

import { describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";

const rootProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("vaul", () => {
  const passthrough = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Drawer: {
      Root: ({ children, ...rest }: { children: React.ReactNode; [key: string]: unknown }) => {
        rootProps.current = rest;
        return <div>{children}</div>;
      },
      Portal: passthrough,
      Content: ({ children, ref, ...rest }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
        <div data-testid="vaul-content" ref={ref} {...rest}>{children}</div>
      ),
      Title: passthrough,
      Description: passthrough,
    },
  };
});

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
  test("keeps the last card (inert) while vaul animates closed, then drops it", () => {
    const view = render(<BottomSheet venue={venue} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Pueblo Test Pantry" })).toBeTruthy();

    view.rerender(<BottomSheet venue={null} onClose={() => {}} />);

    // Still there to slide away, but nothing on it can take focus or be read.
    expect(screen.getByText("Pueblo Test Pantry", { selector: "h2, h2 *" })).toBeTruthy();
    expect(screen.getByTestId("vaul-content").hasAttribute("inert")).toBe(true);

    act(() => (rootProps.current.onAnimationEnd as (open: boolean) => void)(false));

    expect(screen.queryByText("Pueblo Test Pantry")).toBeNull();
  });
});
