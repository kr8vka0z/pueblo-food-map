/**
 * LocationHelpCard (#739, mockup option B) — the two messages, both failure
 * reasons, EN/ES, the buttons each message offers, and Escape/overlay rules.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LocationHelpCard from "@/components/LocationHelpCard";
import { useOverlayRegistration } from "@/lib/overlayRegistry";
import type { LocationFailure } from "@/lib/useGeolocation";

const DENIED: LocationFailure = { permission: "denied", position: null };
const TIMEOUT: LocationFailure = { permission: "failed", position: null, reason: "timeout" };
const UNAVAILABLE: LocationFailure = { permission: "failed", position: null, reason: "unavailable" };

function setup(failure: LocationFailure, locale: "en" | "es" = "en") {
  const handlers = { onRetry: vi.fn(), onShowList: vi.fn(), onDismiss: vi.fn() };
  const view = render(<LocationHelpCard failure={failure} locale={locale} {...handlers} />);
  return { ...handlers, ...view };
}

describe("denied", () => {
  test("EN: title, body, list button, settings hint; no Try again", () => {
    setup(DENIED);
    expect(screen.getByRole("heading", { name: "Location is off" })).toBeTruthy();
    expect(
      screen.getByText(
        "No problem, you can still find food. Tap any pin on the map to see hours and directions.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "See all places as a list" })).toBeTruthy();
    expect(
      screen.getByText("To use your location next time, turn it on in your browser or phone settings."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  test("ES", () => {
    setup(DENIED, "es");
    expect(screen.getByRole("heading", { name: "Ubicación desactivada" })).toBeTruthy();
    expect(screen.getByText(/No hay problema, aún puedes encontrar comida\. Toca cualquier punto/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /intentar de nuevo/i })).toBeNull();
  });
});

describe("failed", () => {
  test("EN timeout: title, body, Try again + list; no settings hint", () => {
    setup(TIMEOUT);
    expect(screen.getByRole("heading", { name: "We couldn't find you" })).toBeTruthy();
    expect(
      screen.getByText(
        "Your phone took too long to find where you are. This happens a lot indoors. Tap any pin on the map to see hours and directions.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "See all places as a list" })).toBeTruthy();
    expect(screen.queryByText(/turn it on in your browser/)).toBeNull();
  });

  test("EN unavailable uses its own body", () => {
    setup(UNAVAILABLE);
    expect(
      screen.getByText(
        "Your phone couldn't work out where you are right now. Tap any pin on the map to see hours and directions.",
      ),
    ).toBeTruthy();
  });

  test("ES timeout and unavailable", () => {
    const first = setup(TIMEOUT, "es");
    expect(screen.getByRole("heading", { name: "No pudimos encontrarte" })).toBeTruthy();
    expect(screen.getByText(/tardó demasiado/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Intentar de nuevo" })).toBeTruthy();
    first.unmount();
    setup(UNAVAILABLE, "es");
    expect(screen.getByText(/no pudo saber dónde estás/)).toBeTruthy();
  });
});

describe("actions", () => {
  test("Try again, list and close call their handlers", () => {
    const h = setup(TIMEOUT);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "See all places as a list" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(h.onRetry).toHaveBeenCalledTimes(1);
    expect(h.onShowList).toHaveBeenCalledTimes(1);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test("Escape dismisses", () => {
    const h = setup(DENIED);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test("announces politely and does not take focus", () => {
    setup(DENIED);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });

  test("hides while a full-surface overlay is open", () => {
    function Harness() {
      useOverlayRegistration(true);
      return <LocationHelpCard failure={DENIED} onRetry={vi.fn()} onShowList={vi.fn()} onDismiss={vi.fn()} />;
    }
    render(<Harness />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
