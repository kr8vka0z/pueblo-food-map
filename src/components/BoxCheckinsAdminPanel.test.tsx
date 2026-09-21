/**
 * BoxCheckinsAdminPanel tests (Blessing Boxes slice 2). Same
 * useRouter-mocked pattern as ArchiveVenueButton.test.tsx: no real
 * navigation, just proves the POST call shape and the refresh-on-success
 * convention.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

import BoxCheckinsAdminPanel from "@/components/BoxCheckinsAdminPanel";
import type { AdminCheckinRow } from "@/lib/blessingBoxes";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeRow(overrides: Partial<AdminCheckinRow> = {}): AdminCheckinRow {
  return {
    id: 1,
    venue_id: "box-1",
    kind: "filled",
    note: null,
    visibility: "visible",
    hidden_by: null,
    hidden_at: null,
    created_at: "2026-09-17T12:00:00.000Z",
    ...overrides,
  };
}

describe("BoxCheckinsAdminPanel — empty state", () => {
  test("shows 'No check-ins yet' when the list is empty", () => {
    render(<BoxCheckinsAdminPanel checkins={[]} />);
    expect(screen.getByText("No check-ins yet.")).toBeDefined();
  });
});

describe("BoxCheckinsAdminPanel — rendering", () => {
  test("renders every check-in, including hidden and problem rows", () => {
    render(
      <BoxCheckinsAdminPanel
        checkins={[
          makeRow({ id: 1, kind: "filled", note: "Stocked it" }),
          makeRow({ id: 2, kind: "problem", note: "Door broken", visibility: "visible" }),
          makeRow({ id: 3, kind: "took", visibility: "hidden", hidden_by: "admin@pueblofoodmap.com" }),
        ]}
      />,
    );
    expect(screen.getByText("Filled")).toBeDefined();
    expect(screen.getByText("Stocked it")).toBeDefined();
    expect(screen.getByText("Problem report")).toBeDefined();
    expect(screen.getByText("Door broken")).toBeDefined();
    expect(screen.getByText("Used the box")).toBeDefined();
    expect(screen.getByText(/hidden by admin@pueblofoodmap.com/)).toBeDefined();
  });

  test("a problem report is labeled 'Admin only'", () => {
    render(<BoxCheckinsAdminPanel checkins={[makeRow({ kind: "problem" })]} />);
    expect(screen.getByText("Admin only")).toBeDefined();
  });

  // ─── Needs ask (migration 0012) ─────────────────────────────────────────
  test("a 'took' row with picked needs shows the translated labels", () => {
    render(
      <BoxCheckinsAdminPanel
        checkins={[makeRow({ kind: "took", needs: JSON.stringify(["canned_food", "diapers"]) })]}
      />,
    );
    expect(screen.getByText("Needs: Canned food, Diapers")).toBeDefined();
  });

  test("a row with no needs (null) shows no 'Needs:' line", () => {
    render(<BoxCheckinsAdminPanel checkins={[makeRow({ kind: "took", needs: null })]} />);
    expect(screen.queryByText(/^Needs:/)).toBeNull();
  });

  test("malformed needs JSON never throws — degrades to no 'Needs:' line", () => {
    expect(() =>
      render(<BoxCheckinsAdminPanel checkins={[makeRow({ kind: "took", needs: "{not valid json" })]} />),
    ).not.toThrow();
    expect(screen.queryByText(/^Needs:/)).toBeNull();
  });

  test("a hidden row shows a 'Hidden' badge and an Unhide button; a visible row shows Hide", () => {
    render(
      <BoxCheckinsAdminPanel
        checkins={[makeRow({ id: 1, visibility: "visible" }), makeRow({ id: 2, visibility: "hidden" })]}
      />,
    );
    expect(screen.getByText("Hidden")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Unhide" })).toBeDefined();
  });
});

describe("BoxCheckinsAdminPanel — toggling visibility", () => {
  test("clicking Hide POSTs {visibility:'hidden'} to the checkin's visibility route", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const user = userEvent.setup();
    render(<BoxCheckinsAdminPanel checkins={[makeRow({ id: 7, visibility: "visible" })]} />);

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/box-checkins/7/visibility",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ visibility: "hidden" });
  });

  test("clicking Unhide POSTs {visibility:'visible'}", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const user = userEvent.setup();
    render(<BoxCheckinsAdminPanel checkins={[makeRow({ id: 9, visibility: "hidden" })]} />);

    await user.click(screen.getByRole("button", { name: "Unhide" }));

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ visibility: "visible" });
  });

  test("a successful toggle calls router.refresh()", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const user = userEvent.setup();
    render(<BoxCheckinsAdminPanel checkins={[makeRow({ id: 1 })]} />);

    await user.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("a non-200 response shows an inline error and does not refresh", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500 });
    const user = userEvent.setup();
    render(<BoxCheckinsAdminPanel checkins={[makeRow({ id: 1 })]} />);

    await user.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeDefined());
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("a network failure shows the same inline error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<BoxCheckinsAdminPanel checkins={[makeRow({ id: 1 })]} />);

    await user.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeDefined());
  });

  test("toggling one row's button does not disable a different row's button", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    render(
      <BoxCheckinsAdminPanel
        checkins={[makeRow({ id: 1, visibility: "visible" }), makeRow({ id: 2, visibility: "visible" })]}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "Hide" });
    await user.click(buttons[0]);

    await waitFor(() => expect(screen.getByText("Saving…")).toBeDefined());
    const stillIdle = screen.getAllByRole("button", { name: "Hide" });
    expect(stillIdle).toHaveLength(1); // the other row's button is untouched
    expect(stillIdle[0]).not.toBeDisabled();
  });
});
