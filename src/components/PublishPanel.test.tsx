/**
 * PublishPanel tests (#256).
 *
 * Covers every AC at the component layer: the plain-language change summary
 * rendered from props, the all-zero "up to date" disabled state, the
 * on-page confirm gate (first press and Cancel -> fetch never called; the
 * confirm's own Publish -> POST /api/admin/publish), and each
 * response-branch -> friendly-message mapping
 * (200 success + PR link, 503 not-configured, 502 GitHub failure, 422
 * validation, 403 expired session, and a network-level throw).
 *
 * Mocks fetch and next/navigation; the confirm is the real AdminConfirm,
 * pressed the way a person would (#926 decision 7).
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

/** Presses Publish, then the on-page confirm's own Publish (the trigger is hidden while it asks). */
async function publishAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^publish$/i }));
  await user.click(screen.getByRole("button", { name: /^publish$/i }));
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

  // #926 R3: the off Publish stays focusable (aria-disabled) and a press asks nothing.
  test("an all-zero summary shows 'up to date' and turns the Publish button off", async () => {
    render(<PublishPanel summary={summary()} />);

    expect(screen.getByText(/public map is up to date/i)).toBeDefined();
    const publish = screen.getByRole("button", { name: /publish/i });
    expect(publish).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(publish);
    expect(screen.queryByRole("group")).toBeNull();
  });

  test("a non-zero summary leaves the Publish button enabled", () => {
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);
    expect(screen.getByRole("button", { name: /publish/i })).not.toHaveAttribute("aria-disabled");
  });
});

describe("PublishPanel — confirm gate", () => {
  test("the first press only asks (with the counts); Cancel sends nothing and brings Publish back", async () => {
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 2, editedSincePublish: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    const question = screen.getByRole("group", { name: /publish 2 new places and 1 edited place/i });
    expect(question).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: /publish 2 new places/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^publish$/i })).toHaveFocus();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("the confirm's own Publish POSTs /api/admin/publish once", async () => {
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

    await publishAndConfirm(user);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/publish");
    expect(init.method).toBe("POST");
  });
});

describe("PublishPanel — response branches", () => {
  test("200 success shows the published count, a PR link, and refreshes the page", async () => {
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

    await publishAndConfirm(user);

    expect(await screen.findByText(/published.*2 places/i)).toBeDefined();
    const link = screen.getByRole("link", { name: /change request/i });
    expect(link.getAttribute("href")).toBe("https://github.com/kr8vka0z/pueblo-food-map/pull/42");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText(/take a minute/i)).toBeDefined();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("503 publish_not_configured shows the calm not-set-up-yet message", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(503, { ok: false, error: "publish_not_configured" }));
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await publishAndConfirm(user);

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringMatching(/publish key isn.t set up yet/i),
    );
  });

  test("502 github_commit_failed shows a retry message and says nothing changed", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(502, { ok: false, error: "github_commit_failed" }));
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await publishAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn.t reach github/i);
    expect(alert.textContent).toMatch(/nothing was changed/i);
  });

  test("422 validation failure shows a validation message", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(422, { ok: false, error: 'Publish aborted: row "bad" failed validation' }),
    );
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await publishAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/didn.t pass validation/i);
  });

  test("403 shows a session-expired message", async () => {
    mockFetch.mockResolvedValueOnce({ status: 403, json: async () => { throw new Error("not json"); } });
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await publishAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/session expired/i);
  });

  test("a network-level throw says the result is unknown and how to check", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await publishAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/didn.t finish/i);
    expect(alert.textContent).toMatch(/reload/i);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("PublishPanel — reviewHref (admin dashboard build)", () => {
  test("shows a 'Review changes' link to reviewHref only when there are unpublished changes", () => {
    const { rerender } = render(<PublishPanel summary={summary()} reviewHref="/admin/places" />);
    expect(screen.queryByRole("link", { name: "Review changes" })).toBeNull();

    rerender(<PublishPanel summary={summary({ newDrafts: 1 })} reviewHref="/admin/places" />);
    const link = screen.getByRole("link", { name: "Review changes" });
    expect(link.getAttribute("href")).toBe("/admin/places");
  });

  test("omitting reviewHref renders exactly as before (no link, no crash)", () => {
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
