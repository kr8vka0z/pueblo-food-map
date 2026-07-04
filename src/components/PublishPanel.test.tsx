/**
 * PublishPanel tests (#256).
 *
 * Covers every AC at the component layer: the plain-language change summary
 * rendered from props, the all-zero "up to date" disabled state, the
 * confirm() gate (decline -> fetch never called; accept -> POST
 * /api/admin/publish), and each response-branch -> friendly-message mapping
 * (200 success + PR link, 503 not-configured, 502 GitHub failure, 422
 * validation, 403 expired session, and a network-level throw).
 *
 * Mocking pattern (window.confirm, fetch, next/navigation) mirrors
 * ArchiveVenueButton.test.tsx — the established convention for this
 * codebase's confirm-gated admin mutations.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import PublishPanel from "@/components/PublishPanel";
import type { PublishChangeSummary } from "@/lib/adminVenues";

const mockFetch = vi.fn();

function summary(overrides: Partial<PublishChangeSummary> = {}): PublishChangeSummary {
  return { newDrafts: 0, editedSincePublish: 0, archived: 0, ...overrides };
}

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PublishPanel — change summary", () => {
  test("renders the new/edited/archived counts from props", () => {
    render(<PublishPanel summary={summary({ newDrafts: 2, editedSincePublish: 1, archived: 0 })} />);

    expect(screen.getByText(/2 new/i)).toBeDefined();
    expect(screen.getByText(/1 edited/i)).toBeDefined();
    expect(screen.getByText(/0 removed/i)).toBeDefined();
  });

  test("an all-zero summary shows 'up to date' and disables the Publish button", () => {
    render(<PublishPanel summary={summary()} />);

    expect(screen.getByText(/public map is up to date/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
  });

  test("a non-zero summary leaves the Publish button enabled", () => {
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);
    expect(screen.getByRole("button", { name: /publish/i })).toBeEnabled();
  });
});

describe("PublishPanel — confirm gate", () => {
  test("declining the confirm dialog never calls fetch", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 2, editedSincePublish: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    const confirmMessage = (window.confirm as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(confirmMessage).toContain("2");
    expect(confirmMessage).toContain("1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("accepting the confirm dialog POSTs /api/admin/publish", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/42",
        prNumber: 42,
        reused: false,
        publishedCount: 2,
        snapshotCount: 3,
      }),
    );
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 2 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/publish");
    expect(init.method).toBe("POST");
  });
});

describe("PublishPanel — response branches", () => {
  test("200 success shows the published count, a PR link, and refreshes the page", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/42",
        prNumber: 42,
        reused: false,
        publishedCount: 2,
        snapshotCount: 3,
      }),
    );
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 2 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    expect(await screen.findByText(/published.*2 places/i)).toBeDefined();
    const link = screen.getByRole("link", { name: /change request/i });
    expect(link.getAttribute("href")).toBe("https://github.com/kr8vka0z/pueblo-food-map/pull/42");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText(/take a minute/i)).toBeDefined();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("503 publish_not_configured shows the calm not-set-up-yet message", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(jsonResponse(503, { ok: false, error: "publish_not_configured" }));
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringMatching(/publish key isn.t set up yet/i),
    );
  });

  test("502 github_commit_failed shows a retry message and says nothing changed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(jsonResponse(502, { ok: false, error: "github_commit_failed" }));
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn.t reach github/i);
    expect(alert.textContent).toMatch(/nothing was changed/i);
  });

  test("422 validation failure shows a validation message", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(
      jsonResponse(422, { ok: false, error: 'Publish aborted: row "bad" failed validation' }),
    );
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/didn.t pass validation/i);
  });

  test("403 shows a session-expired message", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce({ status: 403, json: async () => { throw new Error("not json"); } });
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/session expired/i);
  });

  test("a network-level throw shows a generic friendly retry message", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/went wrong/i);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
