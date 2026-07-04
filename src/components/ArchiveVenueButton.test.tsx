/**
 * ArchiveVenueButton tests (#255).
 *
 * Covers AC2 end to end at the component layer: the confirm() gate (decline
 * -> fetch never called; accept -> POST /api/admin/venues/<id>/archive),
 * the success redirect, a failure banner on a non-200 response, and the
 * already-archived informational state (no actionable button at all).
 *
 * next/navigation's useRouter is mocked module-wide, same pattern as
 * AddVenueForm.test.tsx (the first client component in this codebase to
 * navigate).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("ArchiveVenueButton — confirm gate", () => {
  test("declining the confirm dialog never calls fetch", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={false} />);

    await user.click(screen.getByRole("button", { name: /Remove from map/i }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(window.confirm as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.stringContaining("Eastside Pantry"),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("accepting the confirm dialog POSTs /api/admin/venues/<id>/archive", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc", status: "archived" }) });
    const user = userEvent.setup();
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={false} />);

    await user.click(screen.getByRole("button", { name: /Remove from map/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/venues/manual-abc/archive");
    expect(init.method).toBe("POST");
  });

  test("a successful (200) archive redirects to /admin and refreshes", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc", status: "archived" }) });
    const user = userEvent.setup();
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={false} />);

    await user.click(screen.getByRole("button", { name: /Remove from map/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("a non-200 response shows an error banner, no redirect", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false, error: "Not found" }) });
    const user = userEvent.setup();
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={false} />);

    await user.click(screen.getByRole("button", { name: /Remove from map/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("a network-level failure shows an error banner, no redirect", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={false} />);

    await user.click(screen.getByRole("button", { name: /Remove from map/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("ArchiveVenueButton — already archived", () => {
  test("renders an informational message, no actionable button, when already archived", () => {
    render(<ArchiveVenueButton venueId="manual-abc" venueName="Eastside Pantry" alreadyArchived={true} />);

    expect(screen.queryByRole("button", { name: /Remove from map/i })).toBeNull();
    expect(screen.getByText(/removed from the map/i)).toBeDefined();
  });
});
