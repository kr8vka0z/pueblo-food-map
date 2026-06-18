/**
 * Tests for the four hardcoded English strings that leaked in ES mode.
 *
 * Each test is written BEFORE the fix (TDD), verifying the expected i18n
 * behavior that will be correct after the fix. Tests confirm:
 *   1. MapWrapper map-loading fallback renders ES text when locale=es
 *   2. LanguageToggle aria-label on the group uses i18n (EN and ES)
 *   3. CategoryChips group aria-label uses i18n (EN and ES)
 *   4. SuggestForm SNAP/WIC fieldset has a non-empty translated legend
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";

// ─── 1. MapWrapper — loading fallback locale ──────────────────────────────────
// The map-loading div renders before the dynamic import resolves.
// It must show "Cargando mapa…" in ES, not hardcoded "Loading map…".

import MapLoadingFallback from "@/components/MapLoadingFallback";

describe("MapLoadingFallback locale", () => {
  test("renders EN loading text by default", () => {
    const { container } = render(<MapLoadingFallback locale="en" />);
    expect(container.textContent).toContain(t("map.loading", "en"));
  });

  test("renders ES loading text when locale=es", () => {
    const { container } = render(<MapLoadingFallback locale="es" />);
    expect(container.textContent).toContain(t("map.loading", "es"));
    // Must NOT contain hardcoded English
    expect(container.textContent).not.toContain("Loading map");
  });

  test("EN key is 'Loading map…'", () => {
    expect(t("map.loading", "en")).toBe("Loading map…");
  });

  test("ES key differs from EN", () => {
    expect(t("map.loading", "es")).not.toBe(t("map.loading", "en"));
  });
});

// ─── 2. LanguageToggle — group aria-label uses i18n ──────────────────────────

import LanguageToggle from "@/components/LanguageToggle";

describe("LanguageToggle group aria-label", () => {
  test("EN: group aria-label matches i18n key 'lang.toggle.label'", () => {
    render(
      <LocaleProvider initialLocale="en">
        <LanguageToggle />
      </LocaleProvider>,
    );
    // The aria-label must use t("lang.toggle.label", "en")
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBe(t("lang.toggle.label", "en"));
  });

  test("ES: group aria-label is in Spanish (not 'Language selection')", () => {
    render(
      <LocaleProvider initialLocale="es">
        <LanguageToggle />
      </LocaleProvider>,
    );
    const group = screen.getByRole("group");
    const label = group.getAttribute("aria-label") ?? "";
    expect(label).not.toBe("Language selection");
    expect(label).toBe(t("lang.toggle.label", "es"));
  });

  test("i18n key 'lang.toggle.label' EN value is 'Language selection'", () => {
    expect(t("lang.toggle.label", "en")).toBe("Language selection");
  });

  test("i18n key 'lang.toggle.label' ES value differs from EN", () => {
    expect(t("lang.toggle.label", "es")).not.toBe(t("lang.toggle.label", "en"));
  });
});

// ─── 3. CategoryChips — group aria-label uses i18n ───────────────────────────

import CategoryChips from "@/components/CategoryChips";

const SAMPLE_COUNTS = { pantry: 10, grocery: 5 };

describe("CategoryChips group aria-label", () => {
  test("EN: group aria-label matches i18n key 'chips.filterByCategory'", () => {
    const { container } = render(
      <CategoryChips
        selected={null}
        counts={SAMPLE_COUNTS}
        totalCount={15}
        onToggle={vi.fn()}
        locale="en"
      />,
    );
    const group = container.querySelector("[role='group']");
    expect(group).not.toBeNull();
    expect(group!.getAttribute("aria-label")).toBe(t("chips.filterByCategory", "en"));
  });

  test("ES: group aria-label is in Spanish (not 'Filter by category')", () => {
    const { container } = render(
      <CategoryChips
        selected={null}
        counts={SAMPLE_COUNTS}
        totalCount={15}
        onToggle={vi.fn()}
        locale="es"
      />,
    );
    const group = container.querySelector("[role='group']");
    expect(group).not.toBeNull();
    const label = group!.getAttribute("aria-label") ?? "";
    expect(label).not.toBe("Filter by category");
    expect(label).toBe(t("chips.filterByCategory", "es"));
  });

  test("i18n key 'chips.filterByCategory' EN value is 'Filter by category'", () => {
    expect(t("chips.filterByCategory", "en")).toBe("Filter by category");
  });

  test("i18n key 'chips.filterByCategory' ES value differs from EN", () => {
    expect(t("chips.filterByCategory", "es")).not.toBe(t("chips.filterByCategory", "en"));
  });
});

// ─── 4. SuggestForm — SNAP/WIC fieldset legend is non-empty and translated ────
// WCAG 1.3.1: a <fieldset> must have a non-empty <legend> text node.
// Before the fix, the legend element exists but contains only a comment.

import SuggestForm from "@/components/SuggestForm";

// Mock turnstile to avoid unhandled setup errors
const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-token");
    return "widget-id";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

vi.stubGlobal("turnstile", mockTurnstile);
vi.stubGlobal("fetch", vi.fn());

describe("SuggestForm SNAP/WIC fieldset legend", () => {
  test("EN: fieldset legend has non-empty text content", () => {
    const { container } = render(<SuggestForm locale="en" />);
    const legend = container.querySelector("fieldset legend");
    expect(legend).not.toBeNull();
    expect((legend!.textContent ?? "").trim().length).toBeGreaterThan(0);
  });

  test("ES: fieldset legend has non-empty text content in Spanish", () => {
    const { container } = render(<SuggestForm locale="es" />);
    const legend = container.querySelector("fieldset legend");
    expect(legend).not.toBeNull();
    const text = (legend!.textContent ?? "").trim();
    expect(text.length).toBeGreaterThan(0);
    // Must use the ES key, not the EN key
    expect(text).toBe(t("suggest.benefits.legend", "es"));
  });

  test("EN: fieldset legend uses i18n key 'suggest.benefits.legend'", () => {
    const { container } = render(<SuggestForm locale="en" />);
    const legend = container.querySelector("fieldset legend");
    expect((legend!.textContent ?? "").trim()).toBe(t("suggest.benefits.legend", "en"));
  });

  test("i18n key 'suggest.benefits.legend' EN value is 'Accepted benefits'", () => {
    expect(t("suggest.benefits.legend", "en")).toBe("Accepted benefits");
  });

  test("i18n key 'suggest.benefits.legend' ES value differs from EN", () => {
    expect(t("suggest.benefits.legend", "es")).not.toBe(t("suggest.benefits.legend", "en"));
  });
});
