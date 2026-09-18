/**
 * BoxCardBody tests (Blessing Boxes map-first rework, 2026-09-18).
 *
 * Covers the scope-addition requirement (Kyle, same day): the card renders
 * ONLY the single most recent check-in, never a list — plus the History
 * link's href and the conditional host/most-needed sections. Reuses
 * BoxCheckinPanel.test.tsx's own Turnstile-stub convention since
 * BoxCardBody renders that panel directly (not mocked).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
    hostNote: null,
    mostNeeded: null,
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    statusSince: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
  },
};

function renderCard(box: Partial<PublicBlessingBox["box"]> = {}, showExpandedDetails = true) {
  const fullBox: PublicBlessingBox = { ...BASE_BOX, box: { ...BASE_BOX.box, ...box } };
  return render(
    <LocaleProvider initialLocale="en">
      <BoxCardBody box={fullBox} showExpandedDetails={showExpandedDetails} />
    </LocaleProvider>,
  );
}

describe("BoxCardBody — most recent check-in only, never a list", () => {
  test("renders the single most recent check-in as one line", () => {
    renderCard({
      recentCheckins: [
        { kind: "filled", createdAt: "2026-09-17T09:00:00.000Z" },
        { kind: "took", createdAt: "2026-09-16T09:00:00.000Z" },
        { kind: "low", createdAt: "2026-09-15T09:00:00.000Z" },
      ],
    });
    const line = screen.getByTestId("box-recent-checkin");
    expect(line.textContent).toContain("Filled");
    // Not a list: only ONE check-in line rendered, the older two never appear
    // (scoped to the line itself — "Running low"/"Took something" are ALSO
    // BoxCheckinPanel's own button labels, which legitimately render below).
    expect(screen.queryAllByTestId("box-recent-checkin")).toHaveLength(1);
    expect(line.textContent).not.toContain("Took something");
    expect(line.textContent).not.toContain("Running low");
  });

  test("shows an empty-state line when there are no check-ins yet", () => {
    renderCard({ recentCheckins: [] });
    expect(screen.queryByTestId("box-recent-checkin")).toBeNull();
    expect(screen.getByText("No check-ins yet")).toBeDefined();
  });
});

describe("BoxCardBody — status badge", () => {
  test("renders the box's current status", () => {
    renderCard({ status: "empty" });
    const badge = screen.getByTestId("box-status-badge");
    expect(badge.textContent).toContain("Empty");
  });

  test("renders 'not marked filled yet' when lastFilledAt is null", () => {
    renderCard({ lastFilledAt: null });
    expect(screen.getByText("Not marked filled yet")).toBeDefined();
  });
});

describe("BoxCardBody — conditional sections", () => {
  test("most-needed section only renders when set", () => {
    const { rerender } = render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={{ ...BASE_BOX, box: { ...BASE_BOX.box, mostNeeded: null } }} />
      </LocaleProvider>,
    );
    expect(screen.queryByText("Most needed")).toBeNull();

    rerender(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={{ ...BASE_BOX, box: { ...BASE_BOX.box, mostNeeded: "Canned goods" } }} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Most needed")).toBeDefined();
    expect(screen.getByText("Canned goods")).toBeDefined();
  });

  test("host section only renders when hostName or hostNote is set, and only when expanded", () => {
    const noHost = renderCard({ hostName: null, hostNote: null }, true);
    expect(screen.queryByText("Host")).toBeNull();
    noHost.unmount();

    const withHost = renderCard({ hostName: "Jane Doe", hostNote: null }, true);
    expect(screen.getByText("Jane Doe")).toBeDefined();
    withHost.unmount();

    // Collapsed (showExpandedDetails=false): host section never renders even
    // when hostName is set — matches DesktopVenueWindow's collapsed/expanded
    // split for an ordinary venue.
    renderCard({ hostName: "Jane Doe", hostNote: null }, false);
    expect(screen.queryByText("Host", { selector: "h3" })).toBeNull();
  });
});

describe("BoxCardBody — History link", () => {
  test("links to /box/<id>/history when expanded", () => {
    renderCard({}, true);
    const link = screen.getByRole("link", { name: "History" });
    expect(link.getAttribute("href")).toBe("/box/test-box-1/history");
  });

  test("no History link when collapsed", () => {
    renderCard({}, false);
    expect(screen.queryByRole("link", { name: "History" })).toBeNull();
  });
});

describe("BoxCardBody — extension points render nothing today", () => {
  test("no photo or sponsor placeholder content appears", () => {
    renderCard();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
    expect(screen.queryByAltText(/photo/i)).toBeNull();
    expect(screen.queryByText(/cared for by/i)).toBeNull();
  });
});
