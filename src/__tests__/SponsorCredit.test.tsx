/**
 * SponsorCredit tests — link rendering, href, rel, and locale.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SponsorCredit from "@/components/SponsorCredit";

describe("SponsorCredit", () => {
  test("renders a link to pueblofoodproject.org", () => {
    render(<SponsorCredit />);
    const link = screen.getByRole("link");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("https://pueblofoodproject.org/");
  });

  test("opens in a new tab with noopener noreferrer", () => {
    render(<SponsorCredit />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("shows EN sponsor text by default", () => {
    render(<SponsorCredit />);
    expect(screen.getByText("Sponsored by Pueblo Food Project")).toBeDefined();
  });

  test("shows ES sponsor text when locale='es'", () => {
    render(<SponsorCredit locale="es" />);
    expect(screen.getByText("Patrocinado por Pueblo Food Project")).toBeDefined();
  });

  test("hidden prop hides the element", () => {
    const { container } = render(<SponsorCredit hidden />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.display).toBe("none");
  });

  test("visible by default (not hidden)", () => {
    const { container } = render(<SponsorCredit />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.display).not.toBe("none");
  });
});
