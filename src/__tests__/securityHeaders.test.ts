/**
 * next.config.ts security-header regression tests — issue #593.
 *
 * WHY: like poweredByHeader (see next-config.test.ts), these headers are
 * plain config data with no other code path exercising them — nothing else
 * in the suite would fail red if a directive were silently dropped or a
 * required host fell out of the CSP allowlist.
 */

import { describe, test, expect } from "vitest";
import nextConfig from "../../next.config";

async function getGlobalHeaders(): Promise<Record<string, string>> {
  expect(nextConfig.headers).toBeDefined();
  const entries = await nextConfig.headers!();
  const globalEntry = entries.find((e) => e.source === "/(.*)");
  expect(globalEntry).toBeDefined();
  return Object.fromEntries(globalEntry!.headers.map((h) => [h.key, h.value]));
}

describe("next.config security headers (#593)", () => {
  test("does not set its own Strict-Transport-Security (the Cloudflare zone already sends one)", async () => {
    const headers = await getGlobalHeaders();
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  test("Permissions-Policy denies what this app never uses and self-scopes geolocation/camera", async () => {
    const headers = await getGlobalHeaders();
    const pp = headers["Permissions-Policy"];
    expect(pp).toBeDefined();
    expect(pp).toContain("geolocation=(self)");
    expect(pp).toContain("camera=(self)");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("payment=()");
    expect(pp).toContain("usb=()");
  });

  test("ships an enforcing Content-Security-Policy, not report-only", async () => {
    const headers = await getGlobalHeaders();
    expect(headers["Content-Security-Policy"]).toBeDefined();
    expect(headers["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  test("CSP allows Mapbox styles/tiles/directions and its blob: worker", async () => {
    const headers = await getGlobalHeaders();
    const csp = headers["Content-Security-Policy"];
    expect(csp).toContain("https://api.mapbox.com");
    expect(csp).toContain("https://*.tiles.mapbox.com");
    expect(csp).toContain("https://events.mapbox.com");
    expect(csp).toContain("worker-src 'self' blob:");
  });

  test("CSP allows the Turnstile widget script and its challenge iframe", async () => {
    const headers = await getGlobalHeaders();
    const csp = headers["Content-Security-Policy"];
    expect(csp).toMatch(/script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  });

  test("CSP allows the Cloudflare Web Analytics beacon script and its report endpoint", async () => {
    // The app no longer loads this script itself (#647 — Cloudflare's edge
    // auto_install injects it into every real-browser HTML response, and
    // the app-side loader was deleted to stop double-counting page views).
    // The CSP still needs to allow it: the browser enforces this header
    // against whatever script tag ends up in the response, injected or not.
    const headers = await getGlobalHeaders();
    const csp = headers["Content-Security-Policy"];
    expect(csp).toMatch(/script-src[^;]*https:\/\/static\.cloudflareinsights\.com/);
    expect(csp).toContain("https://cloudflareinsights.com");
  });

  test("CSP defaults to self and denies framing/plugins", async () => {
    const headers = await getGlobalHeaders();
    const csp = headers["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  test("CSP reports violations to the same-origin sink (report-only is unverifiable without one)", async () => {
    const headers = await getGlobalHeaders();
    const csp = headers["Content-Security-Policy"];
    expect(csp).toContain("report-uri /api/csp-report");
  });
});
