/**
 * Component tests for FavoriteButton (#132).
 */

import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FavoriteButton from "@/components/FavoriteButton";
import { __resetFavoritesForTests } from "@/lib/favorites";

beforeEach(() => {
  __resetFavoritesForTests();
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
});
