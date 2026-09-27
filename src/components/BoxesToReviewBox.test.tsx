/**
 * BoxesToReviewBox tests (#677) — the summary line's exact wording (with
 * and without a flagged-photo count) and the "Show them" link's href, plus
 * the "renders nothing when empty" case every summary box on this app
 * follows.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import BoxesToReviewBox from "@/components/BoxesToReviewBox";

describe("BoxesToReviewBox", () => {
  test("renders nothing when no box needs review", () => {
    const { container } = render(
      <BoxesToReviewBox reviewingBoxCount={0} photosCount={0} flaggedPhotosCount={0} sponsorRequestsCount={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("summary line: N to review, photo count, and sponsor request count (no flagged photos)", () => {
    render(
      <BoxesToReviewBox reviewingBoxCount={3} photosCount={2} flaggedPhotosCount={0} sponsorRequestsCount={1} />,
    );
    expect(screen.getByText("3 to review: 2 photos and 1 sponsor request")).toBeInTheDocument();
  });

  test("summary line includes the 'reported by a visitor' count when any photo is flagged", () => {
    render(
      <BoxesToReviewBox reviewingBoxCount={2} photosCount={3} flaggedPhotosCount={1} sponsorRequestsCount={0} />,
    );
    expect(screen.getByText("2 to review: 3 photos (1 reported by a visitor) and 0 sponsor requests")).toBeInTheDocument();
  });

  test("'Show them' links to /admin/boxes?show=review", () => {
    render(
      <BoxesToReviewBox reviewingBoxCount={1} photosCount={1} flaggedPhotosCount={0} sponsorRequestsCount={0} />,
    );
    expect(screen.getByRole("link", { name: "Show them" }).getAttribute("href")).toBe("/admin/boxes?show=review");
  });
});
