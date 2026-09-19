/**
 * BoxAdoptersReviewView tests (Blessing Boxes slice 6). Same mocked-fetch /
 * mocked-useRouter pattern as BoxPhotosReviewView.test.tsx.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import BoxAdoptersReviewView from "@/components/BoxAdoptersReviewView";

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

function makeAdopter(overrides: Partial<AdminBoxAdopterRow> = {}): AdminBoxAdopterRow {
  return {
    id: 7,
    venue_id: "test-box-1",
    venue_name: "Test Blessing Box",
    display_name: "The Martinez Family",
    email: "martinez@example.com",
    note: null,
    status: "pending",
    email_confirmed_at: "2026-09-18T15:00:00.000Z",
    created_at: "2026-09-18T14:00:00.000Z",
    ...overrides,
  };
}

describe("BoxAdoptersReviewView", () => {
  test("empty state when there's nothing to review", () => {
    render(<BoxAdoptersReviewView adopters={[]} />);
    expect(screen.getByText("No adoption requests to review")).toBeInTheDocument();
  });

  test("renders a confirmed card: box, name, email, and 'Email confirmed' badge", () => {
    render(<BoxAdoptersReviewView adopters={[makeAdopter()]} />);
    expect(screen.getByText("Test Blessing Box")).toBeInTheDocument();
    expect(screen.getByText("The Martinez Family")).toBeInTheDocument();
    expect(screen.getByText("martinez@example.com")).toBeInTheDocument();
    expect(screen.getByText("Email confirmed")).toBeInTheDocument();
  });

  test("an unconfirmed application shows the awaiting-confirmation badge and the note when present", () => {
    render(
      <BoxAdoptersReviewView
        adopters={[makeAdopter({ email_confirmed_at: null, note: "We run a little pantry group" })]}
      />,
    );
    expect(screen.getByText("Awaiting email confirmation")).toBeInTheDocument();
    expect(screen.getByText("We run a little pantry group")).toBeInTheDocument();
  });

  test("Approve: POSTs to the approve route and refreshes on success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<BoxAdoptersReviewView adopters={[makeAdopter()]} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/box-adopters/7/approve", { method: "POST" });
  });

  test("Approve on an unconfirmed application (409) shows the specific unconfirmed message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "unconfirmed" }), { status: 409 }));
    render(<BoxAdoptersReviewView adopters={[makeAdopter({ email_confirmed_at: null })]} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("This applicant hasn't confirmed their email yet"),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("Reject: reveals the reason field, POSTs it, refreshes on success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<BoxAdoptersReviewView adopters={[makeAdopter()]} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByLabelText(/Reason/), "Never responded");
    await user.click(screen.getByRole("button", { name: "Confirm reject" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/box-adopters/7/reject");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Never responded" });
  });

  test("an already-approved adopter's action buttons read Remove, not Reject", async () => {
    render(<BoxAdoptersReviewView adopters={[makeAdopter({ status: "approved" })]} />);
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  test("Reject: Cancel closes the form without submitting", async () => {
    const user = userEvent.setup();
    render(<BoxAdoptersReviewView adopters={[makeAdopter()]} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText(/Reason/)).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
