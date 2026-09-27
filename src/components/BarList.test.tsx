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

  // #681's "most opened places" links each row to its edit page.
  test("an item with href renders its label as a link; one without stays plain text", () => {
    render(
      <BarList
        items={[
          { label: "Corner Pantry", value: 5, href: "/admin/venues/v1/edit" },
          { label: "Removed place", value: 2 },
        ]}
        emptyMessage="none"
      />,
    );
    expect(screen.getByRole("link", { name: "Corner Pantry" }).getAttribute("href")).toBe("/admin/venues/v1/edit");
    expect(screen.queryByRole("link", { name: "Removed place" })).toBeNull();
    expect(screen.getByText("Removed place")).toBeDefined();
  });
});
