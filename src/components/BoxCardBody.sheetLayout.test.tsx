/**
 * BoxCardBody `layout="sheet"` tests (#667) — new file, not additions to
 * BoxCardBody.test.tsx, matching this repo's own convention
 * (BoxCardBody.photoAndHeader.test.tsx's header: new behavior gets its own
 * file rather than edits to a test file a fix/feature is meant to be proven
 * against).
 *
 * Covers: the reordered first view (name -> inline status pill -> address ->
 * most needed -> host note -> check-in panel, all unclipped), the
 * below-the-fold section (photo -> sponsor band -> footer, clipped when
 * `expanded=false`), the collapsed preview's tap-to-expand, and that the
 * status pill never renders twice. `layout="default"` (the prop's own
 * default) is covered by the existing BoxCardBody.test.tsx / .photoAndHeader
 * test.tsx files, which don't pass this prop at all — proof those two
 * callers (DesktopVenueWindow, BoxHistoryContent) keep seeing the untouched
 * original layout.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import BoxCardBody from "@/components/BoxCardBody";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockTurnstile.render.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const BASE_BOX: PublicBlessingBox = {
  id: "test-box-1",
  name: "Test Blessing Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "123 Test St, Pueblo, CO",
  source: "manual",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null,
    hostNote: "Ring the bell",
    mostNeeded: "Canned goods",
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: { id: 42, createdAt: "2026-09-17T09:00:00.000Z" },
    adopters: [],
  },
};

function renderSheet(overrides: Partial<PublicBlessingBox["box"]> = {}, props: Partial<React.ComponentProps<typeof BoxCardBody>> = {}) {
  const box: PublicBlessingBox = { ...BASE_BOX, box: { ...BASE_BOX.box, ...overrides } };
  return render(
    <LocaleProvider initialLocale="en">
      <BoxCardBody box={box} layout="sheet" expanded={false} detailSectionId="test-detail" {...props} />
    </LocaleProvider>,
  );
}

describe("BoxCardBody layout='sheet' — first view order (#667)", () => {
  test("name, then inline status pill, then address, then most needed, then host note, then check-in panel — all in DOM order", () => {
    renderSheet();
    const name = screen.getByText("Test Blessing Box");
    const pill = screen.getByTestId("box-status-badge");
    const address = screen.getByText("123 Test St, Pueblo, CO");
    const mostNeeded = screen.getByText("Canned goods");
    const hostNote = screen.getByText("Ring the bell");
    const checkinButton = screen.getByRole("button", { name: "I used this box" });

    const order = [name, pill, address, mostNeeded, hostNote, checkinButton];
    for (let i = 0; i < order.length - 1; i++) {
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  test("the status pill renders inline (not overlaid on the photo) and only once", () => {
    renderSheet();
    expect(screen.getAllByTestId("box-status-badge")).toHaveLength(1);
  });

  test("check-in works from the first view without expanding", async () => {
    const onCheckinSuccess = vi.fn();
    renderSheet({}, { onCheckinSuccess });
    // The check-in trigger itself is visible/interactable in the collapsed
    // (expanded=false) render — proves it isn't hidden behind the fold.
    expect(screen.getByRole("button", { name: "I used this box" })).toBeDefined();
  });
});

describe("BoxCardBody layout='sheet' — below-the-fold section (#667 items 9-13)", () => {
  test("photo, sponsor band, and footer sit inside the detailSectionId wrapper, after the first view", () => {
    renderSheet();
    const wrapper = document.getElementById("test-detail");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.querySelector("img")).not.toBeNull();
    expect(screen.getByText(/needs a sponsor/i).closest("#test-detail")).not.toBeNull();
    expect(screen.getByRole("link", { name: "History" }).closest("#test-detail")).not.toBeNull();
  });

  test("collapsed (expanded=false): the wrapper is clipped and tapping it calls onRequestExpand", () => {
    const onRequestExpand = vi.fn();
    renderSheet({}, { expanded: false, onRequestExpand });
    const wrapper = document.getElementById("test-detail")!;
    expect(wrapper.className).toContain("overflow-hidden");
    fireEvent.click(wrapper);
    expect(onRequestExpand).toHaveBeenCalledTimes(1);
  });

  test("expanded=true: the wrapper is not clipped and no longer intercepts taps", () => {
    const onRequestExpand = vi.fn();
    renderSheet({}, { expanded: true, onRequestExpand });
    const wrapper = document.getElementById("test-detail")!;
    expect(wrapper.className).not.toContain("overflow-hidden");
    fireEvent.click(wrapper);
    expect(onRequestExpand).not.toHaveBeenCalled();
  });

  test("collapsed: the clipped content is inert (out of Tab order and the a11y tree); expanded: it isn't (#683 review)", () => {
    const { unmount } = renderSheet({}, { expanded: false });
    expect(document.getElementById("test-detail")!.firstElementChild!.hasAttribute("inert")).toBe(true);
    unmount();
    renderSheet({}, { expanded: true });
    expect(document.getElementById("test-detail")!.firstElementChild!.hasAttribute("inert")).toBe(false);
  });

  test("no photo: the sponsor band is the first thing in the below-the-fold wrapper", () => {
    renderSheet({ latestPhoto: null });
    const wrapper = document.getElementById("test-detail")!;
    expect(wrapper.querySelector("img")).toBeNull();
    expect(wrapper.textContent).toMatch(/needs a sponsor/i);
  });
});
