/**
 * PageNav — the bottom nav + drawer on the pages the Menu opens (Kyle, 2026-09-16).
 * DOM queries for the drawer: it is portal-free but role="menu" sits on its <ul>.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PageNav from "@/components/PageNav";
import { addFavorite, removeFavorite } from "@/lib/favorites";
import { venues } from "@/data/venues";

const push = vi.fn();
let pathname = "/about";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  push.mockReset();
  pathname = "/about";
  localStorage.removeItem("pfm.favorites.v1");
});

describe("PageNav", () => {
  test("keeps Back to map and adds the bottom nav", () => {
    render(<PageNav locale="en" />);
    expect(screen.getByRole("link", { name: /Back to map/ }).getAttribute("href")).toBe("/");
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });

  test("backHref overrides the default '/' destination (BoxHistoryContent points it at ?venue=<id>)", () => {
    render(<PageNav locale="en" backHref="/?venue=box-1" />);
    expect(screen.getByRole("link", { name: /Back to map/ }).getAttribute("href")).toBe("/?venue=box-1");
  });

  test("the top 'Back to map' nav has its own aria-label, distinct from BottomNav's 'Main' (review item 7c)", () => {
    render(<PageNav locale="en" />);
    expect(screen.getByRole("navigation", { name: "Page" })).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeDefined();
  });

  test("Menu opens the drawer over the page, and tapping Menu again closes it", () => {
    render(<PageNav locale="en" />);
    expect(document.getElementById("hamburger-panel")).toBeNull();
    fireEvent.click(screen.getByTestId("nav-top"));
    expect(document.getElementById("hamburger-panel")).not.toBeNull();
    expect(screen.getByText("Suggest a place")).toBeDefined();
    fireEvent.click(screen.getByTestId("nav-top"));
    expect(document.getElementById("hamburger-panel")).toBeNull();
  });

  test("Saved opens the saved view in place", () => {
    render(<PageNav locale="en" />);
    fireEvent.click(screen.getByTestId("nav-saved"));
    expect(screen.getByText(/No saved places yet/i)).toBeDefined();
  });

  test("selecting a saved place pushes /?venue=<encoded id>", () => {
    const venue = venues[0];
    addFavorite(venue.id);
    try {
      render(<PageNav locale="en" />);
      fireEvent.click(screen.getByTestId("nav-saved"));
      fireEvent.click(screen.getByText(venue.name));
      expect(push).toHaveBeenCalledWith(`/?venue=${encodeURIComponent(venue.id)}`);
    } finally {
      // favorites.ts caches its snapshot at module scope — undo so later
      // tests in this file see the empty list beforeEach expects.
      removeFavorite(venue.id);
    }
  });

  test("Near me goes to the map, locating", () => {
    render(<PageNav locale="en" />);
    fireEvent.click(screen.getByTestId("nav-near-me"));
    expect(push).toHaveBeenCalledWith("/?near=1");
  });

  // #516: off the map there's no filter state to reflect, so Boxes just
  // hands off to the map via /?boxes=1 — same shape as Near me above.
  test("Boxes (#516) goes to the map, filtered", () => {
    render(<PageNav locale="en" />);
    const btn = screen.getByTestId("nav-boxes") as HTMLButtonElement;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(push).toHaveBeenCalledWith("/?boxes=1");
  });

  test("Resources shows as current only on /resources", () => {
    const { unmount } = render(<PageNav locale="en" />);
    expect(screen.getByTestId("nav-resources").getAttribute("aria-current")).toBeNull();
    unmount();
    pathname = "/resources";
    render(<PageNav locale="en" />);
    expect(screen.getByTestId("nav-resources").getAttribute("aria-current")).toBe("page");
  });

  test("no 'Show welcome screen' off the map", () => {
    render(<PageNav locale="en" />);
    fireEvent.click(screen.getByTestId("nav-top"));
    expect(screen.queryByText(/Show welcome screen/i)).toBeNull();
  });

  test("ES", () => {
    render(<PageNav locale="es" />);
    expect(screen.getByRole("link", { name: /Volver al mapa/ })).toBeDefined();
  });
});
