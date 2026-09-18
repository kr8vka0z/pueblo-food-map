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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/box/box-1/history",
  useSearchParams: () => new URLSearchParams(),
}));

import BoxHistoryContent from "@/components/BoxHistoryContent";
import { t } from "@/lib/i18n";

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
  test("fetches the activity endpoint scoped to this box's id, not a separate/unfiltered query", async () => {
    render(<BoxHistoryContent boxId="box-1" boxName="Test Blessing Box" />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/public/blessing-boxes/activity");
    expect(url).toContain("box=box-1");
  });

  test("renders the box name as the page heading and a 'Back to the map' link to ?venue=<id>", () => {
    render(<BoxHistoryContent boxId="box-1" boxName="Test Blessing Box" />);
    expect(screen.getByRole("heading", { name: "Test Blessing Box" })).toBeDefined();
    const back = screen.getByRole("link", { name: t("box.history.back", "en") });
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
    render(<BoxHistoryContent boxId="box-1" boxName="Test Blessing Box" />);
    // showVenueName={false} — the box's own name is already the page's <h1>,
    // so the item text should NOT repeat "Test Blessing Box was filled" —
    // BoxActivityList substitutes "This box" instead (AGENTS.md's own note).
    expect(await screen.findByText(/was filled/)).toBeDefined();
    expect(screen.queryByText(/Test Blessing Box was filled/)).toBeNull();
  });

  test("shows the empty state when this box has no activity yet", async () => {
    render(<BoxHistoryContent boxId="box-1" boxName="Test Blessing Box" />);
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
    render(<BoxHistoryContent boxId="box-1" boxName="Test Blessing Box" />);
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
    render(<BoxHistoryContent boxId="box-1" boxName="Test Blessing Box" />);
    const next = await screen.findByText(t("activity.nextPage", "en"));
    await user.click(next);
    await waitFor(() => {
      const lastUrl = mockFetch.mock.calls.at(-1)?.[0] as string;
      expect(lastUrl).toContain("box=box-1");
      expect(lastUrl).toContain("page=2");
    });
  });
});
