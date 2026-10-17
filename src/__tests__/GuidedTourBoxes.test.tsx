/**
 * Guided tour Blessing Box steps (#159) through the real MapWrapper (phone
 * layout, real BottomSheet + BoxCardBody): the tour must never send anything
 * (no check-in, photo, sponsor or alert request — only GETs), must hand the
 * visitor's Boxes view back exactly as it was on every way out, and must
 * leave the box steps out cleanly when the live box feed has no box.
 * Mock recipe: GuidedTourDemos.test.tsx.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import * as LocaleContext from "@/lib/LocaleContext";
import { TOUR_COPY, TOUR_STEPS, tourSteps } from "@/lib/guidedTour";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => true }));
vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { ResolvedComponent = mod.default; });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    return DynamicWrapper;
  },
}));
vi.mock("@/components/Map", () => ({ default: () => null }));

const EN = TOUR_COPY.en;
const BOX: PublicBlessingBox = {
  id: "tour-box-1",
  name: "Tour Test Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "123 Test St, Pueblo, CO",
  source: "manual",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: null,
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

let fetchMock: ReturnType<typeof vi.fn>;
function stubFeed(boxes: PublicBlessingBox[]) {
  fetchMock = vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => (String(url).includes("/api/public/blessing-boxes") ? { boxes } : { events: [] }),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
}
/** Every request the page made that wasn't a plain read. */
const writes = () =>
  fetchMock.mock.calls.filter(([, init]) => {
    const method = (init as RequestInit | undefined)?.method ?? "GET";
    return method.toUpperCase() !== "GET";
  });

beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  // Phone layout (the shared mock answers every media query alike).
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  stubFeed([BOX]);
});
afterEach(() => vi.unstubAllGlobals());

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const boxesOn = () => screen.getByTestId("nav-boxes").getAttribute("aria-pressed");
const stepIndex = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);
function next(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole("button", { name: EN.next }));
}

/** Renders the map, lets the box feed land, optionally has the visitor tap Boxes, then starts the tour. */
async function renderThenTour({ visitorBoxesOn = false } = {}) {
  const { rerender } = render(
    <LocaleContext.LocaleProvider initialLocale="en">
      <MapWrapper />
    </LocaleContext.LocaleProvider>,
  );
  await flush();
  await flush();
  if (visitorBoxesOn) fireEvent.click(screen.getByTestId("nav-boxes"));
  expect(boxesOn()).toBe(String(visitorBoxesOn));
  rerender(
    <LocaleContext.LocaleProvider initialLocale="en">
      <MapWrapper tourRequestId={1} />
    </LocaleContext.LocaleProvider>,
  );
  await flush();
  await waitFor(() => expect(screen.getByTestId("guided-tour")).toBeTruthy());
}

describe("Blessing Box steps", () => {
  test("open the Boxes view and the sample box's card, send nothing, and Skip hands everything back", async () => {
    await renderThenTour();
    next(stepIndex("boxesMap"));
    expect(boxesOn()).toBe("true");

    next(); // boxCheckin: the box's card is open on its check-in buttons
    await waitFor(() => expect(screen.getByRole("heading", { name: /update this box/i })).toBeTruthy());
    next(2); // photo, then the sponsor/alerts step (sheet held open)
    await waitFor(() => expect(document.querySelector('[data-tour="box-alerts"]')).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: EN.back }));
    expect(screen.getByRole("heading", { level: 2, name: EN.steps.boxPhoto.title })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    expect(boxesOn()).toBe("false");
    expect(screen.queryByRole("heading", { name: /update this box/i })).toBeNull();
    expect(writes()).toEqual([]);
  });

  test("leaving the box section mid-tour turns the Boxes view off again", async () => {
    await renderThenTour();
    next(stepIndex("boxHelp"));
    next(); // Near me
    await waitFor(() => expect(boxesOn()).toBe("false"));
    expect(writes()).toEqual([]);
  });

  test("a visitor already in the Boxes view gets it back after Escape on a box step", async () => {
    await renderThenTour({ visitorBoxesOn: true });
    // The tour lifted the visitor's filters at start.
    expect(boxesOn()).toBe("false");
    next(stepIndex("boxCheckin"));
    await waitFor(() => expect(screen.getByRole("heading", { name: /update this box/i })).toBeTruthy());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    expect(boxesOn()).toBe("true");
    expect(screen.queryByRole("heading", { name: /update this box/i })).toBeNull();
  });

  test("no box in the live feed: the box pin/card steps are left out, the tour still ends cleanly", async () => {
    stubFeed([]);
    await renderThenTour();
    const shown = tourSteps(false);
    expect(screen.getByText(EN.counter(1, shown.length))).toBeTruthy();
    next(shown.findIndex((s) => s.id === "boxesNav") + 1);
    expect(screen.getByRole("heading", { level: 2, name: EN.steps.nearMe.title })).toBeTruthy();
    expect(boxesOn()).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
  });
});
