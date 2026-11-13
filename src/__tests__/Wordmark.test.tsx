/**
 * Wordmark component tests — the display-only <span> SplashScreen renders:
 * span (not a button), "Pueblo Food Map" text, the wordmark + responsive size
 * classes, and className pass-through.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Wordmark from "@/components/Wordmark";

describe("Wordmark", () => {
  test("renders a span, not a button", () => {
    const { container } = render(<Wordmark />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    const button = container.querySelector("button");
    expect(button).toBeNull();
  });

  test("renders 'Pueblo Food Map' text", () => {
    render(<Wordmark />);
    expect(screen.getByText("Pueblo Food Map")).toBeDefined();
  });

  test("applies wordmark class", () => {
    const { container } = render(<Wordmark />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("wordmark");
  });

  test("applies the responsive size classes (text-4xl md:text-6xl)", () => {
    const { container } = render(<Wordmark />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-4xl");
    expect(span?.className).toContain("md:text-6xl");
  });

  test("passes className through to the span", () => {
    const { container } = render(<Wordmark className="custom-class" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("custom-class");
  });
});
