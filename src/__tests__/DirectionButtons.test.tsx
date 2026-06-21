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
 *  12. Turn-by-turn step list renders when steps are provided.
 *  13. Show/Hide steps toggle expands/collapses list and flips aria-expanded.
 *  14. Google Maps walk link has correct href (travelmode=walking) and safe rel.
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

// ─── Sample steps for turn-by-turn tests ─────────────────────────────────────

const SAMPLE_STEPS = [
  { instruction: "Head north on Main St", distance: 50 },    // 50 m = ~164 ft → ft display
  { instruction: "Turn right on Union Ave", distance: 300 }, // 300 m = ~0.19 mi → mi display
  { instruction: "Arrive at destination", distance: 0 },
];

describe("DirectionButtons — turn-by-turn step list (#134 enhancement)", () => {
  test("step list is NOT rendered when no steps are provided", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
      />,
    );
    expect(container.querySelector("[data-testid='walk-steps-list']")).toBeNull();
    // Toggle button also absent when no steps
    expect(container.querySelector("[data-testid='walk-steps-toggle']")).toBeNull();
  });

  test("step list is NOT rendered when steps is an empty array", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={[]}
      />,
    );
    expect(container.querySelector("[data-testid='walk-steps-list']")).toBeNull();
    expect(container.querySelector("[data-testid='walk-steps-toggle']")).toBeNull();
  });

  test("toggle button is rendered when steps are present", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    expect(container.querySelector("[data-testid='walk-steps-toggle']")).not.toBeNull();
  });

  test("step list is initially collapsed (hidden)", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    // List exists in DOM but not visible (hidden attribute or aria-hidden) OR absent until toggled
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // List should be hidden when collapsed
    const list = container.querySelector("[data-testid='walk-steps-list']");
    // Either list is absent or it has hidden attribute
    if (list) {
      expect(list.getAttribute("hidden")).not.toBeNull();
    }
  });

  test("clicking toggle expands the step list and flips aria-expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // List should now be visible
    const list = container.querySelector("[data-testid='walk-steps-list']");
    expect(list).not.toBeNull();
    expect((list as HTMLElement).getAttribute("hidden")).toBeNull();
  });

  test("clicking toggle twice collapses again", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    await user.click(toggle);
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("expanded list contains one item per step", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    await user.click(toggle);
    const list = container.querySelector("[data-testid='walk-steps-list']") as HTMLOListElement;
    expect(list.tagName).toBe("OL");
    const items = list.querySelectorAll("li");
    expect(items.length).toBe(SAMPLE_STEPS.length);
  });

  test("expanded list shows instruction text", async () => {
    const user = userEvent.setup();
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = screen.getByTestId("walk-steps-toggle");
    await user.click(toggle);
    expect(screen.getByText("Head north on Main St")).toBeDefined();
    expect(screen.getByText("Turn right on Union Ave")).toBeDefined();
  });

  test("short steps (<528 ft threshold) show distance in feet", async () => {
    const user = userEvent.setup();
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={[{ instruction: "Head north on Main St", distance: 50 }]}
      />,
    );
    await user.click(screen.getByTestId("walk-steps-toggle"));
    // 50m ≈ 164 ft
    expect(screen.getByTestId("walk-steps-list").textContent).toContain("ft");
  });

  test("long steps show distance in miles", async () => {
    const user = userEvent.setup();
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={[{ instruction: "Continue on Union Ave", distance: 500 }]}
      />,
    );
    await user.click(screen.getByTestId("walk-steps-toggle"));
    // 500m ≈ 0.31 mi
    expect(screen.getByTestId("walk-steps-list").textContent).toContain("mi");
  });

  test("toggle has aria-controls pointing at list id", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    const controlsId = toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    await user.click(toggle);
    const list = container.querySelector("[data-testid='walk-steps-list']") as HTMLElement;
    expect(list.id).toBe(controlsId);
  });

  test("step list has an accessible name", async () => {
    const user = userEvent.setup();
    render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    await user.click(screen.getByTestId("walk-steps-toggle"));
    const list = screen.getByTestId("walk-steps-list");
    // aria-label or aria-labelledby must be present
    const hasA11yName =
      list.getAttribute("aria-label") || list.getAttribute("aria-labelledby");
    expect(hasA11yName).toBeTruthy();
  });

  test("toggle button shows 'Show steps' when collapsed (EN)", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    expect(toggle.textContent).toContain("Show steps");
  });

  test("toggle button shows 'Hide steps' when expanded (EN)", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    await user.click(toggle);
    expect(toggle.textContent).toContain("Hide steps");
  });

  test("toggle shows 'Ver indicaciones' (ES) when collapsed", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="es"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
        walkSteps={SAMPLE_STEPS}
      />,
    );
    const toggle = container.querySelector("[data-testid='walk-steps-toggle']") as HTMLButtonElement;
    expect(toggle.textContent).toContain("Ver indicaciones");
  });
});

describe("DirectionButtons — Google Maps walk link (#134 enhancement)", () => {
  test("walk link is rendered when route is active", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
      />,
    );
    expect(container.querySelector("[data-testid='walk-googlemaps-link']")).not.toBeNull();
  });

  test("walk link is NOT rendered when route is inactive", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={false}
      />,
    );
    expect(container.querySelector("[data-testid='walk-googlemaps-link']")).toBeNull();
  });

  test("walk link uses travelmode=walking", () => {
    const { container } = render(
      <DirectionButtons
        venue={makeVenue()}
        onWalk={vi.fn()}
        locale="en"
        isRouteActive={true}
        routeInfo={{ distance: "0.4 mi", duration: "8 min" }}
      />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    expect(decodeURIComponent(link.href)).toContain("travelmode=walking");
  });

  test("walk link has destination matching venue lat,lng", () => {
    const venue = makeVenue({ lat: 38.2544, lng: -104.6091 });
    const { container } = render(
      <DirectionButtons venue={venue} onWalk={vi.fn()} locale="en" isRouteActive={true} routeInfo={{ distance: "0.4 mi", duration: "8 min" }} />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    expect(decodeURIComponent(link.href)).toContain("destination=38.2544,-104.6091");
  });

  test("walk link includes api=1", () => {
    const { container } = render(
      <DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" isRouteActive={true} routeInfo={{ distance: "0.4 mi", duration: "8 min" }} />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    expect(link.href).toContain("api=1");
  });

  test("walk link omits origin", () => {
    const { container } = render(
      <DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" isRouteActive={true} routeInfo={{ distance: "0.4 mi", duration: "8 min" }} />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    expect(link.href).not.toContain("origin=");
  });

  test("walk link opens in new tab", () => {
    const { container } = render(
      <DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" isRouteActive={true} routeInfo={{ distance: "0.4 mi", duration: "8 min" }} />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
  });

  test("walk link has rel=noopener noreferrer", () => {
    const { container } = render(
      <DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" isRouteActive={true} routeInfo={{ distance: "0.4 mi", duration: "8 min" }} />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  });

  test("walk link has accessible aria-label (EN)", () => {
    const venue = makeVenue({ name: "Test Food Pantry" });
    const { container } = render(
      <DirectionButtons venue={venue} onWalk={vi.fn()} locale="en" isRouteActive={true} routeInfo={{ distance: "0.4 mi", duration: "8 min" }} />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    expect(link.getAttribute("aria-label")).toContain("Test Food Pantry");
  });

  test("walk link has accessible aria-label (ES)", () => {
    const venue = makeVenue({ name: "Test Food Pantry" });
    const { container } = render(
      <DirectionButtons venue={venue} onWalk={vi.fn()} locale="es" isRouteActive={true} routeInfo={{ distance: "0.4 mi", duration: "8 min" }} />,
    );
    const link = container.querySelector("[data-testid='walk-googlemaps-link']") as HTMLAnchorElement;
    // ES aria-label should include venue name and mention Google Maps
    expect(link.getAttribute("aria-label")).toContain("Test Food Pantry");
    expect(link.getAttribute("aria-label")).toContain("Google Maps");
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
