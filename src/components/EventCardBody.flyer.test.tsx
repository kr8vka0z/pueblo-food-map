/**
 * The flyer on the event card (#760): where it shows, the alt-text fallback
 * order, that it opens full size, and above all that a missing or failing image
 * leaves a clean card (no broken-image element). Elements are found by test id /
 * role; no wording or CSS is asserted.
 */

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EventCardBody from "@/components/EventCardBody";
import type { PublicEventDetail, PublicFlyer } from "@/lib/events";

const START = Date.parse("2026-11-21T17:00:00.000Z");
const FLYER: PublicFlyer = { src: "/api/public/events/evt-1/flyer/x.jpg", width: 600, height: 840, alt: "Turkey flyer", alt_es: "Volante de pavos" };

function makeEvent(flyer: PublicFlyer | null | undefined): PublicEventDetail {
  return {
    id: "evt-1", name: "Turkey drive", name_es: "Colecta de pavos", host: null, host_es: null,
    description: null, description_es: null, what_to_bring: null, what_to_bring_es: null,
    starts_at: new Date(START).toISOString(), ends_at: new Date(START + 4 * 3_600_000).toISOString(),
    lat: 38.25, lng: -104.6, address: "1 Main St", venue_id: null, link_url: null,
    status: "published", cancel_note: null, cancel_note_es: null, flyer,
  };
}

function renderCard(flyer: PublicFlyer | null | undefined, extra: Partial<React.ComponentProps<typeof EventCardBody>> = {}) {
  return render(
    <EventCardBody event={makeEvent(flyer)} locale="en" userLocation={null} headingId="h" onClose={vi.fn()} onSeeOpenNow={vi.fn()} {...extra} />,
  );
}

describe("event card flyer", () => {
  test("renders a lazy, async-decoded image with its stored size, linked full size in a new tab", () => {
    renderCard(FLYER);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img).toHaveAttribute("src", FLYER.src);
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("width", "600");
    expect(img).toHaveAttribute("height", "840");
    const link = screen.getByTestId("event-flyer");
    expect(link).toHaveAttribute("href", FLYER.src);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  test("alt: page language first, then the English alt, then the event name", () => {
    const { unmount } = renderCard(FLYER, { locale: "es" });
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Volante de pavos");
    unmount();

    const en = renderCard({ ...FLYER, alt_es: null }, { locale: "es" });
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Turkey flyer");
    en.unmount();

    renderCard({ ...FLYER, alt: null, alt_es: null }, { locale: "en" });
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Turkey drive");
  });

  test("an image that fails to load disappears completely and the rest of the card stays", () => {
    renderCard(FLYER);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByTestId("event-flyer")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId("event-badge")).toBeInTheDocument();
  });

  test.each([[null], [undefined]])("an event with no flyer (%s) renders no flyer element", (flyer) => {
    renderCard(flyer);
    expect(screen.queryByTestId("event-flyer")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("on the phone sheet the flyer is absent while collapsed and joins above the badge when expanded", () => {
    const collapsed = renderCard(FLYER, { layout: "sheet", expanded: false });
    expect(screen.queryByTestId("event-flyer")).toBeNull();
    expect(screen.getByTestId("event-badge")).toBeInTheDocument();
    collapsed.unmount();

    renderCard(FLYER, { layout: "sheet", expanded: true });
    const flyer = screen.getByTestId("event-flyer");
    const badge = screen.getByTestId("event-badge");
    expect(flyer.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
