/**
 * BoxNumbersPanel tests (Blessing Boxes slice 7 — Numbers). Pure
 * props-in/DOM-out — no fetch, no router context needed (unlike
 * BoxesActivityContent, this component owns no data fetching of its own).
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoxNumbersPanel from "@/components/BoxNumbersPanel";
import { t } from "@/lib/i18n";
import type { CheckinCounts, PairAverages } from "@/lib/boxStats";

const COUNTS: CheckinCounts = { fills: 3, uses: 12, emptyReports: 2, lowReports: 1, totalCheckins: 18 };
const AVERAGES: PairAverages = { emptyToFillMs: 2 * 24 * 60 * 60 * 1000, fillToFillMs: null, fillToEmptyMs: 5 * 60 * 60 * 1000 };

describe("BoxNumbersPanel", () => {
  test("renders every count", () => {
    render(
      <BoxNumbersPanel
        idPrefix="test"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={4}
        pairAverages={AVERAGES}
        locale="en"
      />,
    );
    expect(screen.getByText("3")).toBeDefined(); // fills
    expect(screen.getByText("12")).toBeDefined(); // uses
    expect(screen.getByText("2")).toBeDefined(); // emptyReports
    expect(screen.getByText("1")).toBeDefined(); // lowReports
    expect(screen.getByText("18")).toBeDefined(); // totalCheckins
    expect(screen.getByText("4")).toBeDefined(); // approvedPhotoCount
  });

  test("formats a real average as a duration, and a null average as the no-data symbol", () => {
    render(
      <BoxNumbersPanel
        idPrefix="test"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="en"
      />,
    );
    expect(screen.getByText("2 days")).toBeDefined(); // emptyToFillMs
    expect(screen.getByText("5 hours")).toBeDefined(); // fillToEmptyMs
    expect(screen.getByText(t("box.stats.noData", "en"))).toBeDefined(); // fillToFillMs (null)
  });

  test("the period select has a real label (accessibility) and calls onPeriodChange", async () => {
    const onPeriodChange = vi.fn();
    render(
      <BoxNumbersPanel
        idPrefix="test"
        period="7d"
        onPeriodChange={onPeriodChange}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="en"
      />,
    );
    const select = screen.getByLabelText(t("box.stats.period", "en"));
    await userEvent.selectOptions(select, "30d");
    expect(onPeriodChange).toHaveBeenCalledWith("30d");
  });

  test("renders the honesty note", () => {
    render(
      <BoxNumbersPanel
        idPrefix="test"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="en"
      />,
    );
    expect(screen.getByText(t("box.stats.honestyNote", "en"))).toBeDefined();
  });

  test("renders in Spanish", () => {
    render(
      <BoxNumbersPanel
        idPrefix="test"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="es"
      />,
    );
    expect(screen.getByText(t("box.stats.honestyNote", "es"))).toBeDefined();
    expect(screen.getByLabelText(t("box.stats.period", "es"))).toBeDefined();
  });
});
