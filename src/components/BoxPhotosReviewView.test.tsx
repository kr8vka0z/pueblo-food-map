/**
 * BoxPhotosReviewView tests (Blessing Boxes slice 5). Same mocked-fetch /
 * mocked-useRouter pattern as SubmissionsReviewView.test.tsx.
 *
 * Covers: empty state; a card renders the preview image, box name, status
 * badge, and (when attached) the check-in kind; Approve POSTs and
 * refreshes; Reject reveals the reason field, POSTs the reason, and
 * refreshes; a failed action shows an inline error and never refreshes.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import BoxPhotosReviewView from "@/components/BoxPhotosReviewView";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makePhoto(overrides: Partial<AdminBoxPhotoRow> = {}): AdminBoxPhotoRow {
  return {
    id: 7,
    venue_id: "plentiful-blessing-box-216-w-routt-plentiful-1454",
    venue_name: "216 W Routt Blessing Box",
    checkin_id: null,
    checkin_kind: null,
    status: "pending",
    flag_count: 0,
    created_at: "2026-09-18T15:00:00.000Z",
    ...overrides,
  };
}

describe("BoxPhotosReviewView", () => {
  test("empty state when there's nothing to review", () => {
    render(<BoxPhotosReviewView photos={[]} />);
    expect(screen.getByText("No photos to review")).toBeInTheDocument();
  });

  test("renders a pending card: preview image, box name, 'New upload' badge, no check-in line", () => {
    render(<BoxPhotosReviewView photos={[makePhoto()]} />);
    const img = screen.getByAltText("Photo submitted for 216 W Routt Blessing Box");
    expect(img).toHaveAttribute("src", "/api/admin/box-photos/7/preview");
    expect(screen.getByText("216 W Routt Blessing Box")).toBeInTheDocument();
    expect(screen.getByText("New upload")).toBeInTheDocument();
    expect(screen.queryByText(/Attached to check-in/)).not.toBeInTheDocument();
  });

  test("renders a flagged card with its flag count, and the attached check-in kind when present", () => {
    render(
      <BoxPhotosReviewView
        photos={[makePhoto({ status: "flagged", flag_count: 2, checkin_id: 5, checkin_kind: "filled" })]}
      />,
    );
    expect(screen.getByText("Reported (2×)")).toBeInTheDocument();
    expect(screen.getByText(/Attached to check-in/)).toBeInTheDocument();
    expect(screen.getByText("filled")).toBeInTheDocument();
  });

  test("Approve: POSTs to the approve route and refreshes on success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<BoxPhotosReviewView photos={[makePhoto()]} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/box-photos/7/approve", { method: "POST" });
  });

  test("Approve failure shows an inline error and never refreshes", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 500 }));
    render(<BoxPhotosReviewView photos={[makePhoto()]} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Try again."));
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("Reject: reveals the reason field, POSTs it, refreshes on success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<BoxPhotosReviewView photos={[makePhoto()]} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByLabelText(/Reason/), "Face visible");
    await user.click(screen.getByRole("button", { name: "Confirm reject" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/box-photos/7/reject");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Face visible" });
  });

  test("Reject: Cancel closes the form without submitting", async () => {
    const user = userEvent.setup();
    render(<BoxPhotosReviewView photos={[makePhoto()]} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText(/Reason/)).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
