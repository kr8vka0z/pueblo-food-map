// The review queue shows each switchable pair's count and on/off state
// (Venue Data Rebuild plan, "Decided: sources switch themselves on").
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceSwitchList as SourceSwitchPanel } from "@/components/SourceSwitchPanel";

describe("SourceSwitchPanel", () => {
  test("shows each pair's count, and which ones update on their own", () => {
    render(
      <SourceSwitchPanel
        states={[
          { source: "care_and_share", field: "phone", streak: 2, on: false },
          { source: "care_and_share", field: "hours_weekly", streak: 5, on: true },
        ]}
      />,
    );
    expect(screen.getByText(/Care and Share/)).toBeTruthy();
    expect(screen.getByText("Phone: 2 of 5, asks you first")).toBeTruthy();
    expect(screen.getByText("Hours: updates on its own")).toBeTruthy();
  });

  test("renders nothing when the switch state couldn't be read", () => {
    const { container } = render(<SourceSwitchPanel states={null} />);
    expect(container.innerHTML).toBe("");
  });
});
