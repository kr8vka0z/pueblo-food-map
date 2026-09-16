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

  // docs/bottom-nav-spec.md §13 test 8. jsdom evaluates no Tailwind, so the
  // class contract is what's assertable; the pixel check is §14 on dev.
  test("clearBottomNav lifts the credit above the bar below xl, back to the corner at xl", () => {
    const { container } = render(<SponsorCredit clearBottomNav />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("bottom-[calc(78px+12px+env(safe-area-inset-bottom))]");
    expect(root.className).toContain("xl:bottom-2");
    expect(root.style.bottom).toBe("");
  });

  test("without clearBottomNav (the splash) it keeps bottom: 8", () => {
    const { container } = render(<SponsorCredit />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.bottom).toBe("8px");
    expect(root.className).toBe("");
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
