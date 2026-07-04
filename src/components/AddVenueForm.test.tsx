/**
 * AddVenueForm tests (#254).
 *
 * Covers:
 *   1. Every field renders with an accessible label.
 *   2. Source defaults to "Manual entry".
 *   3. Client-side validation blocks submit on an empty required field
 *      (fetch never called).
 *   4. A valid submit POSTs the expected JSON body to /api/admin/venues.
 *   5. A server 422 response renders the returned per-field error inline.
 *   6. A successful (201) submit redirects to /admin and calls
 *      router.refresh().
 *   7. initialValues pre-fills the form (the seam a parent uses to render
 *      a sample-data preview screenshot).
 *
 * next/navigation's useRouter is mocked module-wide (no existing precedent
 * in this codebase to follow — this is the first client component here
 * that navigates) since @testing-library/react's plain render() has no
 * App Router context to satisfy useRouter()'s real implementation.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

describe("AddVenueForm — rendering", () => {
  test("every field has an accessible label", () => {
    render(<AddVenueForm />);
    expect(screen.getByLabelText(/^Name/i)).toBeDefined();
    expect(screen.getByLabelText(/^Category/i)).toBeDefined();
    expect(screen.getByLabelText(/^Address/i)).toBeDefined();
    expect(screen.getByLabelText(/^Last verified/i)).toBeDefined();
    expect(screen.getByLabelText(/^Latitude/i)).toBeDefined();
    expect(screen.getByLabelText(/^Longitude/i)).toBeDefined();
    expect(screen.getByLabelText("Monday")).toBeDefined();
    expect(screen.getByLabelText("Sunday")).toBeDefined();
    expect(screen.getByLabelText(/^Accepts SNAP/i)).toBeDefined();
    expect(screen.getByLabelText(/^Accepts WIC/i)).toBeDefined();
    expect(screen.getByLabelText(/^Phone/i)).toBeDefined();
    expect(screen.getByLabelText(/^Email/i)).toBeDefined();
    expect(screen.getByLabelText(/^Website/i)).toBeDefined();
    expect(screen.getByLabelText(/^Operator/i)).toBeDefined();
    expect(screen.getByLabelText(/^Notes/i)).toBeDefined();
    expect(screen.getByLabelText(/^Source/i)).toBeDefined();
    expect(screen.getByLabelText(/Outside Pueblo County/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Add venue/i })).toBeDefined();
  });

  test("Source defaults to 'Manual entry'", () => {
    render(<AddVenueForm />);
    expect((screen.getByLabelText(/^Source/i) as HTMLInputElement).value).toBe("Manual entry");
  });

  test("initialValues pre-fills the form (the preview-screenshot seam)", () => {
    render(<AddVenueForm initialValues={{ name: "Sample Venue", category: "pantry" }} />);
    expect((screen.getByLabelText(/^Name/i) as HTMLInputElement).value).toBe("Sample Venue");
    expect((screen.getByLabelText(/^Category/i) as HTMLSelectElement).value).toBe("pantry");
  });
});

describe("AddVenueForm — client-side validation", () => {
  test("blocks submit when a required field is empty; fetch is never called", async () => {
    const user = userEvent.setup();
    render(<AddVenueForm />);

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    expect(await screen.findByText(/Name is required/i)).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("AddVenueForm — submit", () => {
  test("a valid submit POSTs the expected JSON body to /api/admin/venues", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201, json: async () => ({ id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/venues");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Eastside Pantry");
    expect(body.category).toBe("pantry");
    expect(body.address).toBe("123 Test St, Pueblo, CO");
    expect(body.lat).toBe(38.25);
    expect(body.lng).toBe(-104.6);
    expect(body.source).toBe("Manual entry");
    expect(body.outside_county).toBe(0);
    expect(body.accepts_snap).toBeNull();
    expect(body.accepts_wic).toBeNull();
    expect(body.hours_weekly).toBeUndefined();
  });

  test("a server 422 response renders the returned per-field error inline, no redirect", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 422,
      json: async () => ({ ok: false, errors: { name: "That name is already in use." } }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    expect(await screen.findByText("That name is already in use.")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("a successful (201) submit redirects to /admin and refreshes", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201, json: async () => ({ id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("a network-level failure shows a generic error banner, no redirect", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Add venue/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("AddVenueForm — edit mode (#255)", () => {
  test("venueId present -> submit button reads 'Save changes', not 'Add venue'", () => {
    render(<AddVenueForm venueId="manual-abc" initialValues={{ name: "Eastside Pantry" }} />);
    expect(screen.getByRole("button", { name: /Save changes/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Add venue$/i })).toBeNull();
  });

  test("a valid submit PATCHes /api/admin/venues/<id> (not POST /api/admin/venues)", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/venues/manual-abc");
    expect(init.method).toBe("PATCH");
  });

  test("a successful (200) edit submit redirects to /admin and refreshes", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("a server 422 response on edit renders the returned per-field error inline, no redirect", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 422,
      json: async () => ({ ok: false, errors: { name: "That name is already in use." } }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(await screen.findByText("That name is already in use.")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("a 201 response (create's success status) is NOT treated as success in edit mode", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201, json: async () => ({ id: "manual-abc" }) });
    const user = userEvent.setup();
    render(<AddVenueForm venueId="manual-abc" />);
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("AddVenueForm — geocode (Find location from address)", () => {
  test("the button is disabled while the address field is blank", () => {
    render(<AddVenueForm />);
    expect(screen.getByRole("button", { name: /Find location from address/i })).toBeDisabled();
  });

  test("a single match calls /api/admin/geocode, fills lat/lng, and shows a confirmation", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        matches: [{ lat: 38.25, lng: -104.6, matchedAddress: "123 MAIN ST, PUEBLO, CO, 81003" }],
      }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.type(screen.getByLabelText(/^Address/i), "123 Main St, Pueblo, CO");

    await user.click(screen.getByRole("button", { name: /Find location from address/i }));

    expect(await screen.findByText(/Found: 123 MAIN ST, PUEBLO, CO, 81003/i)).toBeDefined();
    expect((screen.getByLabelText(/^Latitude/i) as HTMLInputElement).value).toBe("38.25");
    expect((screen.getByLabelText(/^Longitude/i) as HTMLInputElement).value).toBe("-104.6");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("/api/admin/geocode?q=" + encodeURIComponent("123 Main St, Pueblo, CO"));
  });

  test("multiple matches render a labeled, keyboard-reachable pick list; choosing one fills lat/lng", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        matches: [
          { lat: 38.25, lng: -104.6, matchedAddress: "123 MAIN ST, PUEBLO, CO, 81003" },
          { lat: 38.26, lng: -104.61, matchedAddress: "123 MAIN AVE, PUEBLO, CO, 81003" },
        ],
      }),
    });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.type(screen.getByLabelText(/^Address/i), "123 Main, Pueblo, CO");

    await user.click(screen.getByRole("button", { name: /Find location from address/i }));

    // A real <button> in the pick list (not a div with a click handler) is
    // inherently reachable via Tab and operable via Enter/Space — asserting
    // getByRole("button", ...) finds it IS the keyboard-navigable guarantee.
    const candidate = await screen.findByRole("button", { name: "123 MAIN AVE, PUEBLO, CO, 81003" });
    await user.click(candidate);

    expect((screen.getByLabelText(/^Latitude/i) as HTMLInputElement).value).toBe("38.26");
    expect((screen.getByLabelText(/^Longitude/i) as HTMLInputElement).value).toBe("-104.61");
  });

  test("0 matches shows a no-match message and leaves lat/lng untouched", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ matches: [] }) });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.type(screen.getByLabelText(/^Address/i), "a nonsense address");

    await user.click(screen.getByRole("button", { name: /Find location from address/i }));

    expect(await screen.findByText(/No match found/i)).toBeDefined();
    expect((screen.getByLabelText(/^Latitude/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Longitude/i) as HTMLInputElement).value).toBe("");
  });

  test("a non-200 response shows the fallback message instead of crashing", async () => {
    mockFetch.mockResolvedValueOnce({ status: 502, json: async () => ({ error: "boom" }) });
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.type(screen.getByLabelText(/^Address/i), "123 Main St, Pueblo, CO");

    await user.click(screen.getByRole("button", { name: /Find location from address/i }));

    expect(await screen.findByText(/Location lookup is unavailable right now/i)).toBeDefined();
  });

  test("a network-level failure shows the fallback message instead of crashing", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<AddVenueForm />);
    await user.type(screen.getByLabelText(/^Address/i), "123 Main St, Pueblo, CO");

    await user.click(screen.getByRole("button", { name: /Find location from address/i }));

    expect(await screen.findByText(/Location lookup is unavailable right now/i)).toBeDefined();
  });
});
