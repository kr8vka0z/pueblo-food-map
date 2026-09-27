/**
 * Component tests for FavoriteButton (#132).
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FavoriteButton from "@/components/FavoriteButton";
import { __resetFavoritesForTests } from "@/lib/favorites";
import { track, EVENTS } from "@/lib/analytics";

// #485 PR 2: mock the whole module so EVENTS keeps its real allowlist values.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

beforeEach(() => {
  __resetFavoritesForTests();
  vi.mocked(track).mockClear();
});

describe("FavoriteButton", () => {
  test("initially has aria-pressed=false and accessible name for add", () => {
    render(<FavoriteButton venueId="v1" venueName="Test Pantry" />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-label")).toMatch(/add test pantry to saved/i);
  });

  test("after click has aria-pressed=true and accessible name for remove", async () => {
    const user = userEvent.setup();
    render(<FavoriteButton venueId="v1" venueName="Test Pantry" />);
    const btn = screen.getByRole("button");
    await user.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.getAttribute("aria-label")).toMatch(/remove test pantry from saved/i);
  });

  test("after second click returns to aria-pressed=false", async () => {
    const user = userEvent.setup();
    render(<FavoriteButton venueId="v1" venueName="Test Pantry" />);
    const btn = screen.getByRole("button");
    await user.click(btn);
    await user.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  test("adding a favorite fires favorite_added", async () => {
    const user = userEvent.setup();
    render(<FavoriteButton venueId="v1" venueName="Test Pantry" />);
    await user.click(screen.getByRole("button"));
    expect(track).toHaveBeenCalledWith(EVENTS.FAVORITE_ADDED, { venueId: "v1" });
  });

  test("removing a favorite does NOT fire favorite_added again", async () => {
    const user = userEvent.setup();
    render(<FavoriteButton venueId="v1" venueName="Test Pantry" />);
    const btn = screen.getByRole("button");
    await user.click(btn); // add
    vi.mocked(track).mockClear();
    await user.click(btn); // remove
    expect(track).not.toHaveBeenCalled();
  });
});
