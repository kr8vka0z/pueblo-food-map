/**
 * BoxMilestones tests (Blessing Boxes slice 7 — Numbers, network section).
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import BoxMilestones from "@/components/BoxMilestones";
import { t } from "@/lib/i18n";

describe("BoxMilestones", () => {
  test("renders nothing when there are no milestones", () => {
    const { container } = render(<BoxMilestones milestones={[]} locale="en" />);
    expect(container.textContent).toBe("");
  });

  test("renders a fills milestone line with the threshold interpolated", () => {
    render(<BoxMilestones milestones={[{ metric: "fills", threshold: 250 }]} locale="en" />);
    expect(screen.getByText(t("box.stats.milestone.fills", "en", { threshold: "250" }))).toBeDefined();
  });

  test("renders both metrics when both are present", () => {
    render(
      <BoxMilestones
        milestones={[
          { metric: "fills", threshold: 100 },
          { metric: "uses", threshold: 500 },
        ]}
        locale="en"
      />,
    );
    expect(screen.getByText(t("box.stats.milestone.fills", "en", { threshold: "100" }))).toBeDefined();
    expect(screen.getByText(t("box.stats.milestone.uses", "en", { threshold: "500" }))).toBeDefined();
  });
});
