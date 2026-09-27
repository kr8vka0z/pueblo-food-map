/**
 * BoxPhotosReviewView tests — wrapper-level only (empty state, one card per
 * photo). Per-card behavior (badges, Approve/Reject/Keep/Remove, reject
 * reason) moved to PhotoReviewCard.test.tsx when that card was extracted
 * (#677). This view itself is slated for deletion once /admin/box-photos
 * redirects — kept alive only until that cleanup step.
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import BoxPhotosReviewView from "@/components/BoxPhotosReviewView";

function makePhoto(overrides: Partial<AdminBoxPhotoRow> = {}): AdminBoxPhotoRow {
  return {
    id: 7,
    venue_id: "box-1",
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

  test("renders one PhotoReviewCard per photo", () => {
    render(<BoxPhotosReviewView photos={[makePhoto({ id: 1 }), makePhoto({ id: 2, venue_name: "Second Box" })]} />);
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(2);
    expect(screen.getByText("216 W Routt Blessing Box")).toBeInTheDocument();
    expect(screen.getByText("Second Box")).toBeInTheDocument();
  });
});
