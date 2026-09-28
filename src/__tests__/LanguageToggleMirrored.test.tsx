/**
 * LanguageToggle — mirrored-page link behavior (#689 PR 2, design decision
 * 8). The sibling suite (LanguageToggle.test.tsx) covers the unchanged
 * button behavior with usePathname() at its jsdom default (null, matching
 * no route mock — see that file); this one re-mocks next/navigation the
 * same way AlertsConfirmContent.test.tsx does to exercise a real mirrored
 * pathname.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
