/**
 * Accessibility smoke tests — axe-core via vitest-axe.
 *
 * Covers the primary entry surfaces:
 *   1. SplashScreen — first-visit gate (PR 3)
 *   2. SearchBar — floating search bar above map (PR 6)
 *   3. BottomNav — Near me / Saved / Boxes / Help / Menu (idle / locating / open / Boxes-active states)
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
import type { Venue } from "@/types/venue";

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

// ─── BottomNav (replaced LocateButton — docs/bottom-nav-spec.md §6, §12) ───────

import BottomNav from "@/components/BottomNav";
import type { GeoState } from "@/lib/useGeolocation";

const GEO_IDLE: GeoState = { permission: "prompt", position: null };
const GEO_GRANTED: GeoState = {
  permission: "granted",
  position: { lat: 38.2544, lng: -104.6091 },
};

describe("BottomNav a11y", () => {
  const cases: Array<[string, React.ComponentProps<typeof BottomNav>]> = [
    ["idle, nothing open", { locale: "en", openSection: null, onSectionTap: vi.fn(), geoState: GEO_IDLE, isLocating: false, isDrifted: false, onNearMe: vi.fn(), boxesActive: false, onBoxesToggle: vi.fn() }],
    ["locating", { locale: "en", openSection: null, onSectionTap: vi.fn(), geoState: GEO_IDLE, isLocating: true, isDrifted: false, onNearMe: vi.fn(), boxesActive: false, onBoxesToggle: vi.fn() }],
    ["located + drifted, Saved open", { locale: "es", openSection: "saved", onSectionTap: vi.fn(), geoState: GEO_GRANTED, isLocating: false, isDrifted: true, onNearMe: vi.fn(), boxesActive: false, onBoxesToggle: vi.fn() }],
    // #516: Boxes active (raspberry tint + aria-pressed) gets its own a11y pass.
    ["Boxes active", { locale: "en", openSection: null, onSectionTap: vi.fn(), geoState: GEO_IDLE, isLocating: false, isDrifted: false, onNearMe: vi.fn(), boxesActive: true, onBoxesToggle: vi.fn() }],
  ];
  test.each(cases)("%s has no axe violations", async (_label, props) => {
    const { container } = render(<BottomNav {...props} />);
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

// ─── BottomSheet ─────────────────────────────────────────────────────────────
// vaul Drawer.Portal requires a real DOM portal unavailable in jsdom.
// Mock the entire module (same approach as BottomSheet.test.tsx) so children
// render as plain divs, enabling structural/ARIA a11y checks.

vi.mock("vaul", () => {
  const DrawerRoot = ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="vaul-root">{children}</div> : null;
  const DrawerPortal = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="vaul-portal">{children}</div>
  );
  const DrawerContent = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="vaul-content" {...rest}>{children}</div>
  );
  const DrawerTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="vaul-title" className={className}>{children}</h2>
  );
  const DrawerDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="vaul-description" className={className}>{children}</p>
  );
  return { Drawer: { Root: DrawerRoot, Portal: DrawerPortal, Content: DrawerContent, Title: DrawerTitle, Description: DrawerDescription } };
});

import BottomSheet from "@/components/BottomSheet";

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "a11y-venue",
    name: "A11y Test Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Test St, Pueblo, CO 81003",
    phone: "(719) 555-0000",
    hours_weekly: { mon: ["09:00-12:00"], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

describe("BottomSheet a11y", () => {
  test("collapsed state has no axe violations", async () => {
    const { container } = render(
      <BottomSheet venue={makeVenue()} onClose={() => {}} />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });
});

// ─── HamburgerMenu ────────────────────────────────────────────────────────────
// matchMedia stub: jsdom lacks it; used for mobile breakpoint detection.
// next/link: renders as plain <a> in tests.

import HamburgerMenu from "@/components/HamburgerMenu";

vi.mock("next/link", () => ({
  // Pass all HTML attrs (including role, aria-label) through to the <a> element.
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest as React.AnchorHTMLAttributes<HTMLAnchorElement>}>{children}</a>
  ),
}));

describe("HamburgerMenu a11y", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  test("open state has no axe violations", async () => {
    const { container } = render(<HamburgerMenu open onClose={vi.fn()} />);
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });

  test("saved view (empty and with places) has no axe violations", async () => {
    const place = {
      id: "v1", name: "Eastside Food Pantry", category: "pantry" as const, lat: 38.26, lng: -104.6,
      address: "100 Main St", source: "test", last_verified: "2025-01-01",
    };
    for (const savedVenues of [[], [place]]) {
      const { container, unmount } = render(<HamburgerMenu open onClose={vi.fn()} view="saved" savedVenues={savedVenues} />);
      const results = await runAxe(container);
      expect(results.violations.length, `Violations found:\n${describeViolations(results)}`).toBe(0);
      unmount();
    }
  });
});

// ─── DesktopVenueWindow ───────────────────────────────────────────────────────
// mapboxMap is optional for structural rendering; pass null to skip positioning.
// Tests both collapsed and expanded states.

import DesktopVenueWindow from "@/components/DesktopVenueWindow";

describe("DesktopVenueWindow a11y", () => {
  test("collapsed state has no axe violations", async () => {
    const { container } = render(
      <DesktopVenueWindow
        venue={makeVenue()}
        expanded={false}
        mapboxMap={null}
        onExpand={() => {}}
        onCollapse={() => {}}
        onClose={() => {}}
      />,
    );
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:\n${describeViolations(results)}`,
    ).toBe(0);
  });

  test("expanded state has no axe violations", async () => {
    const { container } = render(
      <DesktopVenueWindow
        venue={makeVenue({ accepts_snap: true, accepts_wic: true })}
        expanded={true}
        mapboxMap={null}
        onExpand={() => {}}
        onCollapse={() => {}}
        onClose={() => {}}
      />,
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

// ─── ResourcesContent (/resources) ────────────────────────────────────────────
// next/link is already mocked to a plain <a> above.

import ResourcesContent from "@/components/ResourcesContent";

describe("ResourcesContent a11y", () => {
  test("has no axe violations", async () => {
    const { container } = render(<ResourcesContent />);
    const results = await runAxe(container);
    expect(
      results.violations.length,
      `Violations found:
${describeViolations(results)}`,
    ).toBe(0);
  });
});
