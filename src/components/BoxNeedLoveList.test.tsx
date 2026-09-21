/**
 * BoxNeedLoveList tests (Blessing Boxes slice 7 — Numbers, network section).
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import BoxNeedLoveList from "@/components/BoxNeedLoveList";
import { t } from "@/lib/i18n";

const NOW = new Date("2026-09-17T12:00:00.000Z");

describe("BoxNeedLoveList", () => {
  test("renders a never-filled box using the neverFilled label, not a relative time", () => {
    render(
      <BoxNeedLoveList
        longestSinceFill={[{ id: "a", name: "Box A", lastFilledAt: null }]}
        mostEmptyReports={[]}
        slowestRefill={[]}
        locale="en"
        now={NOW}
      />,
    );
    expect(screen.getByText(t("box.stats.neverFilled", "en"))).toBeDefined();
  });

  test("renders a filled box's relative last-filled time", () => {
    render(
      <BoxNeedLoveList
        longestSinceFill={[{ id: "a", name: "Box A", lastFilledAt: "2026-09-15T12:00:00.000Z" }]}
        mostEmptyReports={[]}
        slowestRefill={[]}
        locale="en"
        now={NOW}
      />,
    );
    expect(screen.getByText("2 days ago")).toBeDefined();
  });

  test("renders empty-report counts", () => {
    render(
      <BoxNeedLoveList
        longestSinceFill={[]}
        mostEmptyReports={[{ id: "b", name: "Box B", emptyReportCount: 4 }]}
        slowestRefill={[]}
        locale="en"
        now={NOW}
      />,
    );
    expect(screen.getByText(t("box.stats.needLove.emptyReportCount", "en", { count: "4" }))).toBeDefined();
  });

  test("renders slowest-refill durations", () => {
    render(
      <BoxNeedLoveList
        longestSinceFill={[]}
        mostEmptyReports={[]}
        slowestRefill={[{ id: "c", name: "Box C", avgRefillMs: 3 * 24 * 60 * 60 * 1000 }]}
        locale="en"
        now={NOW}
      />,
    );
    expect(screen.getByText("3 days")).toBeDefined();
  });

  test("an empty sub-list shows the 'not enough history' message instead of a blank list", () => {
    render(<BoxNeedLoveList longestSinceFill={[]} mostEmptyReports={[]} slowestRefill={[]} locale="en" now={NOW} />);
    expect(screen.getAllByText(t("box.stats.needLove.empty", "en"))).toHaveLength(3);
  });

  test("each box name links to its history page", () => {
    render(
      <BoxNeedLoveList
        longestSinceFill={[{ id: "box-42", name: "Box 42", lastFilledAt: null }]}
        mostEmptyReports={[]}
        slowestRefill={[]}
        locale="en"
        now={NOW}
      />,
    );
    const link = screen.getByRole("link", { name: "Box 42" });
    expect(link.getAttribute("href")).toBe("/box/box-42/history");
  });
});
