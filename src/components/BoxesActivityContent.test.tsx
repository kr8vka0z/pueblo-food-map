/**
 * BoxesActivityContent tests (Blessing Boxes slice 3 — /boxes/activity).
 * `next/navigation` is re-mocked locally (usePathname + useSearchParams,
 * both real implementations that need Next router context this jsdom
 * render doesn't provide — same "PageNav needs usePathname" reasoning
 * PageNav.test.tsx's own local override documents) and global fetch is
 * stubbed (same convention as BoxContent.test.tsx / BoxCheckinsAdminPanel.test.tsx)
 * so nothing here makes a real network call.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/boxes/activity",
  useSearchParams: () => searchParamsValue,
}));

import BoxesActivityContent from "@/components/BoxesActivityContent";
import { t } from "@/lib/i18n";

const mockFetch = vi.fn();

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  // PageNav (rendered inside BoxesActivityContent) uses a media-query hook
  // jsdom doesn't implement — same stub PageNav.test.tsx's own beforeEach
  // establishes.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  searchParamsValue = new URLSearchParams();
  mockFetch.mockReset();
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/blessing-boxes/activity")) {
      return Promise.resolve(jsonResponse({ items: [], hasMore: false, page: 1 }));
    }
    // useBoxVenues() -> GET /api/public/blessing-boxes
    return Promise.resolve(jsonResponse({ boxes: [] }));
  });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BoxesActivityContent", () => {
  test("renders the heading and intro (EN)", () => {
    render(<BoxesActivityContent />);
    expect(screen.getByText(t("activity.heading", "en"))).toBeDefined();
    expect(screen.getByText(t("activity.intro", "en"))).toBeDefined();
  });

  test("filter controls have real labels (accessibility)", () => {
    render(<BoxesActivityContent />);
    expect(screen.getByLabelText(t("activity.filters.box", "en"))).toBeDefined();
    expect(screen.getByLabelText(t("activity.filters.kind", "en"))).toBeDefined();
    expect(screen.getByLabelText(t("activity.filters.from", "en"))).toBeDefined();
    expect(screen.getByLabelText(t("activity.filters.to", "en"))).toBeDefined();
  });

  test("initial `?box=<id>` query param pre-selects that box in the filter", async () => {
    searchParamsValue = new URLSearchParams("box=box-1");
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/activity")) return Promise.resolve(jsonResponse({ items: [], hasMore: false, page: 1 }));
      return Promise.resolve(
        jsonResponse({
          boxes: [{ id: "box-1", name: "Blessing Box - 216 W Routt", category: "blessing_box", lat: 0, lng: 0, address: "", source: "", last_verified: "" }],
        }),
      );
    });
    render(<BoxesActivityContent />);
    // A native <select> ignores a `value` with no matching <option> yet —
    // wait for useBoxVenues' own fetch to populate the box-1 option before
    // asserting the select actually reflects it.
    await waitFor(() => {
      const select = screen.getByLabelText(t("activity.filters.box", "en")) as HTMLSelectElement;
      expect(select.value).toBe("box-1");
    });
  });

  test("renders fetched activity items", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/blessing-boxes/activity")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                source: "checkin",
                kind: "filled",
                detail: null,
                createdAt: new Date().toISOString(),
                venueId: "box-1",
                venueName: "Blessing Box - 216 W Routt",
                venueAddress: "216 W Routt Ave",
              },
            ],
            hasMore: false,
            page: 1,
          }),
        );
      }
      return Promise.resolve(jsonResponse({ boxes: [] }));
    });
    render(<BoxesActivityContent />);
    expect(await screen.findByText(/Blessing Box - 216 W Routt was filled/)).toBeDefined();
  });

  test("changing a filter re-fetches with the new query param", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/blessing-boxes")) {
        if (url.includes("/activity")) return Promise.resolve(jsonResponse({ items: [], hasMore: false, page: 1 }));
        return Promise.resolve(
          jsonResponse({
            boxes: [{ id: "box-1", name: "Blessing Box - 216 W Routt", category: "blessing_box", lat: 0, lng: 0, address: "", source: "", last_verified: "" }],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    render(<BoxesActivityContent />);
    await waitFor(() => expect(screen.getByLabelText(t("activity.filters.box", "en")) as HTMLSelectElement).toBeDefined());

    const user = userEvent.setup();
    const kindSelect = screen.getByLabelText(t("activity.filters.kind", "en"));
    await user.selectOptions(kindSelect, "filled");

    await waitFor(() => {
      const lastUrl = mockFetch.mock.calls.at(-1)?.[0] as string;
      expect(lastUrl).toContain("kind=filled");
    });
  });

  test("'Clear filters' only shows once a filter is active, and resets it", async () => {
    render(<BoxesActivityContent />);
    expect(screen.queryByText(t("activity.filters.clear", "en"))).toBeNull();

    const user = userEvent.setup();
    const kindSelect = screen.getByLabelText(t("activity.filters.kind", "en"));
    await user.selectOptions(kindSelect, "filled");

    const clearButton = await screen.findByText(t("activity.filters.clear", "en"));
    await user.click(clearButton);
    expect((kindSelect as HTMLSelectElement).value).toBe("");
  });

  test("shows the empty state when there is no activity", async () => {
    render(<BoxesActivityContent />);
    expect(await screen.findByText(t("activity.empty", "en"))).toBeDefined();
  });

  test("Next page button is disabled when hasMore is false", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/activity")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                source: "checkin",
                kind: "filled",
                detail: null,
                createdAt: new Date().toISOString(),
                venueId: "box-1",
                venueName: "Box",
                venueAddress: "1 Main St",
              },
            ],
            hasMore: false,
            page: 1,
          }),
        );
      }
      return Promise.resolve(jsonResponse({ boxes: [] }));
    });
    render(<BoxesActivityContent />);
    const next = await screen.findByText(t("activity.nextPage", "en"));
    expect(next.closest("button")).toBeDisabled();
  });
});
