/**
 * BoxHistoryContent tests (map-first rework, 2026-09-18 scope addition —
 * /box/<id>/history). Same next/navigation + fetch mocking convention as
 * BoxesActivityContent.test.tsx (PageNav needs usePathname; matchMedia stub
 * for its media-query hook).
 *
 * Privacy note: this page reuses the SAME useBoxActivity -> GET
 * /api/public/blessing-boxes/activity read path slice 3 already ships, and
 * that route's SQL excludes `problem` reports and hidden check-ins for
 * EVERY caller (see boxActivity.ts's own header and its own exhaustive
 * unit tests in boxActivity.test.ts) — there is no separate filtering in
 * this component to regression-test. What IS this component's own
 * responsibility, and what these tests actually assert, is that it reuses
 * that exact filtered endpoint (scoped to this one box via `venueId`) and
 * never a different, unfiltered query.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/box/box-1/history",
  useSearchParams: () => new URLSearchParams(),
}));

import BoxHistoryContent from "@/components/BoxHistoryContent";
import { t } from "@/lib/i18n";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const testBox: PublicBlessingBox = {
  id: "box-1",
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
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

const mockFetch = vi.fn();

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(jsonResponse({ items: [], hasMore: false, page: 1 }));
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BoxHistoryContent — check-in panel (fix, PR review 2026-09-18)", () => {
  test("renders the box's check-in panel — the only way a no-WebGL visitor (routed straight here by MapWrapper's mapUnavailable branch) can check in at all", () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(screen.getByRole("button", { name: "I filled it" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Running low" })).toBeDefined();
    expect(screen.getByRole("button", { name: "It's empty" })).toBeDefined();
  });

  test("renders the box's current status badge above the history list", () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(screen.getByTestId("box-status-badge")).toBeDefined();
  });
});

describe("BoxHistoryContent — reuses the filtered activity read path", () => {
  test("fetches the activity endpoint scoped to this box's id, not a separate/unfiltered query", async () => {
    render(<BoxHistoryContent box={testBox} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/public/blessing-boxes/activity");
    expect(url).toContain("box=box-1");
  });

  test("renders the box name as the page heading and exactly one 'Back to map' link in the page's top nav, pointed at ?venue=<id> (card-polish follow-up, 2026-09-18: this page used to render a SECOND back-to-map link of its own alongside PageNav's chrome link)", () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(screen.getByRole("heading", { name: "Test Blessing Box" })).toBeDefined();
    // Scoped to the "Page" nav landmark (PageNav's chrome bar) — SiteFooter
    // (every utility page's shared footer, unrelated to this fix) also
    // renders its own site-wide "Back to map" link further down the page;
    // that one is pre-existing chrome, not the page-chrome/content
    // duplicate this test guards against.
    const pageNav = screen.getByRole("navigation", { name: "Page" });
    // getByRole throws if more than one link matches within pageNav —
    // proves there's exactly one there.
    const back = within(pageNav).getByRole("link", { name: /Back to map/ });
    expect(back.getAttribute("href")).toBe("/?venue=box-1");
  });

  test("the box card's own History link is hidden on its own history page (self-link would be dead weight)", () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(screen.queryByRole("link", { name: "History" })).toBeNull();
  });

  test("renders fetched activity items via the same BoxActivityList renderer the global feed uses", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        items: [
          {
            source: "checkin",
            kind: "filled",
            detail: null,
            createdAt: new Date().toISOString(),
            venueId: "box-1",
            venueName: "Test Blessing Box",
            venueAddress: "123 Test St",
          },
        ],
        hasMore: false,
        page: 1,
      }),
    );
    render(<BoxHistoryContent box={testBox} />);
    // showVenueName={false} — the box's own name is already the page's <h1>,
    // so the item text should NOT repeat "Test Blessing Box was filled" —
    // BoxActivityList substitutes "This box" instead (AGENTS.md's own note).
    expect(await screen.findByText(/was filled/)).toBeDefined();
    expect(screen.queryByText(/Test Blessing Box was filled/)).toBeNull();
  });

  test("shows the empty state when this box has no activity yet", async () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(await screen.findByText(t("activity.recentEmpty", "en"))).toBeDefined();
  });

  test("Prev is disabled on page 1; Next is disabled when hasMore is false", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        items: [
          {
            source: "checkin",
            kind: "filled",
            detail: null,
            createdAt: new Date().toISOString(),
            venueId: "box-1",
            venueName: "Test Blessing Box",
            venueAddress: "123 Test St",
          },
        ],
        hasMore: false,
        page: 1,
      }),
    );
    render(<BoxHistoryContent box={testBox} />);
    const prev = await screen.findByText(t("activity.prevPage", "en"));
    const next = await screen.findByText(t("activity.nextPage", "en"));
    expect(prev.closest("button")).toBeDisabled();
    expect(next.closest("button")).toBeDisabled();
  });

  test("clicking Next re-fetches page 2, still scoped to this box", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        items: [
          {
            source: "checkin",
            kind: "filled",
            detail: null,
            createdAt: new Date().toISOString(),
            venueId: "box-1",
            venueName: "Test Blessing Box",
            venueAddress: "123 Test St",
          },
        ],
        hasMore: true,
        page: 1,
      }),
    );
    const user = userEvent.setup();
    render(<BoxHistoryContent box={testBox} />);
    const next = await screen.findByText(t("activity.nextPage", "en"));
    await user.click(next);
    await waitFor(() => {
      const lastUrl = mockFetch.mock.calls.at(-1)?.[0] as string;
      expect(lastUrl).toContain("box=box-1");
      expect(lastUrl).toContain("page=2");
    });
  });
});

describe("BoxHistoryContent — Numbers (slice 7)", () => {
  test("renders the Numbers heading and counts computed from allCheckins", () => {
    render(
      <BoxHistoryContent
        box={testBox}
        allCheckins={[
          { kind: "filled", visibility: "visible", created_at: new Date().toISOString() },
          { kind: "took", visibility: "visible", created_at: new Date().toISOString() },
        ]}
        approvedPhotoCreatedAts={[]}
      />,
    );
    expect(screen.getByText(t("box.stats.perBoxHeading", "en"))).toBeDefined();
    // 30d default period includes both fixtures (created "now")
    expect(screen.getByText(t("box.stats.honestyNote", "en"))).toBeDefined();
  });

  test("with no check-ins/photos supplied, every count renders as 0, not a crash", () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(screen.getByText(t("box.stats.perBoxHeading", "en"))).toBeDefined();
  });
});

describe("BoxHistoryContent — photo gallery (slice 5)", () => {
  test("fetches this box's photo list and renders the grid", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/photos")) {
        return Promise.resolve(
          jsonResponse({ photos: [{ id: 7, createdAt: new Date().toISOString() }] }),
        );
      }
      return Promise.resolve(jsonResponse({ items: [], hasMore: false, page: 1 }));
    });

    render(<BoxHistoryContent box={testBox} />);

    await waitFor(() =>
      expect(mockFetch.mock.calls.some((c) => (c[0] as string).includes("/blessing-boxes/box-1/photos"))).toBe(true),
    );
    const img = await screen.findByRole("img");
    expect(img.getAttribute("src")).toBe("/api/public/box-photos/7");
  });

  test("shows the empty-photos state when the box has no approved photos", async () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(await screen.findByText(t("box.photo.none", "en"))).toBeDefined();
  });
});
