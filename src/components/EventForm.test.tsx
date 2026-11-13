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
  await userEvent.click(screen.getByLabelText(/^on the map$/i));
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

  // #926: the errors can sit above the fold, so focus goes to the first wrong box, not left on the button.
  test("a refused save puts focus in the first box that is wrong", async () => {
    render(<EventForm venues={VENUES} />);
    await userEvent.type(nameInput(), "Turkey drive");

    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(startsInput()).toHaveFocus());
  });

  // #926: Cancel event is a step with a way back. Keep event, or Escape from
  // anywhere in the step (here the red button, outside the note's own
  // wrapper), sends nothing, drops the half-typed note, and hands focus back
  // to "Cancel event".
  test.each<[string, () => Promise<void>]>([
    ["Keep event", () => userEvent.click(screen.getByRole("button", { name: /^keep event$/i }))],
    [
      "Escape",
      async () => {
        screen.getByRole("button", { name: /^confirm cancel event$/i }).focus();
        await userEvent.keyboard("{Escape}");
      },
    ],
  ])("%s closes the cancel step, sends nothing, clears the note and returns focus", async (_way, close) => {
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
    const note = screen.getByLabelText(/^Note \(English\)/);
    expect(note).toHaveFocus();
    await userEvent.type(note, "Rained out");

    await close();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^Note \(English\)/)).toBeNull();
    const reopen = screen.getByRole("button", { name: /^cancel event$/i });
    expect(reopen).toHaveFocus();
    await userEvent.click(reopen);
    expect(screen.getByLabelText(/^Note \(English\)/)).toHaveValue("");
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

  // #926: a pressed control that goes away hands focus to what replaced it,
  // never to the page body: the picked result to Change, Change to the search box.
  test("picking a place puts focus on Change; Change puts it back in the search box", async () => {
    render(<EventForm venues={VENUES} />);
    await pickVenue();
    const change = screen.getByRole("button", { name: "Change" });
    expect(change).toHaveFocus();
    await userEvent.click(change);
    expect(screen.getByLabelText(/search places/i)).toHaveFocus();
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

  // #926: nobody leaves the page while a save still lands.
  test("while a save runs, Cancel is off and its click is stopped", async () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // the save never answers
    render(<EventForm {...props} />);
    const cancel = screen.getByRole("link", { name: "Cancel" });
    expect(cancel).not.toHaveAttribute("aria-disabled");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(cancel).toHaveAttribute("aria-disabled", "true"));
    expect(cancel).toHaveAttribute("tabindex", "-1");
    expect(fireEvent.click(cancel)).toBe(false); // preventDefault: the link does not navigate
  });

  test("a server field error (422) is shown next to its field", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, errors: { link_url: "bad link" } }), { status: 422 }));
    render(<EventForm {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(invalid(screen.getByLabelText(/^Link/))).toBe(true));
  });

  test("Enter in a box saves: the save button is the form's first submit button", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, id: "e1", status: "published", updated_at: "x" }), { status: 200 }));
    render(<EventForm {...props} />);
    await userEvent.type(nameInput(), "{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).action).toBe("save");
  });

  test("archive asks on the page first, sends the precondition only on the second press, and returns to the list", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: "archived" }), { status: 200 }));
    render(<EventForm {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /archive event/i }));
    expect(fetchMock).not.toHaveBeenCalled(); // the first press only opens the confirm
    await userEvent.click(screen.getByRole("button", { name: /archive event/i })); // the confirm's action button

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/admin/events"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/events/e1/archive");
    expect(JSON.parse(init.body as string)).toEqual({ expectedUpdatedAt: "2026-10-01T00:00:00.000Z" });
  });

  test("pressing Cancel in the archive confirm sends nothing and brings the Archive button back", async () => {
    render(<EventForm {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /archive event/i }));
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /archive event/i })).toHaveFocus();
  });
});
