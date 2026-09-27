/**
 * BoxReviewBox tests — the box edit page's "Things to review" box (#677).
 * Card-level behavior (Approve/Reject wiring, reason POSTs) is already
 * covered by PhotoReviewCard.test.tsx / SponsorRequestCard.test.tsx; this
 * file only pins the box's own shell: renders nothing when empty, shows the
 * combined count, and renders one card per item of either kind.
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import BoxReviewBox from "@/components/BoxReviewBox";

function makePhoto(overrides: Partial<AdminBoxPhotoRow> = {}): AdminBoxPhotoRow {
  return {
    id: 1,
    venue_id: "box-1",
    venue_name: "Test Box",
    checkin_id: null,
    checkin_kind: null,
    status: "pending",
    flag_count: 0,
    created_at: "2026-09-18T15:00:00.000Z",
    ...overrides,
  };
}

function makeAdopter(overrides: Partial<AdminBoxAdopterRow> = {}): AdminBoxAdopterRow {
  return {
    id: 1,
    venue_id: "box-1",
    venue_name: "Test Box",
    display_name: "The Martinez Family",
    email: "martinez@example.com",
    note: null,
    status: "pending",
    email_confirmed_at: "2026-09-18T15:00:00.000Z",
    created_at: "2026-09-18T14:00:00.000Z",
    ...overrides,
  };
}

describe("BoxReviewBox", () => {
  test("renders nothing when there are no photos and no adopters", () => {
    const { container } = render(<BoxReviewBox photos={[]} adopters={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test("shows the combined count in the heading", () => {
    render(<BoxReviewBox photos={[makePhoto()]} adopters={[makeAdopter()]} />);
    expect(screen.getByText("Things to review (2)")).toBeInTheDocument();
  });

  test("renders a PhotoReviewCard per photo and a SponsorRequestCard per adopter", () => {
    render(
      <BoxReviewBox
        photos={[makePhoto({ id: 1 }), makePhoto({ id: 2, status: "flagged", flag_count: 3 })]}
        adopters={[makeAdopter({ id: 1 })]}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve sponsor" })).toBeInTheDocument();
  });

  test("renders only photos when there are no adopters", () => {
    render(<BoxReviewBox photos={[makePhoto()]} adopters={[]} />);
    expect(screen.getByText("Things to review (1)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve sponsor" })).not.toBeInTheDocument();
  });
});
