/**
 * BoxNumbersPanel tests for the "current network numbers" addition
 * (issue #512) — new file, not an edit to BoxNumbersPanel.test.tsx: this is
 * a fix/ branch and this repo's policy keeps every pre-existing test
 * untouched, so a new prop's behavior gets its own test file.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import BoxNumbersPanel from "@/components/BoxNumbersPanel";
import { t } from "@/lib/i18n";
import type { CheckinCounts, PairAverages } from "@/lib/boxStats";

const COUNTS: CheckinCounts = { fills: 3, uses: 12, emptyReports: 2, lowReports: 1, totalCheckins: 18 };
const AVERAGES: PairAverages = { emptyToFillMs: null, fillToFillMs: null, fillToEmptyMs: null };

describe("BoxNumbersPanel — networkOverview (issue #512)", () => {
  test("renders box count, sponsor count, and average when networkOverview is supplied", () => {
    render(
      <BoxNumbersPanel
        idPrefix="network"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="en"
        networkOverview={{ boxCount: 7, sponsorCount: 5, avgSponsorsPerBox: "0.7" }}
      />,
    );
    expect(screen.getByText(t("box.stats.boxCount", "en"))).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText(t("box.stats.sponsorCount", "en"))).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText(t("box.stats.avgSponsorsPerBox", "en"))).toBeDefined();
    expect(screen.getByText("0.7")).toBeDefined();
  });

  test("renders none of the three rows when networkOverview is omitted (per-box panel)", () => {
    render(
      <BoxNumbersPanel
        idPrefix="box-history"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="en"
      />,
    );
    expect(screen.queryByText(t("box.stats.boxCount", "en"))).toBeNull();
    expect(screen.queryByText(t("box.stats.sponsorCount", "en"))).toBeNull();
    expect(screen.queryByText(t("box.stats.avgSponsorsPerBox", "en"))).toBeNull();
  });

  test("zero boxes/sponsors renders '0's, never 'NaN'", () => {
    render(
      <BoxNumbersPanel
        idPrefix="network"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="en"
        networkOverview={{ boxCount: 0, sponsorCount: 0, avgSponsorsPerBox: "0" }}
      />,
    );
    expect(screen.queryByText("NaN")).toBeNull();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  test("renders the new labels in Spanish", () => {
    render(
      <BoxNumbersPanel
        idPrefix="network"
        period="all"
        onPeriodChange={() => {}}
        counts={COUNTS}
        approvedPhotoCount={0}
        pairAverages={AVERAGES}
        locale="es"
        networkOverview={{ boxCount: 7, sponsorCount: 3, avgSponsorsPerBox: "0.4" }}
      />,
    );
    expect(screen.getByText(t("box.stats.boxCount", "es"))).toBeDefined();
    expect(screen.getByText(t("box.stats.sponsorCount", "es"))).toBeDefined();
    expect(screen.getByText(t("box.stats.avgSponsorsPerBox", "es"))).toBeDefined();
  });
});
