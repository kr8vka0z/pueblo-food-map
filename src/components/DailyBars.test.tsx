import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DailyBars from "@/components/DailyBars";

describe("DailyBars", () => {
  test("empty points -> the empty message, no chart", () => {
    render(<DailyBars points={[]} emptyMessage="No visitors yet." />);
    expect(screen.getByText("No visitors yet.")).toBeDefined();
  });

  test("renders one rect per day", () => {
    const { container } = render(
      <DailyBars
        points={[
          { date: "2026-09-24", value: 3 },
          { date: "2026-09-25", value: 0 },
          { date: "2026-09-26", value: 7 },
        ]}
        emptyMessage="none"
      />,
    );
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });

  test("scales to 90 bars without erroring (90-day period)", () => {
    const points = Array.from({ length: 90 }, (_, i) => ({ date: `day-${i}`, value: i }));
    const { container } = render(<DailyBars points={points} emptyMessage="none" />);
    expect(container.querySelectorAll("rect")).toHaveLength(90);
  });
});
