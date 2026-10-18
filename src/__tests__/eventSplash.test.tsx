/**
 * eventSplash.test.tsx — a shared event link (?event=<id>) skips the first-visit
 * splash the same way ?venue= does (#759). Kept beside, not inside,
 * splashSsr.test.tsx (which owns the other URL cases): the inline script and
 * shouldSkipSplash() are hand-mirrored, so the event cases are checked against
 * BOTH here.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import HomePageClient from "@/app/(site)/HomePageClient";
import { SPLASH_GATE_SCRIPT, SPLASH_SEEN_ATTR, shouldSkipSplash } from "@/lib/splashGate";

vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { ResolvedComponent = mod.default; });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    DynamicWrapper.displayName = "DynamicWrapper";
    return DynamicWrapper;
  },
}));

vi.mock("@/components/MapWrapper", () => ({
  default: () => <div data-testid="map-wrapper" />,
}));

afterEach(() => {
  document.documentElement.removeAttribute(SPLASH_SEEN_ATTR);
  window.history.replaceState(null, "", "/");
});

describe("?event= and the splash", () => {
  const cases = [
    { name: "?event=abc skips", url: "/?event=abc", skip: true },
    { name: "?event= (empty) does not skip", url: "/?event=", skip: false },
    { name: "/es?event=abc skips", url: "/es?event=abc", skip: true },
  ];

  test.each(cases)("inline script and shouldSkipSplash agree: $name", ({ url, skip }) => {
    window.history.replaceState(null, "", url);

    new Function(SPLASH_GATE_SCRIPT)();

    const { search, hash } = window.location;
    expect(document.documentElement.hasAttribute(SPLASH_SEEN_ATTR)).toBe(skip);
    expect(shouldSkipSplash({ search, hash, gateSeen: false })).toBe(skip);
  });

  test("a first-time visitor on an event link gets no splash once render() returns", () => {
    window.history.replaceState(null, "", "/?event=abc");
    const { container } = render(<HomePageClient />);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("main")).not.toBeNull();
  });
});
