/**
 * #917 (DESIGN.md R4, Card action row): Call and Website start the place
 * card. The risky parts tested here:
 *   - a missing phone or website is a greyed <button aria-disabled="true">,
 *     never a link (no href), still focusable, and says why;
 *   - CALL_CLICKED still fires, now from the Call button (the phone line in
 *     CONTACT is gone);
 *   - Website opens only the place's own site, never a Plentiful page.
 * Real venues from the published data, through the real card shells.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VenueCardBody from "@/components/VenueCardBody";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import { ownWebsite } from "@/components/VenueActionRow";
import { venues } from "@/data/venues";
import { track, EVENTS } from "@/lib/analytics";

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

const isPlentiful = (url?: string) => !!url && new URL(url).hostname.endsWith("plentiful.org");
const withBoth = venues.find((v) => v.phone && v.url && !isPlentiful(v.url))!;
const withNeither = venues.find((v) => !v.phone && (!v.url || isPlentiful(v.url)))!;
const plentifulOnly = venues.find((v) => isPlentiful(v.url))!;

beforeEach(() => vi.mocked(track).mockClear());

describe("Call and Website when the place has them", () => {
  test("Call is a tel: link named with the number, and tapping it fires CALL_CLICKED", () => {
    render(<VenueCardBody venue={withBoth} variant="sheet" locale="en" />);
    const call = screen.getByRole("link", { name: `Call ${withBoth.phone}` });
    expect(call.getAttribute("href")).toBe(`tel:${withBoth.phone}`);
    fireEvent.click(call);
    expect(track).toHaveBeenCalledWith(EVENTS.CALL_CLICKED, { venueId: withBoth.id, surface: "map" });
  });

  test("Website opens the place's own site in a new tab and fires WEBSITE_CLICKED", () => {
    render(<VenueCardBody venue={withBoth} variant="sheet" locale="en" />);
    const web = screen.getByRole("link", { name: `Visit ${withBoth.name}'s website (opens in a new tab)` });
    expect(web.getAttribute("href")).toBe(withBoth.url);
    expect(web.getAttribute("target")).toBe("_blank");
    expect(web.getAttribute("rel")).toContain("noopener");
    fireEvent.click(web);
    expect(track).toHaveBeenCalledWith(EVENTS.WEBSITE_CLICKED, { venueId: withBoth.id, surface: "map" });
  });

  test("the phone number line in CONTACT is gone: the number's only link is Call", () => {
    render(<VenueCardBody venue={withBoth} variant="sheet" locale="en" expanded />);
    expect(screen.queryByText("CONTACT")).toBeNull();
    const telLinks = [...document.querySelectorAll('a[href^="tel:"]')];
    expect(telLinks).toHaveLength(1);
  });
});

describe("Call and Website greyed when missing", () => {
  test.each([
    ["phone sheet", () => render(<VenueCardBody venue={withNeither} variant="sheet" locale="en" />)],
    ["computer panel", () => render(<DesktopVenueWindow venue={withNeither} onClose={() => {}} locale="en" />)],
  ])("%s: missing ones are aria-disabled buttons with no href, still focusable", (_where, renderCard) => {
    renderCard();
    for (const name of ["No phone number listed", "No website listed"]) {
      const el = screen.getByRole("button", { name });
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("aria-disabled")).toBe("true");
      expect(el.hasAttribute("href")).toBe(false);
      // Not the `disabled` attribute: it must stay in the Tab order so a screen reader hears why.
      expect(el.hasAttribute("disabled")).toBe(false);
      el.focus();
      expect(document.activeElement).toBe(el);
      fireEvent.click(el);
    }
    expect(track).not.toHaveBeenCalled();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });

  test("Spanish names for the missing ones", () => {
    render(<VenueCardBody venue={withNeither} variant="sheet" locale="es" />);
    expect(screen.getByRole("button", { name: "Sin número de teléfono" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Sin sitio web" })).toBeDefined();
  });

  test("a Plentiful page is never the Website: it stays grey, and the Plentiful line keeps that link", () => {
    expect(ownWebsite(plentifulOnly)).toBeNull();
    expect(ownWebsite(withBoth)).toBe(withBoth.url);
    expect(ownWebsite({ url: "javascript:alert(1)" })).toBeNull();
    expect(ownWebsite({ url: "https://www.plentiful.org.evil.example/" })).toBe("https://www.plentiful.org.evil.example/");
  });
});

describe("computer panel", () => {
  test("Call, Website, Share, Save, then Close, in Tab order, with the × ending the row", () => {
    const onClose = vi.fn();
    render(<DesktopVenueWindow venue={withBoth} onClose={onClose} locale="en" />);
    const order = [
      screen.getByRole("link", { name: `Call ${withBoth.phone}` }),
      screen.getByRole("link", { name: /website/ }),
      screen.getByRole("button", { name: `Share ${withBoth.name}` }),
      screen.getByRole("button", { name: `Add ${withBoth.name} to saved` }),
      screen.getByRole("button", { name: "Close" }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(order[0]!.parentElement).toBe(order[4]!.parentElement);
    fireEvent.click(order[4]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("opened from Saved: ← Saved and the × share the top line, and the action row has no ×", () => {
    const onClose = vi.fn();
    const back = vi.fn();
    render(<DesktopVenueWindow venue={withBoth} onClose={onClose} locale="en" backTo={{ label: "← Saved", onClick: back }} />);
    const close = screen.getAllByRole("button", { name: "Close" });
    expect(close).toHaveLength(1);
    expect(close[0]!.parentElement).toBe(screen.getByRole("button", { name: "← Saved" }).parentElement);
    expect(close[0]!.parentElement!.contains(screen.getByRole("button", { name: `Share ${withBoth.name}` }))).toBe(false);
  });
});
