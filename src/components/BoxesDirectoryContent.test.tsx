/**
 * BoxesDirectoryContent tests (Blessing Boxes slice 4).
 *
 * Covers the acceptance-criteria behaviors named in the slice's own task:
 * default "needs filling most" ordering, the hide-reported-empty toggle
 * (B3), distance sort with and without location (B2) — including the
 * load-bearing privacy assertion that the visitor's coordinates never
 * appear in the outbound fetch — and the empty state a D1-unreachable
 * response degrades to (matching the live route's own best-effort
 * fallback, GET /api/public/blessing-boxes's `{boxes: []}` on failure).
 *
 * navigator.permissions/geolocation are stubbed directly (same convention
 * as src/__tests__/page.test.tsx and CategoryAutoZoomHomeView.test.tsx),
 * not a vi.mock of useGeolocation itself — this exercises the real hook.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// PageNav (rendered inside BoxesDirectoryContent) needs next/navigation's
// router context — same local override BoxesActivityContent.test.tsx's own
// header documents ("PageNav needs usePathname").
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/boxes",
}));

import { LocaleProvider } from "@/lib/LocaleContext";
import BoxesDirectoryContent from "@/components/BoxesDirectoryContent";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

function makeBox(overrides: {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: PublicBlessingBox["box"]["status"];
  statusSince?: string | null;
  lastFilledAt?: string | null;
  mostNeeded?: string | null;
}): PublicBlessingBox {
  return {
    id: overrides.id,
    name: overrides.name,
    category: "blessing_box",
    lat: overrides.lat,
    lng: overrides.lng,
    address: `${overrides.name} address`,
    source: "test",
    last_verified: "2026-09-17",
    box: {
      hostName: null,
      hostNote: null,
      mostNeeded: overrides.mostNeeded ?? null,
      installedOn: null,
      removedOn: null,
      status: overrides.status,
      lastFilledAt: overrides.lastFilledAt ?? null,
      statusSince: overrides.statusSince ?? null,
      recentCheckins: [],
    },
  };
}

// Pueblo-ish coordinates: NEAR_BOX sits a few blocks from the stubbed
// origin; FAR_BOX sits clear across town — real degrees apart, enough that
// haversineMiles orders them unambiguously.
const ORIGIN = { lat: 38.259, lng: -104.6256 };
const NEAR_BOX = makeBox({
  id: "near-box",
  name: "Near Box",
  lat: 38.26,
  lng: -104.626,
  status: "stocked",
  lastFilledAt: "2026-09-16T00:00:00.000Z",
});
const FAR_BOX = makeBox({
  id: "far-box",
  name: "Far Box",
  lat: 38.4,
  lng: -104.9,
  status: "empty",
  statusSince: "2026-09-01T00:00:00.000Z",
  mostNeeded: "Canned soup",
});

const mockFetch = vi.fn();

function mockBoxesResponse(boxes: PublicBlessingBox[]) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ boxes }) });
}

function stubGeolocation(opts: { granted: boolean }) {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
        if (opts.granted) {
          success({
            coords: { latitude: ORIGIN.lat, longitude: ORIGIN.lng } as GeolocationCoordinates,
          } as GeolocationPosition);
        } else {
          error?.({ code: 1, message: "denied" } as GeolocationPositionError);
        }
      }),
    },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  // PageNav uses a media-query hook jsdom doesn't implement — same stub
  // BoxesActivityContent.test.tsx's own beforeEach establishes.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <LocaleProvider initialLocale="en">
      <BoxesDirectoryContent />
    </LocaleProvider>,
  );
}

// Scoped to the boxes list itself — BottomNav (also rendered, via PageNav)
// contributes its own <li> "listitem" roles, so an unscoped
// getAllByRole("listitem") counts both.
function listItems() {
  return within(screen.getByTestId("boxes-list")).getAllByRole("listitem");
}

describe("BoxesDirectoryContent — default ordering", () => {
  test("default sort is 'needs filling most' — the empty box leads, ahead of a stocked one", async () => {
    stubGeolocation({ granted: false });
    mockBoxesResponse([NEAR_BOX, FAR_BOX]);
    renderPage();

    await waitFor(() => expect(screen.getByTestId("boxes-list")).toBeDefined());
    const names = screen.getAllByRole("link", { name: /Box$/ }).map((el) => el.textContent);
    expect(names).toEqual(["Far Box", "Near Box"]);
  });

  test("most-needed list is surfaced on a row that has one", async () => {
    stubGeolocation({ granted: false });
    mockBoxesResponse([NEAR_BOX, FAR_BOX]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/Canned soup/)).toBeDefined());
  });

  test("result count is announced via one aria-live line, not the whole list", async () => {
    stubGeolocation({ granted: false });
    mockBoxesResponse([NEAR_BOX, FAR_BOX]);
    renderPage();

    const status = await screen.findByText("2 boxes");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByTestId("boxes-list").getAttribute("aria-live")).toBeNull();
  });
});

describe("BoxesDirectoryContent — B3 hide reported-empty", () => {
  test("the checkbox is a real, labeled control", async () => {
    stubGeolocation({ granted: false });
    mockBoxesResponse([NEAR_BOX, FAR_BOX]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId("boxes-list")).toBeDefined());
    expect(screen.getByRole("checkbox", { name: "Hide boxes reported empty" })).toBeDefined();
  });

  test("checking it removes the empty box from the list", async () => {
    stubGeolocation({ granted: false });
    mockBoxesResponse([NEAR_BOX, FAR_BOX]);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listItems()).toHaveLength(2));

    await user.click(screen.getByRole("checkbox", { name: "Hide boxes reported empty" }));

    await waitFor(() => expect(listItems()).toHaveLength(1));
    expect(screen.getByText("Near Box")).toBeDefined();
    expect(screen.queryByText("Far Box")).toBeNull();
  });
});

describe("BoxesDirectoryContent — B2 closest to me", () => {
  test("with location granted, selecting 'Closest to me' sorts by real distance", async () => {
    stubGeolocation({ granted: true });
    mockBoxesResponse([FAR_BOX, NEAR_BOX]);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listItems()).toHaveLength(2));

    await user.selectOptions(screen.getByLabelText("Sort by"), "closest");

    await waitFor(() => {
      const names = screen.getAllByRole("link", { name: /Box$/ }).map((el) => el.textContent);
      expect(names).toEqual(["Near Box", "Far Box"]);
    });
    // Honest distance framing (task's own requirement — not walking distance).
    expect(screen.getByText("Distance shown is a straight line, not a walking route.")).toBeDefined();
  });

  test("without location, the page stays fully usable — falls back to the default order with an honest message", async () => {
    stubGeolocation({ granted: false });
    mockBoxesResponse([NEAR_BOX, FAR_BOX]);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listItems()).toHaveLength(2));

    await user.selectOptions(screen.getByLabelText("Sort by"), "closest");

    await waitFor(() =>
      expect(
        screen.getByText(
          "Location isn't available on this device. Showing the boxes that need filling most instead.",
        ),
      ).toBeDefined(),
    );
    // Still a full, usable list — needs-filling order, not blank.
    const names = screen.getAllByRole("link", { name: /Box$/ }).map((el) => el.textContent);
    expect(names).toEqual(["Far Box", "Near Box"]);
  });

  test("the visitor's coordinates never appear in the outbound fetch, before or after granting location", async () => {
    stubGeolocation({ granted: true });
    mockBoxesResponse([NEAR_BOX, FAR_BOX]);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listItems()).toHaveLength(2));

    await user.selectOptions(screen.getByLabelText("Sort by"), "closest");
    await waitFor(() => expect(screen.getByText(/straight line/)).toBeDefined());

    // Exactly one fetch, ever — the box list is fetched once on mount;
    // sorting by distance is pure client-side math over that same response.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("/api/public/blessing-boxes");
    expect(String(url)).not.toMatch(/lat|lng|latitude|longitude/i);
    expect(init).toBeUndefined();
  });
});

describe("BoxesDirectoryContent — empty state", () => {
  test("a D1-unreachable {boxes: []} response (the live route's own best-effort fallback) shows the empty state, not an error", async () => {
    stubGeolocation({ granted: false });
    mockBoxesResponse([]);
    renderPage();

    await waitFor(() => expect(screen.getByTestId("boxes-empty")).toBeDefined());
    expect(screen.getByText("No blessing boxes to show right now.")).toBeDefined();
    expect(screen.queryByTestId("boxes-list")).toBeNull();
  });
});
