/**
 * Guided tour live demos (#159 follow-up) through the real MapWrapper: the
 * search step's typing demo and the filters step's open panel must leave the
 * map exactly as the visitor had it, never focus the search input (phone
 * keyboard), never send the demo word as a search, and let Escape close the
 * tour rather than only the panel. Mock recipe: GuidedTourTriggers.test.tsx.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import * as LocaleContext from "@/lib/LocaleContext";
import { TOUR_COPY, TOUR_STEPS } from "@/lib/guidedTour";
import { track, EVENTS } from "@/lib/analytics";
import { t } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
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
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

const EN = TOUR_COPY.en;
const searchIndex = TOUR_STEPS.findIndex((s) => s.demo === "search");
const filtersIndex = TOUR_STEPS.findIndex((s) => s.demo === "filters");

/** `reduce` also stands for "phone": the shared matchMedia mock answers every query alike. */
function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  setMatchMedia(true);
  vi.mocked(track).mockClear();
});
afterEach(() => vi.useRealTimers());

async function flushDynamic() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const input = () => screen.getByTestId("search-input") as HTMLInputElement;
const filterPanel = () => document.querySelector('[aria-labelledby="filter-panel-title"]');

/** The visitor types their own search (the real input path), leaves the box, then starts the tour. */
async function renderWithOwnSearchThenTour(own = "garden", before?: () => void) {
  const { rerender } = render(
    <LocaleContext.LocaleProvider initialLocale="en">
      <MapWrapper />
    </LocaleContext.LocaleProvider>,
  );
  await flushDynamic();
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value: own } });
  fireEvent.blur(input());
  before?.();
  rerender(
    <LocaleContext.LocaleProvider initialLocale="en">
      <MapWrapper tourRequestId={1} />
    </LocaleContext.LocaleProvider>,
  );
  await flushDynamic();
  await waitFor(() => expect(screen.getByTestId("guided-tour")).toBeTruthy());
}

function next(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole("button", { name: EN.next }));
}

describe("search step — typing demo", () => {
  test("shows the sample word with its results, input never focused; leaving puts the visitor's search back", async () => {
    await renderWithOwnSearchThenTour();
    next(searchIndex);
    await waitFor(() => expect(input().value).toBe(EN.searchWord));
    expect(document.getElementById("search-results-listbox")).toBeTruthy();
    expect(document.activeElement).not.toBe(input());

    // Next: the visitor's own search is back, results closed.
    next();
    await waitFor(() => expect(input().value).toBe("garden"));
    expect(document.getElementById("search-results-listbox")).toBeNull();

    // Back onto it types again; Skip from there restores again.
    fireEvent.click(screen.getByRole("button", { name: EN.back }));
    await waitFor(() => expect(input().value).toBe(EN.searchWord));
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    expect(input().value).toBe("garden");
    expect(document.getElementById("search-results-listbox")).toBeNull();
  });

  test("letter-by-letter without reduced motion, ended by Escape mid-typing", async () => {
    setMatchMedia(false);
    await renderWithOwnSearchThenTour();
    next(searchIndex);
    await waitFor(() => expect(input().value.length).toBeGreaterThan(0));
    expect(input().value.length).toBeLessThan(EN.searchWord.length);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    expect(input().value).toBe("garden");
  });

  test("the demo word is never sent as a visitor's search", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    await renderWithOwnSearchThenTour();
    vi.mocked(track).mockClear(); // the visitor's own "garden" may already be sent
    next(searchIndex);
    await waitFor(() => expect(input().value).toBe(EN.searchWord));
    act(() => vi.advanceTimersByTime(5000));
    const sentTerms = () =>
      vi.mocked(track).mock.calls
        .filter(([event]) => event === EVENTS.SEARCH_USED)
        .map(([, props]) => (props as { term: string }).term);
    expect(sentTerms()).not.toContain(EN.searchWord);

    // After the tour, the visitor's own searches are sent again (the pause
    // must not outlive the tour). The idle timer path, no blur: SEARCH_TRACK_IDLE_MS is 2 s.
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    fireEvent.change(input(), { target: { value: "bread" } });
    act(() => vi.advanceTimersByTime(2100));
    expect(sentTerms()).toContain("bread");
  });
});

describe("filters step — the real panel, open", () => {
  test("opens the panel without applying a filter or taking focus; leaving closes it", async () => {
    await renderWithOwnSearchThenTour();
    const filtersLabel = screen.getByTestId("filters-button").getAttribute("aria-label");
    next(filtersIndex);
    await waitFor(() => expect(filterPanel()).toBeTruthy());
    const tourDialog = screen.getByRole("dialog", { name: EN.dialogLabel });
    expect(tourDialog.contains(document.activeElement)).toBe(true);
    // One modal dialog at a time: the held-open panel is not aria-modal, and
    // nothing hides the tour's tooltip from assistive tech.
    expect(filterPanel()!.getAttribute("aria-modal")).toBeNull();
    expect(tourDialog.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getAllByRole("switch").every((s) => s.getAttribute("aria-checked") === "false")).toBe(true);
    // Tab still moves within the tour (Next wraps to Skip) — the panel's own
    // Tab trap must not pull focus into the panel.
    const nextButton = screen.getByRole("button", { name: EN.next });
    act(() => nextButton.focus());
    fireEvent.keyDown(nextButton, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: EN.skip }));

    next();
    await waitFor(() => expect(filterPanel()).toBeNull());
    // Same label = same (zero) active-filter count as before the tour.
    expect(screen.getByTestId("filters-button").getAttribute("aria-label")).toBe(filtersLabel);

    // After the tour the panel is its normal modal self again: focus moves in.
    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    fireEvent.click(screen.getByTestId("filters-button"));
    await waitFor(() => expect(filterPanel()).toBeTruthy());
    expect(filterPanel()!.getAttribute("aria-modal")).toBe("true");
    expect(filterPanel()!.contains(document.activeElement)).toBe(true);
  });

  test("the visitor's filters are lifted for the tour and handed back after Skip", async () => {
    const activeLabel = t("filters.button.labelActive", "en", { count: "3" });
    // The visitor turns filters on through the real panel: switches plus a
    // non-pantry kind of place, so without lifting them "pantry" finds nothing.
    await renderWithOwnSearchThenTour("", () => {
      fireEvent.click(screen.getByTestId("filters-button"));
      fireEvent.click(screen.getByRole("switch", { name: t("filter.openNow", "en") }));
      fireEvent.click(screen.getByRole("switch", { name: t("filter.wic", "en") }));
      fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(t("category.full.garden", "en")) }));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByTestId("filters-button").getAttribute("aria-label")).toBe(activeLabel);
    });
    // The tour has started and lifted them.
    expect(screen.getByTestId("filters-button").getAttribute("aria-label")).not.toBe(activeLabel);

    next(searchIndex);
    await waitFor(() => expect(input().value).toBe(EN.searchWord));
    expect(document.getElementById("search-results-listbox")).toBeTruthy();
    next();
    await waitFor(() => expect(filterPanel()).toBeTruthy());
    expect(
      [...filterPanel()!.querySelectorAll('[role="switch"], input[type="checkbox"]')].some(
        (el) => el.getAttribute("aria-checked") === "true" || (el as HTMLInputElement).checked,
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: EN.skip }));
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    expect(screen.getByTestId("filters-button").getAttribute("aria-label")).toBe(activeLabel);
  });

  test.each([
    { name: "desktop", phone: false },
    { name: "phone", phone: true },
  ])("$name: Escape closes the tour, not only the panel, and the map is back as it was", async ({ phone }) => {
    setMatchMedia(phone);
    await renderWithOwnSearchThenTour();
    next(filtersIndex);
    await waitFor(() => expect(filterPanel()).toBeTruthy());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("guided-tour")).toBeNull());
    expect(filterPanel()).toBeNull();
    expect(input().value).toBe("garden");
  });
});
