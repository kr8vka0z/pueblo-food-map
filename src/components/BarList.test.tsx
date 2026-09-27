import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BarList from "@/components/BarList";

describe("BarList", () => {
  test("empty list -> the empty message, no bars", () => {
    render(<BarList items={[]} emptyMessage="Nothing yet." />);
    expect(screen.getByText("Nothing yet.")).toBeDefined();
  });

  test("renders one row per item with its label and value", () => {
    render(
      <BarList
        items={[
          { label: "google.com", value: 10 },
          { label: "Direct / bookmark", value: 4 },
        ]}
        emptyMessage="none"
      />,
    );
    expect(screen.getByText("google.com")).toBeDefined();
    expect(screen.getByText("Direct / bookmark")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
  });

  test("uses displayValue for the right-hand label when provided", () => {
    render(<BarList items={[{ label: "bread", value: 3, displayValue: "3 asks" }]} emptyMessage="none" />);
    expect(screen.getByText("3 asks")).toBeDefined();
  });
});
