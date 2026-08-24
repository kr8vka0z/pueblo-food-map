import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound, { metadata } from "@/app/not-found";

describe("NotFound page (#288)", () => {
  test("metadata sets Page Not Found title", () => {
    expect(metadata.title).toBe("Page Not Found");
  });

  test("renders branded 404 heading and back to map link", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: /page not found/i })).toBeTruthy();
    const link = screen.getByRole("link", { name: /back to map/i });
    expect(link.getAttribute("href")).toBe("/");
  });
});