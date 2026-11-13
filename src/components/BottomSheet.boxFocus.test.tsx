/**
 * BottomSheet.boxFocus.test.tsx — focus on a box card whose record arrives
 * after the sheet opened (PR #925 review). The first box opening shows a
 * "Loading…" line with no heading; when the card arrives no focus-effect
 * dependency changes, so focus must still reach the box's name, return to
 * the pin on close, and never be taken back from a control the person
 * moved to while it loaded.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import { waitForBoxCard } from "@/lib/testing/waitForBoxCard.testutil";

const boxVenue: Venue = {
  id: "box-1",
  name: "Elm Street Blessing Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "300 Example Ln, Pueblo, CO 81001",
  source: "manual",
  last_verified: "2026-09-01",
};

const box: PublicBlessingBox = {
  ...boxVenue,
  category: "blessing_box",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: "Canned food",
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("turnstile", { render: vi.fn(() => "widget-id-1"), reset: vi.fn(), remove: vi.fn() });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Page({ boxVenueShown, boxRecord }: { boxVenueShown: boolean; boxRecord: PublicBlessingBox | null }) {
  return (
    <>
      <button type="button" data-testid="pin">
        pin
      </button>
      <button type="button" data-testid="search">
        search
      </button>
      <BottomSheet venue={boxVenueShown ? boxVenue : null} box={boxRecord} onClose={() => {}} />
    </>
  );
}

const sheetName = () => document.querySelector<HTMLElement>("[data-scroll-sheet] h2");

describe("BottomSheet box card focus", () => {
  test("a box that loads after opening still gets focus on its name, and closing returns it to the pin", async () => {
    const view = render(<Page boxVenueShown={false} boxRecord={null} />);
    const pin = document.querySelector<HTMLElement>("[data-testid=pin]")!;
    pin.focus();

    view.rerender(<Page boxVenueShown boxRecord={null} />);
    expect(sheetName()).toBeNull(); // still "Loading…"

    view.rerender(<Page boxVenueShown boxRecord={box} />);
    await waitForBoxCard();
    await waitFor(() => expect(document.activeElement).toBe(sheetName()));

    view.rerender(<Page boxVenueShown={false} boxRecord={null} />);
    await waitFor(() => expect(document.activeElement).toBe(pin));
  });

  test("a control the person moved to while the box loaded keeps focus", async () => {
    const view = render(<Page boxVenueShown={false} boxRecord={null} />);
    document.querySelector<HTMLElement>("[data-testid=pin]")!.focus();
    view.rerender(<Page boxVenueShown boxRecord={null} />);

    const search = document.querySelector<HTMLElement>("[data-testid=search]")!;
    search.focus();
    view.rerender(<Page boxVenueShown boxRecord={box} />);
    await waitForBoxCard();
    expect(sheetName()).not.toBeNull();
    // Give a deferred focus every chance to fire.
    await new Promise((r) => setTimeout(r, 20));
    expect(document.activeElement).toBe(search);
  });
});
