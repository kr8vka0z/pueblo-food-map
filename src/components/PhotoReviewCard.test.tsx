/**
 * PhotoReviewCard tests — moved from BoxPhotosReviewView.test.tsx (#677:
 * that view's per-card cases now belong to the extracted card). Badge/
 * button copy updated to the issue's own spec: "New photo" (was "New
 * upload"), "Photo reported (N×)" (was "Reported (N×)"), and the flagged
 * path's "Keep photo" / "Remove photo" actions (new — a flagged photo used
 * to reuse the pending path's plain Approve/Reject).
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

import PhotoReviewCard from "@/components/PhotoReviewCard";

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

describe("PhotoReviewCard — pending photo", () => {
  test("renders the preview image, box name, 'New photo' badge, no check-in line", () => {
    render(<PhotoReviewCard photo={makePhoto()} />);
    const img = screen.getByAltText("Photo submitted for 216 W Routt Blessing Box");
    expect(img).toHaveAttribute("src", "/api/admin/box-photos/7/preview");
    expect(screen.getByText("216 W Routt Blessing Box")).toBeInTheDocument();
    expect(screen.getByText("New photo")).toBeInTheDocument();
    expect(screen.queryByText(/Attached to check-in/)).not.toBeInTheDocument();
  });

  test("Approve/Reject buttons, not Keep/Remove", () => {
    render(<PhotoReviewCard photo={makePhoto()} />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  test("shows the attached check-in kind when present", () => {
    render(<PhotoReviewCard photo={makePhoto({ checkin_id: 5, checkin_kind: "filled" })} />);
    expect(screen.getByText(/Attached to check-in/)).toBeInTheDocument();
    expect(screen.getByText("filled")).toBeInTheDocument();
  });

  test("Approve: POSTs to the approve route and refreshes on success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<PhotoReviewCard photo={makePhoto()} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/box-photos/7/approve", { method: "POST" });
  });

  test("Approve failure shows an inline error and never refreshes", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 500 }));
    render(<PhotoReviewCard photo={makePhoto()} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Try again."));
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("Reject: reveals the reason field, POSTs it (not dropped, unlike ProposalCard's bug), refreshes on success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<PhotoReviewCard photo={makePhoto()} />);

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
    render(<PhotoReviewCard photo={makePhoto()} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText(/Reason/)).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("PhotoReviewCard — flagged (reported) photo", () => {
  test("shows 'Photo reported (N×)' with its flag count and the hidden-until-decided note", () => {
    render(<PhotoReviewCard photo={makePhoto({ status: "flagged", flag_count: 2 })} />);
    expect(screen.getByText("Photo reported (2×)")).toBeInTheDocument();
    expect(screen.getByText("Hidden from the public card until you decide.")).toBeInTheDocument();
  });

  test("Keep photo / Remove photo buttons, not Approve/Reject", () => {
    render(<PhotoReviewCard photo={makePhoto({ status: "flagged", flag_count: 1 })} />);
    expect(screen.getByRole("button", { name: "Keep photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  test("Keep photo: POSTs to the approve route", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<PhotoReviewCard photo={makePhoto({ status: "flagged", flag_count: 1 })} />);

    await user.click(screen.getByRole("button", { name: "Keep photo" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/box-photos/7/approve", { method: "POST" });
  });

  test("Remove photo: reveals the reason field labeled 'Confirm remove', POSTs to the reject route with the reason", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<PhotoReviewCard photo={makePhoto({ status: "flagged", flag_count: 1 })} />);

    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    await user.type(screen.getByLabelText(/Reason/), "Still inappropriate");
    await user.click(screen.getByRole("button", { name: "Confirm remove" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/box-photos/7/reject");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Still inappropriate" });
  });
});
