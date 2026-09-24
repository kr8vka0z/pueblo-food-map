/**
 * Regression test for #568 item 2 — new file because
 * src/components/PublishPanel.test.tsx is an existing test file
 * (write-guarded on fix/* branches); this covers ONLY the new
 * "N removed" success-message segment, not the rest of the panel (see that
 * file for the confirm gate, error-branch mapping, and every other AC).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PublishPanel — removals-only publish (#568 item 2)", () => {
  test("a removals-only publish (publishedCount 0, archivedCount 3) shows the removal count, not just '0 places pushed'", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/50",
        prNumber: 50,
        reused: false,
        publishedCount: 0,
        archivedCount: 3,
        snapshotCount: 10,
      }),
    );
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ archived: 3 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    expect(await screen.findByText(/0 places pushed, 3 places removed/i)).toBeDefined();
  });

  test("a response with no archivedCount field (older/mocked shape) still renders the pushed count alone, unchanged", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/51",
        prNumber: 51,
        reused: false,
        publishedCount: 2,
        snapshotCount: 5,
      }),
    );
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 2 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    // Scoped to the success paragraph specifically — the pre-publish change
    // summary above it always shows its own "N removed since the last
    // publish" text regardless, so a bare page-wide "removed" query would
    // false-positive against that unrelated paragraph.
    const successMessage = await screen.findByText(/published.*2 places pushed to the public map/i);
    expect(successMessage.textContent).not.toMatch(/\d+ places? removed/);
  });
});
