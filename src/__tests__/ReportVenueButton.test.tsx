/**
 * ReportVenueButton tests — #70
 *
 * Covers:
 *   1. Renders a link with the correct href for a given venueId.
 *   2. Displays the EN button label.
 *   3. Displays the ES button label when locale="es".
 *   4. Link is keyboard-accessible (role=link).
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportVenueButton from "@/components/ReportVenueButton";
import { track, EVENTS } from "@/lib/analytics";

// #485 PR 2: mock the whole module so EVENTS keeps its real allowlist values.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

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
    expect(screen.getByText(/Report an issue with this place/i)).toBeDefined();
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

  test("clicking the link fires report_opened", async () => {
    const user = userEvent.setup();
    render(<ReportVenueButton venueId="garden-rmser" />);
    await user.click(screen.getByRole("link"));
    expect(track).toHaveBeenCalledWith(EVENTS.REPORT_OPENED, {
      venueId: "garden-rmser",
    });
  });
});
