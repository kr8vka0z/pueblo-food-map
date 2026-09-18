/**
 * BoxPhotoGrid tests (Blessing Boxes slice 5 — history page photo grid).
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoxPhotoGrid from "@/components/BoxPhotoGrid";
import type { BoxPhotoListItem } from "@/lib/useBoxPhotos";

function makePhotos(n: number): BoxPhotoListItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    createdAt: new Date(Date.now() - i * 60_000).toISOString(),
  }));
}

describe("BoxPhotoGrid — empty state", () => {
  test("shows 'No photos yet' when there are none", () => {
    render(<BoxPhotoGrid photos={[]} boxName="Test Box" locale="en" />);
    expect(screen.getByText("No photos yet")).toBeDefined();
  });
});

describe("BoxPhotoGrid — rendering photos", () => {
  test("renders each photo via the public serve route with localized alt text and a Report button", () => {
    render(<BoxPhotoGrid photos={makePhotos(3)} boxName="Test Box" locale="en" />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[0].getAttribute("src")).toBe("/api/public/box-photos/1");
    expect(images[0].getAttribute("alt")).toContain("Test Box");
    expect(screen.getAllByRole("button", { name: "Report this photo" })).toHaveLength(3);
  });

  test("no 'Show more photos' button when everything already fits on screen", () => {
    render(<BoxPhotoGrid photos={makePhotos(3)} boxName="Test Box" locale="en" />);
    expect(screen.queryByRole("button", { name: "Show more photos" })).toBeNull();
  });
});

describe("BoxPhotoGrid — 'Show more photos'", () => {
  test("caps the initial render and reveals the rest on click", async () => {
    const user = userEvent.setup();
    render(<BoxPhotoGrid photos={makePhotos(20)} boxName="Test Box" locale="en" />);

    const initialCount = screen.getAllByRole("img").length;
    expect(initialCount).toBeLessThan(20);

    const more = screen.getByRole("button", { name: "Show more photos" });
    await user.click(more);

    expect(screen.getAllByRole("img")).toHaveLength(20);
    expect(screen.queryByRole("button", { name: "Show more photos" })).toBeNull();
  });
});
