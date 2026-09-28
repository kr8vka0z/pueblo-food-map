/**
 * LanguageToggle — mirrored-page link behavior (#689 PR 2, design decision
 * 8). The sibling suite (LanguageToggle.test.tsx) covers the unchanged
 * button behavior with usePathname() at its jsdom default (null, matching
 * no route mock — see that file); this one re-mocks next/navigation the
 * same way AlertsConfirmContent.test.tsx does to exercise a real mirrored
 * pathname.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let pathnameValue = "/venues";
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameValue,
}));

// #485 PR 2: mock analytics the same way the sibling suite does.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

import { LocaleProvider } from "@/lib/LocaleContext";
import LanguageToggle from "@/components/LanguageToggle";

function renderWithProvider(initialLocale?: "en" | "es") {
  return render(
    <LocaleProvider initialLocale={initialLocale}>
      <LanguageToggle />
    </LocaleProvider>,
  );
}

describe("LanguageToggle on a mirrored EN page (/venues)", () => {
  test("the ES segment is a real link to /es/venues; the EN segment stays a button", () => {
    pathnameValue = "/venues";
    renderWithProvider(); // tree "en" (no initialLocale)

    const esLink = screen.getByRole("link", { name: /spanish/i });
    expect(esLink.getAttribute("href")).toBe("/es/venues");

    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(enBtn.tagName).toBe("BUTTON");
  });
});

describe("LanguageToggle on a mirrored ES page (/es/about)", () => {
  test("the EN segment is a real link to /about; the ES segment stays a button", () => {
    pathnameValue = "/es/about";
    renderWithProvider("es"); // tree "es"

    const enLink = screen.getByRole("link", { name: /english/i });
    expect(enLink.getAttribute("href")).toBe("/about");

    const esBtn = screen.getByRole("button", { name: /spanish/i });
    expect(esBtn.tagName).toBe("BUTTON");
  });
});

describe("LanguageToggle on a non-mirrored page (/suggest)", () => {
  test("both segments stay buttons — unchanged from pre-#689 behavior", () => {
    pathnameValue = "/suggest";
    renderWithProvider();

    expect(screen.getByRole("button", { name: /english/i }).tagName).toBe("BUTTON");
    expect(screen.getByRole("button", { name: /spanish/i }).tagName).toBe("BUTTON");
    expect(screen.queryByRole("link")).toBeNull();
  });
});

// Review fix (item 2): a plain href on the mirrored-page link can't carry
// the CURRENT page's query/hash (mirroredCounterpartHref never sees them —
// see its own header) — onClick must append them via location.assign, or a
// tap from e.g. "/?venue=<id>" silently drops that state crossing trees.
describe("LanguageToggle mirrored link preserves query/hash on click", () => {
  let assign: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;

  beforeEach(() => {
    assign = vi.fn();
    // jsdom's window.location isn't directly writable — replace it with a
    // mock carrying the fields this component reads/calls.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        search: "?venue=abc-123",
        hash: "#panel=open",
        assign,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  test("clicking the mirrored ES link navigates to the counterpart href PLUS the current query and hash", () => {
    pathnameValue = "/venues";
    renderWithProvider();

    const esLink = screen.getByRole("link", { name: /spanish/i });
    // href itself stays the bare pathname (no-JS / crawler fallback).
    expect(esLink.getAttribute("href")).toBe("/es/venues");

    fireEvent.click(esLink);
    expect(assign).toHaveBeenCalledWith("/es/venues?venue=abc-123#panel=open");
  });

  test("clicking the mirrored EN link (from the ES tree) also preserves query and hash", () => {
    pathnameValue = "/es/about";
    renderWithProvider("es");

    const enLink = screen.getByRole("link", { name: /english/i });
    expect(enLink.getAttribute("href")).toBe("/about");

    fireEvent.click(enLink);
    expect(assign).toHaveBeenCalledWith("/about?venue=abc-123#panel=open");
  });
});
