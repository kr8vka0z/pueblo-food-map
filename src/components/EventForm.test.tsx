/**
 * EventForm (#757): the behaviors that guard stored data — a field error
 * lands on the right field and blocks the request, times are sent exactly as
 * typed (Pueblo wall clock, never converted in the browser), picking a venue
 * copies its location, editing a typed address drops stale coordinates, a
 * 409 keeps the admin's edits and offers Reload, and a save refreshes the
 * `updated_at` precondition. No wording or styling assertions.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRouter = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

import EventForm from "@/components/EventForm";

const VENUES = [{ id: "pantry-1", name: "Eastside Pantry", address: "9 Elm St, Pueblo, CO", lat: 38.3, lng: -104.5 }];
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  Object.values(mockRouter).forEach((f) => f.mockReset());
});
afterEach(() => vi.unstubAllGlobals());

const invalid = (el: HTMLElement) => el.getAttribute("aria-invalid") === "true";
const nameInput = () => screen.getByLabelText(/^Name \(English\)/);
const startsInput = () => screen.getByLabelText(/^Starts/);
const endsInput = () => screen.getByLabelText(/^Ends/);

function fillTimes(start = "2026-11-21T10:00", end = "2026-11-21T14:00") {
  fireEvent.change(startsInput(), { target: { value: start } });
  fireEvent.change(endsInput(), { target: { value: end } });
}

async function pickVenue() {
  await userEvent.click(screen.getByLabelText(/already on the map/i));
  await userEvent.type(screen.getByLabelText(/search places/i), "east");
  await userEvent.click(screen.getByRole("button", { name: /Eastside Pantry/ }));
}

describe("EventForm validation", () => {
  test("missing name, missing place, and end before start each flag their own field and send nothing", async () => {
    render(<EventForm venues={VENUES} />);
    fillTimes("2026-11-21T14:00", "2026-11-21T10:00");

    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(invalid(nameInput())).toBe(true);
    expect(invalid(endsInput())).toBe(true);
    expect(invalid(startsInput())).toBe(false);
    expect(invalid(screen.getByLabelText(/^Address/))).toBe(true); // the place error sits on the place field
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an address that was typed but never located is a place error", async () => {
    render(<EventForm venues={VENUES} />);
    await userEvent.type(nameInput(), "Turkey drive");
    fillTimes();
    await userEvent.type(screen.getByLabelText(/^Address/), "1 Main St");

    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(invalid(screen.getByLabelText(/^Address/))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("cancelling a published event requires a note before anything is sent", async () => {
    render(
      <EventForm
        venues={VENUES}
        eventId="e1"
        status="published"
        expectedUpdatedAt="2026-10-01T00:00:00.000Z"
        initialValues={{ name: "Turkey drive", startsLocal: "2026-11-21T10:00", endsLocal: "2026-11-21T14:00", address: "1 Main", lat: "38.2", lng: "-104.6" }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^cancel event$/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirm cancel/i }));

    expect(invalid(screen.getByLabelText(/^Note \(English\)/))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("EventForm place and time handling", () => {
  test("picking a venue copies its address and coordinates and keeps its id; times are sent exactly as typed", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, id: "new-1", status: "draft", updated_at: "x" }), { status: 201 }));
    render(<EventForm venues={VENUES} />);
    await userEvent.type(nameInput(), "Turkey drive");
    fillTimes("2026-03-08T01:30", "2026-03-08T03:30");
    await pickVenue();

    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/events");
    expect(JSON.parse(init.body as string)).toMatchObject({
      action: "save_draft",
      venue_id: "pantry-1",
      address: "9 Elm St, Pueblo, CO",
      lat: 38.3,
      lng: -104.5,
      starts_at_local: "2026-03-08T01:30",
      ends_at_local: "2026-03-08T03:30",
    });
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/admin/events/new-1/edit?saved=1"));
  });

  test("editing a typed address drops its old coordinates so they can't outlive the address", async () => {
    render(<EventForm venues={VENUES} initialValues={{ address: "1 Main", lat: "38.2", lng: "-104.6" }} />);
    await userEvent.type(screen.getByLabelText(/^Address/), "x");
    await userEvent.type(nameInput(), "Turkey drive");
    fillTimes();

    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(invalid(screen.getByLabelText(/^Address/))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("EventForm edit mode", () => {
  const props = {
    venues: VENUES,
    eventId: "e1",
    status: "published" as const,
    expectedUpdatedAt: "2026-10-01T00:00:00.000Z",
    initialValues: { name: "Turkey drive", startsLocal: "2026-11-21T10:00", endsLocal: "2026-11-21T14:00", address: "1 Main", lat: "38.2", lng: "-104.6" },
  };

  test("a save sends the precondition, then shows view-on-map and sends the NEW updated_at next time", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, id: "e1", status: "published", updated_at: "2026-10-02T00:00:00.000Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, id: "e1", status: "published", updated_at: "2026-10-03T00:00:00.000Z" }), { status: 200 }));
    render(<EventForm {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByRole("link", { name: /view on map/i })).toHaveAttribute("href", "/?event=e1");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies[0]).toMatchObject({ action: "save", expectedUpdatedAt: "2026-10-01T00:00:00.000Z" });
    expect(bodies[1].expectedUpdatedAt).toBe("2026-10-02T00:00:00.000Z");
  });

  test("a 409 conflict keeps the admin's edits on screen and offers Reload", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "conflict", message: "Someone else changed this event." }), { status: 409 }));
    render(<EventForm {...props} />);
    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), "My unsaved edit");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("button", { name: /reload/i })).toBeInTheDocument();
    expect(nameInput()).toHaveValue("My unsaved edit");
  });

  test("a server field error (422) is shown next to its field", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, errors: { link_url: "bad link" } }), { status: 422 }));
    render(<EventForm {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(invalid(screen.getByLabelText(/^Link/))).toBe(true));
  });

  test("archive asks first, sends the precondition, and returns to the list", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: "archived" }), { status: 200 }));
    render(<EventForm {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /archive event/i }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/admin/events"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/events/e1/archive");
    expect(JSON.parse(init.body as string)).toEqual({ expectedUpdatedAt: "2026-10-01T00:00:00.000Z" });
  });

  test("declining the archive confirmation sends nothing", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<EventForm {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /archive event/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
