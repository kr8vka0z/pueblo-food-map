import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardNeedsStrip, { type NeedsCardData } from "@/components/DashboardNeedsStrip";

const cards: NeedsCardData[] = [
  { key: "review", label: "Places to review", count: 5, href: "/admin/submissions", detail: "3 review queue, 2 data refresh" },
  { key: "publish", label: "Waiting to publish", count: 0, href: "/admin/places" },
  { key: "boxes-content", label: "Box photos & sponsor requests", count: 2, href: "/admin/box-photos" },
  { key: "boxes-help", label: "Boxes empty or low", count: 1, href: "/admin/boxes" },
];

describe("DashboardNeedsStrip", () => {
  test("renders all four cards with their counts and hrefs", () => {
    render(<DashboardNeedsStrip cards={cards} />);
    for (const card of cards) {
      const link = screen.getByRole("link", { name: new RegExp(card.label) });
      expect(link.getAttribute("href")).toBe(card.href);
    }
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("3 review queue, 2 data refresh")).toBeDefined();
  });

  test("a zero-count card still renders (no hiding, per #680: an empty queue is real information)", () => {
    render(<DashboardNeedsStrip cards={cards} />);
    expect(screen.getByText("Waiting to publish")).toBeDefined();
  });
});
