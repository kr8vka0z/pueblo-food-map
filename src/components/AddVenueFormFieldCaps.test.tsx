/**
 * AddVenueForm field-cap tests (#297 follow-up 2 — flagged by the Claude CI
 * reviewer on PR #622: FIELD_LIMITS's own header says to import it "in
 * route handlers (server) and form components (client) alike", matching
 * the public forms' convention (SuggestForm.tsx etc), but AddVenueForm.tsx
 * never did).
 *
 * New file, not an addition to AddVenueForm.test.tsx — this worktree's
 * write-guard blocks editing an existing test file on a fix/* branch.
 *
 * Asserts `maxLength` on the DOM node directly rather than duplicating
 * FIELD_LIMITS's numeric values here — a value-equality assertion would
 * pass even if the component hard-coded a different number than
 * FIELD_LIMITS, silently drifting from the server cap this is meant to
 * mirror. Importing FIELD_LIMITS and comparing against it is the real
 * regression guard.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AddVenueForm from "@/components/AddVenueForm";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddVenueForm — maxLength mirrors FIELD_LIMITS (#297 follow-up)", () => {
  test("venue-level fields carry the same cap as the server validation", () => {
    render(<AddVenueForm />);
    expect(screen.getByLabelText(/^Name/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_VENUE_NAME));
    expect(screen.getByLabelText(/^Address/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_ADDRESS));
    expect(screen.getByLabelText(/^Phone/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_CONTACT));
    expect(screen.getByLabelText(/^Email/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.EMAIL));
    expect(screen.getByLabelText(/^Website/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_CONTACT));
    expect(screen.getByLabelText(/^Operator/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_VENUE_NAME));
    expect(screen.getByLabelText(/^Notes/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_NOTES));
    expect(screen.getByLabelText(/^Source/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.ADMIN_VENUE_SOURCE));
  });

  test("blessing-box fields (shown once category is blessing_box) carry the same cap as the server validation", async () => {
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.selectOptions(screen.getByLabelText(/^Category/i), "blessing_box");

    expect(screen.getByLabelText(/^Host name/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_VENUE_NAME));
    expect(screen.getByLabelText(/Public note from the host/i)).toHaveAttribute(
      "maxLength",
      String(FIELD_LIMITS.BOX_ADOPTER_NOTE),
    );
    expect(screen.getByLabelText(/^Host contact/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.SUGGEST_CONTACT));
    expect(screen.getByLabelText(/^Most needed/i)).toHaveAttribute("maxLength", String(FIELD_LIMITS.BOX_CHECKIN_NOTE));
  });
});
