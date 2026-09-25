/**
 * MapWrapper — no-WebGL box card (#524).
 *
 * Before this fix, tapping a blessing box while the map was unavailable
 * (mapUnavailable, #165) navigated to the box's /box/<id>/history page — a
 * deliberately read-only log since #511 (REVIEW.md's standing rule), with no
 * check-in, adopt, or address. That stranded every no-WebGL visitor (this
 * app's own low-end-phone audience) out of the one interaction Blessing
 * Boxes exist for.
 *
 * Confirms the fix: on mobile with mapUnavailable, tapping a box in the list
 * opens the SAME BottomSheet card the map uses — over the list, no map
 * behind it — with its check-in and adopt controls intact, and no
 * navigation happens at all (the History link the card itself still offers
 * is a separate, unclicked affordance — see REVIEW.md's standing rule for
 * why that one link stays).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// Mock WebGL as unavailable — same convention as MapWrapperFallback.test.tsx.
vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => false }));

vi.mock("next/dynamic", () => ({
  default: () => {
    function DummyDynamic() {
      return null;
    }
    DummyDynamic.displayName = "DummyDynamic";
    return DummyDynamic;
  },
}));

// Desktop-only component — unused on the mobile layout this file tests, but
// still imported by MapWrapper.tsx, so mock it the same way every other
// mapUnavailable test in this repo does.
vi.mock("@/components/DesktopVenueWindow", () => ({
  default: () => null,
}));

// vaul's Drawer.Root/Portal/Content/Title need a real DOM portal/animation
// context jsdom doesn't have — identical recipe to BottomSheet.test.tsx.
vi.mock("vaul", () => {
  const DrawerRoot = ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="vaul-root">{children}</div> : null;
  const DrawerPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const DrawerContent = ({
    children,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="vaul-content" {...rest}>{children}</div>
  );
  const DrawerTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  );
  const DrawerDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={className}>{children}</p>
  );
  return {
    Drawer: {
      Root: DrawerRoot,
      Portal: DrawerPortal,
      Content: DrawerContent,
      Title: DrawerTitle,
      Description: DrawerDescription,
    },
  };
});

const TEST_BOX = {
  id: "test-blessing-box-524",
  name: "Test No-WebGL Box",
  category: "blessing_box" as const,
  lat: 38.264,
  lng: -104.611,
  address: "524 Test St, Pueblo, CO",
  source: "manual",
  last_verified: "2026-09-01",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: null,
    installedOn: null,
    removedOn: null,
    status: "stocked" as const,
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

// BoxCardBody renders BoxCheckinPanel directly (not mocked) — stub Turnstile
// the same way BoxCardBody.test.tsx / BottomSheet.test.tsx already do.
const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockTurnstile.render.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  // matches: true -> phone layout everywhere (both useMediaQuery's
  // MOBILE_QUERY and BELOW_2XL_QUERY match) — same blanket convention as
  // OverlayHidesBottomNav.test.tsx — so BottomSheet (not DesktopVenueWindow,
  // mocked away above) is the card under test.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ boxes: [TEST_BOX] }),
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MapWrapper — no-WebGL box card (#524)", () => {
  test("tapping a box in the list opens the card with check-in and adopt controls, no navigation to /history", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <LocaleProvider>
          <MapWrapper />
        </LocaleProvider>,
      );
      // Let useBoxesList's fetch AND useMediaQuery's setTimeout(0) sync resolve.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    // The map-unavailable fallback banner is visible — list is the only surface.
    expect(screen.getByText(/map unavailable/i)).toBeTruthy();

    const boxButton = await screen.findByRole("button", { name: new RegExp(TEST_BOX.name, "i") });
    await user.click(boxButton);

    // The card opened over the list — no navigation anywhere, so the
    // read-only history page is never reached.
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    const card = await screen.findByTestId("vaul-content");

    // Check-in control present (exact wording per REVIEW.md's standing rule).
    expect(within(card).getByRole("button", { name: /i used this box/i })).toBeTruthy();
    // Adopt control present.
    expect(within(card).getByRole("button", { name: /apply to adopt this box/i })).toBeTruthy();
    // Address readable — entirely absent from /box/<id>/history.
    expect(within(card).getByText(TEST_BOX.address)).toBeTruthy();
  });
});
