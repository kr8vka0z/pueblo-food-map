/**
 * PublishPanel — #591 production-only guard message mapping. A separate new
 * file rather than an addition to PublishPanel.test.tsx, since the
 * write-guard on fix/* branches blocks edits to existing test files.
 * Mocking pattern mirrors PublishPanel.test.tsx's existing response-branch
 * tests exactly.
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

describe("PublishPanel — publish_not_production message", () => {
  test("403 publish_not_production shows the staging-specific message, not the generic 'session expired' one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce(jsonResponse(403, { ok: false, error: "publish_not_production" }));
    const user = userEvent.setup();
    render(<PublishPanel summary={summary({ newDrafts: 1 })} />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/production site/i),
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(/session expired/i);
  });
});
