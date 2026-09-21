/**
 * BoxesWaitingChips render tests (admin dashboard build) — renders nothing
 * when both counts are zero, shows only the non-zero chip(s), pluralizes
 * correctly, and each chip links to its own full queue.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import BoxesWaitingChips from "@/components/BoxesWaitingChips";

describe("BoxesWaitingChips", () => {
  test("renders nothing when both counts are zero", () => {
    const { container } = render(<BoxesWaitingChips photosCount={0} adoptersCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  test("shows only the photos chip when adopters is zero, singular noun for count 1", () => {
    render(<BoxesWaitingChips photosCount={1} adoptersCount={0} />);
    const link = screen.getByRole("link", { name: "1 photo to review" });
    expect(link.getAttribute("href")).toBe("/admin/box-photos");
    expect(screen.queryByText(/adoption request/)).toBeNull();
  });

  test("shows both chips, pluralized, each linking to its own queue", () => {
    render(<BoxesWaitingChips photosCount={3} adoptersCount={2} />);
    expect(screen.getByRole("link", { name: "3 photos to review" }).getAttribute("href")).toBe("/admin/box-photos");
    expect(screen.getByRole("link", { name: "2 adoption requests" }).getAttribute("href")).toBe("/admin/box-adopters");
  });
});
