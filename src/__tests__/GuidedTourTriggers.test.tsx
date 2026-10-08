/**
 * Guided tour triggers (#159): the splash's "Take a tour" button, the Menu's
 * "Learn how to use this map" item (on the map, and on the Menu pages via
 * /?tour=1), and MapWrapper actually starting — and ending — the tour.
 * MapWrapper mocking recipe is MapWrapperSplashHold.test.tsx's (see
 * MapWrapperDeferredLoad.test.tsx's header for the WHY of each mock).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import SplashScreen from "@/components/SplashScreen";
import HamburgerMenu from "@/components/HamburgerMenu";
import PageNav from "@/components/PageNav";
import MapWrapper from "@/components/MapWrapper";
import * as LocaleContext from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { TOUR_COPY } from "@/lib/guidedTour";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/about",
}));

vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => true }));

vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { ResolvedComponent = mod.default; });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    return DynamicWrapper;
  },
}));

vi.mock("@/components/Map", () => ({ default: () => null }));
vi.mock("@/components/DesktopVenueWindow", () => ({ default: () => null }));

beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  push.mockReset();
  vi.restoreAllMocks();
});

describe("Splash — Take a tour", () => {
  function renderSplash(locale: "en" | "es", onTour = vi.fn()) {
    vi.spyOn(LocaleContext, "useLocale").mockReturnValue({ locale, setLocale: vi.fn() });
    render(<SplashScreen onPrimary={vi.fn()} onTour={onTour} />);
    return onTour;
  }

  test("shows the button and calls onTour when tapped", () => {
    const onTour = renderSplash("en");
    fireEvent.click(screen.getByRole("button", { name: t("splash.tour", "en") }));
    expect(onTour).toHaveBeenCalledTimes(1);
  });

  test("Spanish label in ES", () => {
    renderSplash("es");
    expect(screen.getByRole("button", { name: t("splash.tour", "es") })).toBeTruthy();
  });

  test("no button when no onTour handler is given", () => {
    vi.spyOn(LocaleContext, "useLocale").mockReturnValue({ locale: "en", setLocale: vi.fn() });
    render(<SplashScreen onPrimary={vi.fn()} />);
    expect(screen.queryByRole("button", { name: t("splash.tour", "en") })).toBeNull();
  });
});

describe("Menu — Learn how to use this map", () => {
  test("closes the menu and starts the tour", () => {
    const onClose = vi.fn();
    const onStartTour = vi.fn();
    render(<HamburgerMenu locale="en" open onClose={onClose} onStartTour={onStartTour} />);
    fireEvent.click(screen.getByRole("button", { name: t("menu.tour", "en") }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onStartTour).toHaveBeenCalledTimes(1);
  });

  test("hidden when no onStartTour handler is given", () => {
    render(<HamburgerMenu locale="en" open onClose={vi.fn()} />);
    expect(screen.queryByRole("menuitem", { name: t("menu.tour", "en") })).toBeNull();
  });

  test("on a Menu page (PageNav) it goes to the map with ?tour=1", () => {
    render(<PageNav locale="en" />);
    fireEvent.click(screen.getByTestId("nav-top"));
    fireEvent.click(screen.getByRole("button", { name: t("menu.tour", "en") }));
    expect(push).toHaveBeenCalledWith("/?tour=1");
  });
});

describe("MapWrapper — starting and ending the tour", () => {
  async function flushDynamic() {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }

  test("tourRequestId (splash / ?tour=1) opens the tour", async () => {
    const { rerender } = render(
      <LocaleContext.LocaleProvider initialLocale="en">
        <MapWrapper />
      </LocaleContext.LocaleProvider>,
    );
    await flushDynamic();
    expect(screen.queryByTestId("guided-tour")).toBeNull();
    rerender(
      <LocaleContext.LocaleProvider initialLocale="en">
        <MapWrapper tourRequestId={1} />
      </LocaleContext.LocaleProvider>,
    );
    await flushDynamic();
    await waitFor(() => expect(screen.getByTestId("guided-tour")).toBeTruthy());
    expect(screen.getByRole("heading", { name: TOUR_COPY.en.steps.welcome.title })).toBeTruthy();
  });

  test("the Menu item opens the tour; Escape ends it and focus returns to the Menu button", async () => {
    render(
      <LocaleContext.LocaleProvider initialLocale="en">
        <MapWrapper />
      </LocaleContext.LocaleProvider>,
    );
    await flushDynamic();
    fireEvent.click(screen.getByTestId("nav-top"));
    fireEvent.click(screen.getByRole("button", { name: t("menu.tour", "en") }));
    await flushDynamic();
    await waitFor(() => expect(screen.getByTestId("guided-tour")).toBeTruthy());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("nav-top")));
  });
});
