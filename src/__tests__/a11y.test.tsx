/**
 * Accessibility smoke tests — axe-core via vitest-axe.
 *
 * Covers the primary entry surfaces:
 *   1. SplashScreen — first-visit gate (PR 3)
 *   2. SearchBar — floating search bar above map (PR 6)
 *   3. LocateButton — geolocation trigger (idle / granted / denied states)
 *   4. LocationDeniedBanner — permission-denied overlay (PR 7)
 *   5. VenueMarker — Mapbox marker button (PR 45, Mapbox migration)
 *
 * Map.tsx is excluded from direct axe tests: it requires a real Mapbox GL
 * canvas/WebGL context unavailable in jsdom. Map-level a11y is verified via
 * Lighthouse on the live Cloudflare production deploy (see PR #48 baseline).
 * VenueMarker (the interactive button inside each map pin) is testable because
 * we mock react-map-gl/mapbox's Marker to render children directly.
 *
 * Notes on test environment:
 *   - navigator.permissions is mocked to avoid unhandled promise rejections.
 *   - CSS custom properties (--color-*, --radius-*) resolve to empty strings in
 *     jsdom; axe-core colour-contrast rules are disabled because contrast
 *     requires computed styles that jsdom cannot produce. All structural rules
 *     (labels, roles, landmarks, ARIA attributes) are fully enforced.
 *   - We assert results.violations.length === 0 directly rather than using
 *     vitest-axe's toHaveNoViolations matcher, which has an empty extend-expect
 *     shim in v0.1.0 (upstream bug). Violations are printed for diagnosis when
 *     the count is non-zero.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import type AxeCore from "axe-core";

// ─── Mock navigator.permissions (jsdom doesn't implement it) ─────────────────
beforeEach(() => {
  // Re-stub each test to avoid cross-test pollution when jsdom resets.
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
    },
    configurable: true,
    writable: true,
  });
});

// ─── axe helper — disable colour-contrast (no computed styles in jsdom) ───────
// All structural rules remain active (labels, roles, landmarks, ARIA attrs).
async function runAxe(container: Element): Promise<AxeCore.AxeResults> {
  return axe(container, { rules: { "color-contrast": { enabled: false } } });
}

/** Format violation list for assertion error messages. */
function describeViolations(results: AxeCore.AxeResults): string {
  if (results.violations.length === 0) return "no violations";
  return results.violations
    .map((v) => `[${v.id}] ${v.help}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
}

// ─── SplashScreen ─────────────────────────────────────────────────────────────

import SplashScreen from "@/components/SplashScreen";

describe("SplashScreen a11y", () => {
  test("has no axe violations", async () => {
    const { container } = render(
      <SplashScreen onPrimary={vi.fn()} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });
});

// ─── SearchBar ────────────────────────────────────────────────────────────────

import SearchBar from "@/components/SearchBar";

describe("SearchBar a11y", () => {
  test("has no axe violations (empty query)", async () => {
    const { container } = render(
      <SearchBar value="" onChange={vi.fn()} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });

  test("has no axe violations (with query)", async () => {
    const { container } = render(
      <SearchBar value="pantry" onChange={vi.fn()} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });
});

// ─── LocateButton ─────────────────────────────────────────────────────────────

import LocateButton from "@/components/LocateButton";
import type { GeoState } from "@/lib/useGeolocation";

const GEO_IDLE: GeoState = { permission: "prompt", position: null };
const GEO_GRANTED: GeoState = {
  permission: "granted",
  position: { lat: 38.2544, lng: -104.6091 },
};
const GEO_DENIED: GeoState = { permission: "denied", position: null };

describe("LocateButton a11y", () => {
  test("idle state has no axe violations", async () => {
    const { container } = render(
      <LocateButton geoState={GEO_IDLE} onRequest={vi.fn()} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });

  test("granted state has no axe violations", async () => {
    const { container } = render(
      <LocateButton geoState={GEO_GRANTED} onRequest={vi.fn()} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });

  test("denied state has no axe violations", async () => {
    const { container } = render(
      <LocateButton geoState={GEO_DENIED} onRequest={vi.fn()} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });
});

// ─── LocationDeniedBanner ─────────────────────────────────────────────────────

import LocationDeniedBanner from "@/components/LocationDeniedBanner";

describe("LocationDeniedBanner a11y", () => {
  test("has no axe violations", async () => {
    const { container } = render(
      <LocationDeniedBanner onRetry={vi.fn()} onDismiss={vi.fn()} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });
});

// ─── VenueMarker ─────────────────────────────────────────────────────────────
// Mock react-map-gl/mapbox Marker so the button child is testable in jsdom.
// Map.tsx itself is excluded (needs WebGL canvas — verified via Lighthouse).

vi.mock("react-map-gl/mapbox", () => ({
  default: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Marker: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Popup: vi.fn(() => null),
  AttributionControl: vi.fn(() => null),
}));

import VenueMarker from "@/components/VenueMarker";
import type { Venue } from "@/types/venue";

function makeAxeVenue(category: Venue["category"] = "pantry"): Venue {
  return {
    id: "axe-test-venue",
    name: "Axe Test Venue",
    category,
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Test St",
    source: "test",
    last_verified: "2026-01-01",
  };
}

describe("VenueMarker a11y", () => {
  test("unselected pantry marker has no axe violations", async () => {
    const { container } = render(
      <VenueMarker
        venue={makeAxeVenue("pantry")}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });

  test("selected marker (with sage ring) has no axe violations", async () => {
    const { container } = render(
      <VenueMarker
        venue={makeAxeVenue("grocery")}
        selected={true}
        onClick={vi.fn()}
      />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });

  test("marker with distance label has no axe violations", async () => {
    const { container } = render(
      <VenueMarker
        venue={makeAxeVenue("garden")}
        selected={false}
        distanceMiles={1.4}
        onClick={vi.fn()}
      />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });
});
