/**
 * AddVenueForm conflict-banner tests (#265, "optimistic-concurrency
 * guard"). Split from the main AddVenueForm.test.tsx (which #390/#259
 * already keep quite long) rather than added there — same file-per-feature
 * split those two features already used for their own threading tests.
 *
 * Covers: expectedUpdatedAt is sent only in edit mode; a 409 with
 * `error: "conflict"` shows the server's message plus a Reload button
 * (window.location.reload()) and keeps the admin's typed values on screen;
 * a 409 WITHOUT that error code (#568's "archived" case) shows no Reload
 * button.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  await user.type(screen.getByLabelText(/^Latitude/i), "38.25");
  await user.type(screen.getByLabelText(/^Longitude/i), "-104.6");
}

describe("AddVenueForm — expectedUpdatedAt threading (#265)", () => {
  test("edit mode + expectedUpdatedAt -> PATCH body includes it verbatim", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" expectedUpdatedAt="2026-01-01T00:00:00.000Z" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.expectedUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  test("edit mode WITHOUT expectedUpdatedAt -> PATCH body omits it entirely", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.expectedUpdatedAt).toBeUndefined();
  });

  test("create mode ignores expectedUpdatedAt entirely: POST body omits it", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201, json: async () => ({ ok: true, id: "manual-new" }) });
    const user = userEvent.setup();
    render(<AddVenueForm expectedUpdatedAt="2026-01-01T00:00:00.000Z" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.expectedUpdatedAt).toBeUndefined();
  });
});

describe("AddVenueForm — 409 conflict banner (#265)", () => {
  test("error: 'conflict' -> shows the server's message and a Reload button, no redirect", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({
        ok: false,
        error: "conflict",
        message: "Someone else changed this place since you opened it. Reload to see their changes.",
      }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" expectedUpdatedAt="2026-01-01T00:00:00.000Z" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(
      await screen.findByText("Someone else changed this place since you opened it. Reload to see their changes."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Reload/i })).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("the admin's typed values stay on screen after a conflict (nothing resets `values`)", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ ok: false, error: "conflict", message: "Someone else changed this place." }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" expectedUpdatedAt="2026-01-01T00:00:00.000Z" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    await screen.findByText("Someone else changed this place.");
    expect((screen.getByLabelText(/^Name/i) as HTMLInputElement).value).toBe("Eastside Pantry");
    expect((screen.getByLabelText(/^Address/i) as HTMLInputElement).value).toBe("123 Test St, Pueblo, CO");
  });

  test("clicking Reload calls window.location.reload()", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ ok: false, error: "conflict", message: "Someone else changed this place." }),
    });
    const reloadSpy = vi.fn();
    // jsdom's window.location isn't configurable by default — replace the
    // whole object for this test only, same technique jsdom itself
    // recommends for a location.reload() spy.
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { ...originalLocation, reload: reloadSpy }, writable: true });

    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" expectedUpdatedAt="2026-01-01T00:00:00.000Z" />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /Save changes/i }));
    await screen.findByText("Someone else changed this place.");

    await user.click(screen.getByRole("button", { name: /Reload/i }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
  });

  test("a 409 WITHOUT error: 'conflict' (#568's 'archived' case) shows no Reload button", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ ok: false, error: "archived", message: "This venue is archived and can't be edited." }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" expectedUpdatedAt="2026-01-01T00:00:00.000Z" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    await screen.findByText("This venue is archived and can't be edited.");
    expect(screen.queryByRole("button", { name: /Reload/i })).toBeNull();
  });

  test("the Save changes button re-enables after a conflict (not stuck on 'Saving…')", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ ok: false, error: "conflict", message: "Someone else changed this place." }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" expectedUpdatedAt="2026-01-01T00:00:00.000Z" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    const button = await screen.findByRole("button", { name: /Save changes/i });
    expect(button).not.toBeDisabled();
  });
});
