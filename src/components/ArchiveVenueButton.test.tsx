/**
 * ArchiveVenueButton tests (#255; on-page confirm #926).
 *
 * Covers AC2 end to end at the component layer: the confirm gate (first
 * press only opens the on-page box; Cancel -> fetch never called; the box's
 * own Remove from map -> POST /api/admin/venues/<id>/archive), the success
 * redirect, a failure line on a non-200 response, and the already-archived
 * informational state (no actionable button at all).
 *
 * next/navigation's useRouter is mocked module-wide, same pattern as
 * AddVenueForm.test.tsx (the first client component in this codebase to
 * navigate).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import ArchiveVenueButton from "@/components/ArchiveVenueButton";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Presses the trigger, then returns the opened on-page confirm box. */
async function openConfirm(user: ReturnType<typeof userEvent.setup>) {
  render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={false} />);
  await user.click(screen.getByRole("button", { name: /Remove from map/i }));
  return screen.getByRole("group", { name: /Eastside Pantry/ });
}

describe("ArchiveVenueButton — confirm gate", () => {
  test("the first press only opens the box; Cancel sends nothing and brings the button back", async () => {
    const user = userEvent.setup();
    const box = await openConfirm(user);

    expect(mockFetch).not.toHaveBeenCalled();
    await user.click(within(box).getByRole("button", { name: "Cancel" }));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: /Remove from map/i })).toHaveFocus();
  });

  test("the box's Remove from map POSTs /api/admin/venues/<id>/archive, once", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc", status: "archived" }) });
    const user = userEvent.setup();
    const box = await openConfirm(user);

    await user.click(within(box).getByRole("button", { name: /Remove from map/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/venues/manual-abc/archive");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  test("a successful (200) archive redirects to /admin/places and refreshes", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc", status: "archived" }) });
    const user = userEvent.setup();
    const box = await openConfirm(user);

    await user.click(within(box).getByRole("button", { name: /Remove from map/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/places"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["a non-200 response", () => mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false }) })],
    ["a network-level failure", () => mockFetch.mockRejectedValueOnce(new Error("network down"))],
  ])("%s shows an error line, no redirect, and Cancel clears it", async (_label, arrange) => {
    arrange();
    const user = userEvent.setup();
    const box = await openConfirm(user);

    await user.click(within(box).getByRole("button", { name: /Remove from map/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();

    // A reopened box must not carry the last attempt's failure.
    await user.click(within(box).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: /Remove from map/i }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// The confirm must tell the truth: a box is live and leaves the map at once;
// a place waits for the next publish.
describe("ArchiveVenueButton — what the confirm promises", () => {
  test.each([
    [undefined, /next publish/],
    ["place" as const, /next publish/],
    ["box" as const, /right away/],
  ])("kind %s says %s", async (kind, promise) => {
    const user = userEvent.setup();
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={false} kind={kind} />);
    await user.click(screen.getByRole("button", { name: /Remove from map/i }));
    expect(within(screen.getByRole("group", { name: /Eastside Pantry/ })).getByText(promise)).toBeDefined();
  });
});

describe("ArchiveVenueButton — already archived", () => {
  test("renders an informational message, no actionable button, when already archived", () => {
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={true} />);

    expect(screen.queryByRole("button", { name: /Remove from map/i })).toBeNull();
    expect(screen.getByText(/removed from the map/i)).toBeDefined();
  });
});
