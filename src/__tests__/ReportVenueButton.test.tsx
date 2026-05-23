/**
 * ReportVenueButton tests — #70
 *
 * Covers:
 *   1. Renders a link with the correct href for a given venueId.
 *   2. Displays the EN button label.
 *   3. Displays the ES button label when locale="es".
 *   4. Link is keyboard-accessible (role=link).
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportVenueButton from "@/components/ReportVenueButton";

describe("ReportVenueButton", () => {
  test("renders a link to /report/[venueId]", () => {
    render(<ReportVenueButton venueId="garden-rmser" />);
    const link = screen.getByRole("link");
    expect(link).toBeDefined();
    // next/link renders the href on the <a>
    expect((link as HTMLAnchorElement).getAttribute("href")).toBe(
      "/report/garden-rmser",
    );
  });

  test("displays EN label by default", () => {
    render(<ReportVenueButton venueId="garden-rmser" />);
    expect(screen.getByText(/Report an issue with this venue/i)).toBeDefined();
  });

  test("displays ES label when locale='es'", () => {
    render(<ReportVenueButton venueId="garden-rmser" locale="es" />);
    expect(
      screen.getByText(/Reportar un problema con este lugar/i),
    ).toBeDefined();
  });

  test("link has role=link (keyboard accessible)", () => {
    render(<ReportVenueButton venueId="test-id" />);
    const link = screen.getByRole("link");
    expect(link).toBeDefined();
  });
});
