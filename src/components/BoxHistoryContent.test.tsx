/**
 * BoxHistoryContent tests — /box/<id>/history, history-first log (#511,
 * 2026-09-19). Same next/navigation + fetch mocking convention as
 * BoxesActivityContent.test.tsx (PageNav needs usePathname; matchMedia stub
 * for its media-query hook).
 *
 * The pre-#511 "check-in panel" and "photo gallery" describe blocks that
 * used to live here are GONE, not just changed — #511's own acceptance
 * criteria state "Removed from this page: the card photo, sponsor band,
 * address, most needed, host note, check-in buttons, and the separate
 * photo grid (drop BoxCardBody from BoxHistoryContent)," which is the
 * written criterion authorizing deleting rather than updating those tests.
 * See this PR's own report for the real, un-fixed regression that removal
 * causes (a no-WebGL visitor's only check-in surface) — that tradeoff is
 * Atlas's/Kyle's to decide, not this component's.
 *
 * Privacy note: this page reuses the SAME useBoxActivity -> GET
 * /api/public/blessing-boxes/activity read path slice 3 already ships
 * (plus #511's `includeBoxExtras: true`), and that route's SQL excludes
 * `problem` reports, hidden check-ins, and any non-approved photo/sponsor
 * row for EVERY caller (see boxActivity.ts's own header and its own
 * exhaustive unit tests in boxActivity.test.ts) — there is no separate
 * filtering in this component to regression-test. What IS this component's
 * own responsibility, and what these tests actually assert, is that it
 * reuses that exact filtered endpoint (scoped to this one box via
 * `venueId`, with the extras flag on) and never a different query.
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

describe("BoxHistoryContent — reuses the filtered activity read path", () => {
  test("fetches the activity endpoint scoped to this box's id, with includeExtras=1, not a separate/unfiltered query", async () => {
    render(<BoxHistoryContent box={testBox} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/public/blessing-boxes/activity");
    expect(url).toContain("box=box-1");
    // #511 — this page is the one caller that asks for photo/sponsor
    // entries; see boxActivity.ts's own header for why this is a dedicated
    // flag, and BoxesActivityContent.test.tsx for the global feed's own
    // "never sends this" counterpart assertion.
    expect(url).toContain("includeExtras=1");
  });

  test("renders the box name as the page's own <h1> and exactly one 'Back to map' link in the page's top nav, pointed at ?venue=<id>", () => {
    render(<BoxHistoryContent box={testBox} />);
    expect(screen.getByRole("heading", { level: 1, name: "Test Blessing Box" })).toBeDefined();
    // Scoped to the "Page" nav landmark (PageNav's chrome bar) — SiteFooter
    // (every utility page's shared footer) also renders its own site-wide
    // "Back to map" link further down the page; that one is pre-existing
    // chrome, not the page-chrome/content duplicate this test guards against.
    const pageNav = screen.getByRole("navigation", { name: "Page" });
    // getByRole throws if more than one link matches within pageNav —
    // proves there's exactly one there.
    const back = within(pageNav).getByRole("link", { name: /Back to map/ });
    expect(back.getAttribute("href")).toBe("/?venue=box-1");
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

  // #511 — a real photo/sponsor row, end to end through this page's own
  // fetch + BoxActivityList render (the query-layer unit tests in
  // boxActivity.test.ts already cover the SQL; this is the wiring proof).
  test("renders a photo entry (thumbnail) and a sponsor entry from the activity feed", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        items: [
          {
            source: "photo",
            kind: "photo_added",
            detail: null,
            photoId: 9,
            createdAt: new Date().toISOString(),
            venueId: "box-1",
            venueName: "Test Blessing Box",
            venueAddress: "123 Test St",
          },
          {
            source: "sponsor",
            kind: "sponsor_added",
            detail: "Jane D.",
            photoId: null,
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
    expect(await screen.findByText(/A new photo was added/)).toBeDefined();
    expect(screen.getByRole("img").getAttribute("src")).toBe("/api/public/box-photos/9");
    expect(screen.getByText(/Jane D\. became a sponsor/)).toBeDefined();
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
