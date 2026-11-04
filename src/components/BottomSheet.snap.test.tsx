/**
 * BottomSheet.snap.test.tsx — the sheet's collapsed snap point is measured from
 * the COLLAPSED layout only (#882, found on the iOS simulator: after "Read more"
 * opened About on the fully open sheet, re-measuring the first view made the
 * collapsed height reach the fully open one, leaving a single snap point, so a
 * flick down sprang back instead of collapsing). jsdom has no layout, so the
 * sheet's geometry is stubbed; vaul is mocked to capture its snap points.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
        <div ref={ref} {...rest}>{children}</div>
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

// Window 740 tall, sheet 640 tall with its top at 100, scroller from 160,
// content 1000 tall (taller than the sheet, so fully open is `1`).
let detailTop = 400;
beforeEach(() => {
  detailTop = 400;
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(740);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = this.hasAttribute("data-bottom-sheet")
      ? 100
      : this.hasAttribute("data-sheet-scroller")
        ? 160
        : this.id === "bottomsheet-detail"
          ? detailTop
          : 0;
    return { top, height: 0 } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-bottom-sheet") ? 640 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-sheet-scroller") ? 1000 : 0;
  });
});
afterEach(() => vi.restoreAllMocks());

describe("BottomSheet snap points", () => {
  test("a first view that grows while fully open does not move the collapsed snap point", () => {
    const view = render(<BottomSheet venue={venue} onClose={() => {}} />);
    // Collapsed: detail top 400 - sheet top 100 + 64px peek, plus the 100px base offset.
    expect(rootProps.current.snapPoints).toEqual(["464px", 1]);

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    detailTop = 900; // e.g. About opened with "Read more"
    view.rerender(<BottomSheet venue={venue} onClose={() => {}} />);

    expect(rootProps.current.snapPoints).toEqual(["464px", 1]);
  });
});
