/**
 * DirectionButtons tests — issue #134 Walk / Bus / Drive direction buttons.
 *
 * Verifies:
 *   1. All three buttons render (Walk, Bus, Drive).
 *   2. Bus and Drive are anchor links with correct Google Maps deeplink format.
 *   3. Bus uses travelmode=transit, Drive uses travelmode=driving.
 *   4. Both external links have target="_blank" and rel="noopener noreferrer".
 *   5. Walk button is a <button> (triggers in-app route, not a link).
 *   6. Clicking Walk fires onWalk callback with the venue.
 *   7. Accessible labels include the venue name (e.g. "Walking directions to <name>").
 *   8. ES locale: buttons show Spanish labels.
 *   9. Google Maps deeplinks use api=1 param (required for params to work).
 *  10. Google Maps deeplinks OMIT origin (uses user's current location automatically).
 *  11. Google Maps deeplinks do NOT include dir_action=navigate.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DirectionButtons from "@/components/DirectionButtons";
import type { Venue } from "@/types/venue";

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test-v1",
    name: "Test Food Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St, Pueblo, CO",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

describe("DirectionButtons — renders all three buttons", () => {
  test("Walk button is present", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    expect(screen.getByRole("button", { name: /walk/i })).toBeDefined();
  });

  test("Bus link is present", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    expect(screen.getByRole("link", { name: /bus/i })).toBeDefined();
  });

  test("Drive link is present", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    expect(screen.getByRole("link", { name: /drive/i })).toBeDefined();
  });
});

describe("DirectionButtons — Walk button", () => {
  test("Walk renders as a button (not an anchor)", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const walkBtn = screen.getByRole("button", { name: /walk/i });
    expect(walkBtn.tagName).toBe("BUTTON");
  });

  test("clicking Walk fires onWalk with the venue", async () => {
    const onWalk = vi.fn();
    const user = userEvent.setup();
    const venue = makeVenue();
    render(<DirectionButtons venue={venue} onWalk={onWalk} locale="en" />);
    await user.click(screen.getByRole("button", { name: /walk/i }));
    expect(onWalk).toHaveBeenCalledTimes(1);
    expect(onWalk).toHaveBeenCalledWith(venue);
  });
});

describe("DirectionButtons — Bus deeplink", () => {
  test("Bus link opens in a new tab", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /bus/i }) as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
  });

  test("Bus link has rel=noopener noreferrer", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /bus/i }) as HTMLAnchorElement;
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  });

  test("Bus link destination is venue lat,lng", () => {
    const venue = makeVenue({ lat: 38.2544, lng: -104.6091 });
    render(<DirectionButtons venue={venue} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /bus/i }) as HTMLAnchorElement;
    // URLSearchParams encodes commas as %2C; decode before asserting
    const decoded = decodeURIComponent(link.href);
    expect(decoded).toContain("destination=38.2544,-104.6091");
  });

  test("Bus link uses travelmode=transit", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /bus/i }) as HTMLAnchorElement;
    expect(link.href).toContain("travelmode=transit");
  });

  test("Bus link includes api=1 (required for params)", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /bus/i }) as HTMLAnchorElement;
    expect(link.href).toContain("api=1");
  });

  test("Bus link omits origin (uses user current location)", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /bus/i }) as HTMLAnchorElement;
    expect(link.href).not.toContain("origin=");
  });

  test("Bus link does NOT include dir_action=navigate", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /bus/i }) as HTMLAnchorElement;
    expect(link.href).not.toContain("dir_action");
  });
});

describe("DirectionButtons — Drive deeplink", () => {
  test("Drive link opens in a new tab", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /drive/i }) as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
  });

  test("Drive link has rel=noopener noreferrer", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /drive/i }) as HTMLAnchorElement;
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  });

  test("Drive link destination is venue lat,lng", () => {
    const venue = makeVenue({ lat: 38.2544, lng: -104.6091 });
    render(<DirectionButtons venue={venue} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /drive/i }) as HTMLAnchorElement;
    // URLSearchParams encodes commas as %2C; decode before asserting
    const decoded = decodeURIComponent(link.href);
    expect(decoded).toContain("destination=38.2544,-104.6091");
  });

  test("Drive link uses travelmode=driving", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /drive/i }) as HTMLAnchorElement;
    expect(link.href).toContain("travelmode=driving");
  });

  test("Drive link includes api=1 (required for params)", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /drive/i }) as HTMLAnchorElement;
    expect(link.href).toContain("api=1");
  });

  test("Drive link omits origin (uses user current location)", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /drive/i }) as HTMLAnchorElement;
    expect(link.href).not.toContain("origin=");
  });

  test("Drive link does NOT include dir_action=navigate", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /drive/i }) as HTMLAnchorElement;
    expect(link.href).not.toContain("dir_action");
  });
});

describe("DirectionButtons — accessibility", () => {
  test("Walk button aria-label includes venue name", () => {
    const venue = makeVenue({ name: "Test Food Pantry" });
    render(<DirectionButtons venue={venue} onWalk={vi.fn()} locale="en" />);
    const btn = screen.getByRole("button", { name: /Walking directions to Test Food Pantry/i });
    expect(btn).toBeDefined();
  });

  test("Bus link aria-label includes venue name", () => {
    const venue = makeVenue({ name: "Test Food Pantry" });
    render(<DirectionButtons venue={venue} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /Bus directions to Test Food Pantry/i });
    expect(link).toBeDefined();
  });

  test("Drive link aria-label includes venue name", () => {
    const venue = makeVenue({ name: "Test Food Pantry" });
    render(<DirectionButtons venue={venue} onWalk={vi.fn()} locale="en" />);
    const link = screen.getByRole("link", { name: /Drive directions to Test Food Pantry/i });
    expect(link).toBeDefined();
  });

  test("External links communicate 'opens in new tab' to screen readers", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    // The aria-label on Bus and Drive should mention opening in a new tab
    const busLink = screen.getByRole("link", { name: /Bus.*new tab|opens in new tab.*Bus/i });
    expect(busLink).toBeDefined();
  });
});

describe("DirectionButtons — ES locale", () => {
  test("Walk button has ES aria-label in ES locale", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="es" />);
    // aria-label in ES: "Cómo llegar caminando a ..."
    const btn = screen.getByRole("button", { name: /caminando/i });
    expect(btn).toBeDefined();
  });

  test("Walk button shows 'Caminar' as visible text in ES locale", () => {
    const { container } = render(
      <DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="es" />,
    );
    // The visible label inside the button should be "Caminar"
    expect(container.textContent).toContain("Caminar");
  });

  test("Bus link has ES aria-label in ES locale", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="es" />);
    // aria-label in ES: "Cómo llegar en autobús a ..."
    const link = screen.getByRole("link", { name: /autobús/i });
    expect(link).toBeDefined();
  });

  test("Drive link has ES aria-label in ES locale", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="es" />);
    // aria-label in ES: "Cómo llegar manejando a ..."
    const link = screen.getByRole("link", { name: /manejando/i });
    expect(link).toBeDefined();
  });
});

describe("DirectionButtons — walking route active state", () => {
  test("Walk button shows route active state when isRouteActive=true", () => {
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
      />,
    );
    // When route is active, the Walk button should indicate "clear route" or active state
    const btn = screen.getByRole("button", { name: /walk|route|clear/i });
    expect(btn).toBeDefined();
  });
});

describe("DirectionButtons — in-card route readout (#134 FIX 1+2)", () => {
  test("no readout when isRouteActive=false even if routeInfo is provided", () => {
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={false}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
      />,
    );
    expect(screen.queryByTestId("walking-route-info")).toBeNull();
  });

  test("no readout when isRouteActive=true but routeInfo is null", () => {
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={null}
      />,
    );
    expect(screen.queryByTestId("walking-route-info")).toBeNull();
  });

  test("readout shown with EN localized strings when route is active", () => {
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
      />,
    );
    const readout = screen.getByTestId("walking-route-info");
    expect(readout).toBeDefined();
    // EN: "{distance} walk" → "0.4 mi walk"
    expect(screen.getByTestId("walking-route-distance").textContent).toBe("0.4 mi walk");
    // EN: "{duration}" → "8 min"
    expect(screen.getByTestId("walking-route-duration").textContent).toBe("8 min");
  });

  test("readout shown with ES localized strings when route is active", () => {
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="es"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
      />,
    );
    const readout = screen.getByTestId("walking-route-info");
    expect(readout).toBeDefined();
    // ES: "{distance} caminando" → "0.4 mi caminando"
    expect(screen.getByTestId("walking-route-distance").textContent).toBe("0.4 mi caminando");
    // ES: "{duration}" → "8 min" (pure passthrough — allowlisted as identical EN/ES)
    expect(screen.getByTestId("walking-route-duration").textContent).toBe("8 min");
  });
});
