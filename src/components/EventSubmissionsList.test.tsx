/**
 * EventSubmissionsList (#883, #926): each choice in an item's three-dot menu
 * posts to its own route for that item, and while one is in flight the menu
 * sends nothing more (the old buttons' disabled state). An unreadable item
 * keeps a plain Dismiss.
 */

import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRouter = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

import EventSubmissionsList from "@/components/EventSubmissionsList";
import { parseSubmissionPayload, type PendingEventSubmission } from "@/lib/eventSubmissions";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.values(mockRouter).forEach((f) => f.mockReset());
});
afterEach(() => vi.unstubAllGlobals());

// The payload goes through the same parser the server read uses.
const item = (id: string, payloadJson: string): PendingEventSubmission => ({
  id,
  createdAt: "2026-11-06T22:12:00.000Z",
  submitterName: "Lee Park",
  submitterEmail: "lee@example.com",
  payload: parseSubmissionPayload(payloadJson),
  hasFlyer: false,
});
const soupNight = JSON.stringify({
  name: "Community Soup Night",
  host: "Grace Neighbors Church",
  description: "Hot soup.",
  whatToBring: null,
  startsAt: "2026-11-21T00:00:00.000Z",
  endsAt: "2026-11-21T02:00:00.000Z",
  venueName: null,
  address: "700 Example Blvd",
  linkUrl: null,
  linkLabel: "website",
  lat: null,
  lng: null,
});

describe("EventSubmissionsList", () => {
  test.each([
    ["Make it a draft event", "convert"],
    ["Dismiss", "dismiss"],
  ])("%s posts to the item's %s route", async (label, path) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, editUrl: "/admin/events/e9/edit" }), { status: 200 }));
    render(<EventSubmissionsList items={[item("s1", soupNight)]} />);

    await user.click(screen.getByRole("button", { name: /more actions for community soup night/i }));
    await user.click(screen.getByRole("menuitem", { name: label }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/event-submissions/s1/${path}`);
  });

  // #926 integration: the three-dot button itself is disabled while busy, so
  // the menu cannot even open for a second choice.
  test("while a choice is in flight, the menu button is off, keeps focus, and nothing more is sent", async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(new Promise(() => {})); // never answers
    render(<EventSubmissionsList items={[item("s1", soupNight)]} />);
    const menuButton = () => screen.getByRole("button", { name: /more actions for community soup night/i });

    await user.click(menuButton());
    await user.click(screen.getByRole("menuitem", { name: "Make it a draft event" }));
    expect(menuButton()).toHaveAttribute("aria-disabled", "true");
    expect(menuButton()).toHaveFocus();
    await user.click(menuButton());

    expect(screen.queryByRole("menu")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("an unreadable submission has a plain Dismiss and no menu", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<EventSubmissionsList items={[item("s2", "not json")]} />);

    expect(screen.queryByRole("button", { name: /more actions/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/event-submissions/s2/dismiss"));
  });
});
