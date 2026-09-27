/**
 * BoxAdoptersReviewView tests — wrapper-level only (empty state, one card
 * per adopter). Per-card behavior moved to SponsorRequestCard.test.tsx when
 * that card was extracted (#677). This view itself is slated for deletion
 * once /admin/box-adopters redirects — kept alive only until that cleanup
 * step.
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import BoxAdoptersReviewView from "@/components/BoxAdoptersReviewView";

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
    expect(screen.getByText("No sponsor requests to review")).toBeInTheDocument();
  });

  test("renders one SponsorRequestCard per adopter", () => {
    render(
      <BoxAdoptersReviewView
        adopters={[makeAdopter({ id: 1 }), makeAdopter({ id: 2, display_name: "The Lee Family" })]}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Approve sponsor" })).toHaveLength(2);
    expect(screen.getByText("The Martinez Family")).toBeInTheDocument();
    expect(screen.getByText("The Lee Family")).toBeInTheDocument();
  });
});
