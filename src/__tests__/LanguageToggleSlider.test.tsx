/**
 * #917 round 3: the language switch is the design system's two-way slider.
 * Kyle saw "en" and "es" move up and down: on a mirrored page one segment is
 * an <a> and the other a <button>, and the <a> wasn't laid out like the
 * button. Pinned here: both segments draw the same box; the thumb sits under
 * the page's language; on a mirrored page it moves to the tapped word at
 * once (so it slides while the next page loads) and comes back if the page
 * is restored from the back/forward cache.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

let pathnameValue = "/venues";
vi.mock("next/navigation", () => ({ usePathname: () => pathnameValue }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

import { LocaleProvider } from "@/lib/LocaleContext";
import LanguageToggle from "@/components/LanguageToggle";

const thumb = () => screen.getByRole("group").querySelector("span[aria-hidden]")!;
const layout = (el: Element) =>
  el.className
    .split(/\s+/)
    .filter((c) => !c.startsWith("text-[") && !c.startsWith("hover:"))
    .sort()
    .join(" ");

const originalLocation = window.location;
beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, search: "", hash: "", assign: vi.fn() },
  });
});
afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("LanguageToggle slider", () => {
  test("on a mirrored page the link and the button draw the same box", () => {
    pathnameValue = "/venues";
    render(<LocaleProvider><LanguageToggle /></LocaleProvider>);
    const link = screen.getByRole("link", { name: "Language: Spanish" });
    const button = screen.getByRole("button", { name: "Language: English" });
    expect(layout(link)).toBe(layout(button));
    expect(link.className).toContain("inline-flex");
    expect(link.className).toContain("leading-5");
  });

  test("the thumb sits under the page's language", () => {
    pathnameValue = "/venues";
    render(<LocaleProvider initialLocale="es"><LanguageToggle /></LocaleProvider>);
    expect(thumb().className).toContain("translate-x-[48px]");
    expect(thumb().className).toContain("duration-250");
    expect(thumb().className).toContain("ease-out-circ");
  });

  test("tapping the mirrored link moves the thumb at once; a back/forward-cache return puts it back", () => {
    pathnameValue = "/venues";
    render(<LocaleProvider><LanguageToggle /></LocaleProvider>);
    expect(thumb().className).toContain("translate-x-0");

    fireEvent.click(screen.getByRole("link", { name: "Language: Spanish" }));
    expect(window.location.assign).toHaveBeenCalled();
    expect(thumb().className).toContain("translate-x-[48px]");
    // The page's language is still English until the next page loads.
    expect(screen.getByRole("button", { name: "Language: English" }).getAttribute("aria-pressed")).toBe("true");

    act(() => {
      const e = new Event("pageshow") as PageTransitionEvent;
      Object.defineProperty(e, "persisted", { value: true });
      window.dispatchEvent(e);
    });
    expect(thumb().className).toContain("translate-x-0");
  });
});
