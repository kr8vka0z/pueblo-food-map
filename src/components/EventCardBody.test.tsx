/**
 * EventCardBody.test.tsx — the risky behaviors of the event card (#759):
 * ended/cancelled hide the action buttons, the badge is not a live region and
 * counts down off the shared clock, Share falls back to copying the right
 * link, Add to calendar hands a well-formed file to the download, Spanish
 * falls back to English, and only an http(s) link renders. Elements are found
 * by role/test id; no wording or CSS is asserted.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const downloadIcs = vi.fn();
vi.mock("@/lib/eventIcs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/eventIcs")>()),
  downloadIcs: (...args: unknown[]) => downloadIcs(...args),
}));

import EventCardBody from "@/components/EventCardBody";
import { t } from "@/lib/i18n";
import type { PublicEventDetail } from "@/lib/events";

const START = Date.parse("2026-11-21T17:00:00.000Z");
const HOUR = 3_600_000;

function makeEvent(overrides: Partial<PublicEventDetail> = {}): PublicEventDetail {
  return {
    id: "evt-1",
    name: "Turkey drive",
    name_es: "Colecta de pavos",
    host: "Pueblo Food Project",
    host_es: null,
    description: "Free turkeys, first come.",
    description_es: null,
    what_to_bring: "Bags",
    what_to_bring_es: "Bolsas",
    starts_at: new Date(START).toISOString(),
    ends_at: new Date(START + 4 * HOUR).toISOString(),
    lat: 38.2544,
    lng: -104.6091,
    address: "1 Main St, Pueblo, CO",
    venue_id: null,
    link_url: null,
    status: "published",
    cancel_note: null,
    cancel_note_es: null,
    ...overrides,
  };
}

function renderCard(event: PublicEventDetail, extra: Partial<React.ComponentProps<typeof EventCardBody>> = {}) {
  const onClose = vi.fn();
  const onSeeOpenNow = vi.fn();
  const view = render(
    <EventCardBody
      event={event}
      locale="en"
      userLocation={null}
      headingId="h"
      onClose={onClose}
      onSeeOpenNow={onSeeOpenNow}
      {...extra}
    />,
  );
  return { ...view, onClose, onSeeOpenNow };
}

const directions = () => screen.queryByRole("link", { name: /Get directions/i });
const shareButton = () => screen.queryByRole("button", { name: t("events.card.share", "en") });
const calendarButton = () => screen.queryByRole("button", { name: t("events.card.calendar", "en") });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  downloadIcs.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  delete (navigator as unknown as Record<string, unknown>).share;
  delete (navigator as unknown as Record<string, unknown>).clipboard;
});

describe("active event", () => {
  test("shows Get directions (a link to Google Maps), Share and Add to calendar", () => {
    vi.setSystemTime(START + HOUR);
    renderCard(makeEvent());

    expect(directions()).not.toBeNull();
    expect(directions()!.getAttribute("href")).toContain("destination=38.2544%2C-104.6091");
    expect(directions()!.getAttribute("rel")).toContain("noopener");
    expect(shareButton()).not.toBeNull();
    expect(calendarButton()).not.toBeNull();
  });

  test("the badge is plain text, not a live region, and counts down each minute off the shared clock", () => {
    vi.setSystemTime(START - 20 * 60_000);
    renderCard(makeEvent());
    const badge = screen.getByTestId("event-badge");
    expect(badge.closest("[aria-live], [role='status'], [role='alert']")).toBeNull();
    expect(badge.textContent).toContain("20 min");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId("event-badge").textContent).toContain("19 min");
  });

  test("flips to live at the start while the card is open", () => {
    vi.setSystemTime(START - 30_000);
    renderCard(makeEvent());
    expect(screen.getByTestId("event-badge").dataset.phase).toBe("upcoming");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId("event-badge").dataset.phase).toBe("live");
  });

  test("shows distance only when the visitor's location is known", () => {
    vi.setSystemTime(START - HOUR);
    const { unmount } = renderCard(makeEvent());
    expect(screen.queryByText(/ mi /)).toBeNull();
    unmount();

    renderCard(makeEvent(), { userLocation: { lat: 38.27, lng: -104.61 } });
    expect(screen.getByText(/ mi /)).toBeTruthy();
  });
});

describe("Share", () => {
  test("copies the ?event= map link when there is no share sheet", async () => {
    vi.setSystemTime(START);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderCard(makeEvent());

    await act(async () => {
      shareButton()!.click();
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?event=evt-1`);
    // The confirmation is announced once, not on every clock tick.
    // A live region OUTSIDE the button, whose text changes when copied.
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(t("events.card.shareCopied", "en"));
    expect(status.closest("button")).toBeNull();
  });

  test("with no share sheet and no clipboard the link is shown to copy by hand", async () => {
    vi.setSystemTime(START);
    renderCard(makeEvent());

    await act(async () => {
      shareButton()!.click();
    });

    expect(screen.getByText(`${window.location.origin}/?event=evt-1`)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  test("shares the /es link on a Spanish page", async () => {
    vi.setSystemTime(START);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderCard(makeEvent(), { locale: "es" });

    await act(async () => {
      screen.getByRole("button", { name: t("events.card.share", "es") }).click();
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/es?event=evt-1`);
  });
});

describe("Add to calendar", () => {
  test("downloads a CRLF .ics with absolute UTC start/end, the address and the event link", () => {
    vi.setSystemTime(START);
    renderCard(makeEvent());

    calendarButton()!.click();

    expect(downloadIcs).toHaveBeenCalledTimes(1);
    const [filename, content] = downloadIcs.mock.calls[0] as [string, string];
    expect(filename).toBe("turkey-drive.ics");
    expect(content).toContain("DTSTART:20261121T170000Z\r\n");
    expect(content).toContain("DTEND:20261121T210000Z\r\n");
    expect(content).toContain("LOCATION:1 Main St\\, Pueblo\\, CO\r\n");
    expect(content).toContain(`URL:${window.location.origin}/?event=evt-1\r\n`);
  });
});

describe("ended and cancelled events (shared link opened late)", () => {
  test("ended: no Get directions, Share or Add to calendar; a way to see places open now", () => {
    vi.setSystemTime(START + 5 * HOUR);
    const { onSeeOpenNow } = renderCard(makeEvent());

    expect(screen.getByTestId("event-badge").dataset.phase).toBe("ended");
    expect(directions()).toBeNull();
    expect(shareButton()).toBeNull();
    expect(calendarButton()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t("events.card.seeOpenNow", "en") }));
    expect(onSeeOpenNow).toHaveBeenCalledTimes(1);
  });

  test("cancelled: shows the admin's note, and even a future start offers no actions", () => {
    vi.setSystemTime(START - 24 * HOUR);
    renderCard(makeEvent({ status: "cancelled", cancel_note: "Cancelled for snow", cancel_note_es: null }));

    expect(screen.getByTestId("event-badge").dataset.phase).toBe("cancelled");
    expect(screen.getByText("Cancelled for snow")).toBeTruthy();
    expect(directions()).toBeNull();
    expect(shareButton()).toBeNull();
    expect(calendarButton()).toBeNull();
  });
});

describe("text", () => {
  test("Spanish page uses Spanish text where present and falls back to English where blank", () => {
    vi.setSystemTime(START);
    renderCard(makeEvent(), { locale: "es" });

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Colecta de pavos");
    expect(screen.getByText("Bolsas")).toBeTruthy();
    // description_es is null -> the English text.
    expect(screen.getByText("Free turkeys, first come.")).toBeTruthy();
  });

  test("event text is plain text: markup in a field is shown, never rendered", () => {
    vi.setSystemTime(START);
    const { container } = renderCard(makeEvent({ description: "<img src=x onerror=alert(1)> hi" }));

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeTruthy();
  });

  test("only an http(s) link is rendered, with rel=noopener noreferrer", () => {
    vi.setSystemTime(START);
    const bad = renderCard(makeEvent({ link_url: "javascript:alert(1)" }));
    expect(bad.container.querySelector('a[href^="javascript"]')).toBeNull();
    bad.unmount();

    const { container } = renderCard(makeEvent({ link_url: "https://example.org/info" }));
    const link = container.querySelector('a[href="https://example.org/info"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("close", () => {
  test("the close button calls onClose", () => {
    vi.setSystemTime(START);
    const { onClose } = renderCard(makeEvent());

    fireEvent.click(screen.getByRole("button", { name: t("events.card.closeAria", "en") }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
