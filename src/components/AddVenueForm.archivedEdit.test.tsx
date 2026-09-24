/**
 * Regression test for #568 item 1 — new file because
 * src/components/AddVenueForm.test.tsx is an existing test file
 * (write-guarded on fix/* branches); this covers ONLY the new 409
 * (archived-venue) branch, not the rest of the form (see that file for
 * validation, create/edit submit, and the 422 field-error mapping).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import AddVenueForm from "@/components/AddVenueForm";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Name/i), "Eastside Pantry");
  await user.selectOptions(screen.getByLabelText(/^Category/i), "pantry");
  await user.type(screen.getByLabelText(/^Address/i), "123 Test St, Pueblo, CO");
  fireEvent.change(screen.getByLabelText(/^Latitude/i), { target: { value: "38.25" } });
  fireEvent.change(screen.getByLabelText(/^Longitude/i), { target: { value: "-104.6" } });
}

describe("AddVenueForm — PATCH 409 (archived venue, #568 item 1)", () => {
  test("shows the route's own message, not the generic 'Something went wrong'", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({
        ok: false,
        error: "archived",
        message: "This venue is archived and can't be edited. Archiving is final — there is no restore/edit path today.",
      }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(await screen.findByText(/this venue is archived/i)).toBeDefined();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("a 409 with no readable body falls back to a specific-enough message, still not the generic copy", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409, json: async () => { throw new Error("bad json"); } });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(await screen.findByText(/can't be edited right now/i)).toBeDefined();
  });
});
