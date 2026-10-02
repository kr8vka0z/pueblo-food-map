/**
 * SplashScreen — near_me_clicked source and failed-location handling (#738).
 *
 * The splash CTA fired no named event, so the dashboard undercounted "Find
 * food near me" taps; and a timeout/unavailable failure must not short-circuit
 * a later tap the way a real refusal does.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SplashScreen from "@/components/SplashScreen";
import * as LocaleContext from "@/lib/LocaleContext";
import { track, EVENTS } from "@/lib/analytics";

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

const request = vi.fn();
let geoState: unknown;
vi.mock("@/lib/useGeolocation", () => ({
  useGeolocation: () => ({ state: geoState, request }),
}));

beforeEach(() => {
  vi.mocked(track).mockClear();
  request.mockClear();
  geoState = { permission: "prompt", position: null };
  vi.spyOn(LocaleContext, "useLocale").mockReturnValue({
    locale: "en",
    setLocale: vi.fn(),
    tree: "en",
  });
});

describe("splash CTA analytics", () => {
  test.each(["en", "es"])("the %s button fires near_me_clicked with source splash", (lang) => {
    const { container } = render(<SplashScreen onPrimary={vi.fn()} />);
    fireEvent.click(container.querySelector(`button[lang="${lang}"]`)!);
    expect(track).toHaveBeenCalledWith(EVENTS.NEAR_ME_CLICKED, { source: "splash" });
    expect(track).toHaveBeenCalledTimes(1);
  });
});

describe("splash after a location failure", () => {
  test("a failed (timeout) state tries again instead of falling back", () => {
    geoState = { permission: "failed", position: null, reason: "timeout" };
    const onPrimary = vi.fn();
    render(<SplashScreen onPrimary={onPrimary} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("a real refusal still goes straight to the Pueblo-center fallback", () => {
    geoState = { permission: "denied", position: null };
    const onPrimary = vi.fn();
    render(<SplashScreen onPrimary={onPrimary} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onPrimary).toHaveBeenCalledWith("pueblo-center");
    expect(request).not.toHaveBeenCalled();
  });

  test("after a request, a failed result falls back to Pueblo-center", () => {
    const onPrimary = vi.fn();
    const { rerender } = render(<SplashScreen onPrimary={onPrimary} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    geoState = { permission: "failed", position: null, reason: "unavailable" };
    rerender(<SplashScreen onPrimary={onPrimary} />);
    expect(onPrimary).toHaveBeenCalledWith("pueblo-center");
  });
});
