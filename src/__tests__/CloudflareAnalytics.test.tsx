/**
 * CloudflareAnalytics tests — issue #592.
 *
 * WHY the hostname gate needs its own test (not just eyeballing the code):
 * the beacon must never fire on dev/staging/localhost/CI or the Web
 * Analytics numbers (and the PRD's 100-visits/month target) get polluted by
 * non-visitor traffic. `isProductionHostname` is exported so the exact-match
 * allowlist logic is pinned independent of the component's effect timing.
 */

import { describe, test, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import CloudflareAnalytics, { isProductionHostname } from "@/components/CloudflareAnalytics";

afterEach(() => {
  cleanup();
  document.querySelectorAll('script[src*="cloudflareinsights"]').forEach((n) => n.remove());
});

describe("isProductionHostname", () => {
  test("matches the two production hostnames exactly", () => {
    expect(isProductionHostname("pueblofoodmap.com")).toBe(true);
    expect(isProductionHostname("www.pueblofoodmap.com")).toBe(true);
  });

  test("rejects dev/staging/preview/local hostnames", () => {
    expect(isProductionHostname("dev.pueblofoodmap.com")).toBe(false);
    expect(isProductionHostname("pueblo-food-map.kyle-boyd.workers.dev")).toBe(false);
    expect(isProductionHostname("localhost")).toBe(false);
    expect(isProductionHostname("127.0.0.1")).toBe(false);
  });

  test("rejects a hostname that merely ends with the production domain (no subdomain smuggling)", () => {
    expect(isProductionHostname("evil-pueblofoodmap.com")).toBe(false);
    expect(isProductionHostname("notpueblofoodmap.com")).toBe(false);
  });
});

describe("CloudflareAnalytics component", () => {
  test("does not inject the beacon script on a non-production hostname", async () => {
    // jsdom's default test origin is http://localhost:3000 — exactly the
    // hostname the beacon must stay off of.
    render(<CloudflareAnalytics />);
    // Flush the effect + the requestIdleCallback fallback (setTimeout) next/script
    // uses for strategy="lazyOnload" before asserting nothing landed in the DOM.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.querySelector('script[src*="cloudflareinsights"]')).toBeNull();
  });

  test("injects the beacon script with the expected token on pueblofoodmap.com", async () => {
    // jsdom's `window.location.hostname` isn't directly redefinable (it's a
    // non-configurable accessor on the prototype) and reassigning
    // `window.location` itself hits a TS2322 quirk in this lib's Location
    // typing — replacing the whole `window.location` property via
    // defineProperty (the standard jsdom test workaround) sidesteps both.
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "pueblofoodmap.com" },
      writable: true,
      configurable: true,
    });

    render(<CloudflareAnalytics />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const script = document.querySelector('script[src*="cloudflareinsights"]');
    expect(script).not.toBeNull();
    expect(script?.getAttribute("src")).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(script?.getAttribute("data-cf-beacon")).toBe(
      JSON.stringify({ token: "fc93862d1dc14974aee3dddf357e2884" }),
    );

    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  });
});
