import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import { venues } from "@/data/venues";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock WebGL as unavailable to simulate older / unsupported device
vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => false }));

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

vi.mock("@/components/DesktopVenueWindow", () => ({
  default: () => null,
}));

beforeEach(() => {
  mockPush.mockClear();
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MapWrapper WebGL fallback navigation (#285)", () => {
  test("when WebGL is unavailable, selecting a venue card navigates to /venue/[id]", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <LocaleProvider>
          <MapWrapper />
        </LocaleProvider>,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    // The unavailable fallback banner is visible
    expect(screen.getByText(/map unavailable/i)).toBeTruthy();

    // Click the first venue card
    const targetVenue = venues[0];
    const venueButton = screen.getByRole("button", { name: new RegExp(targetVenue.name, "i") });
    await user.click(venueButton);

    expect(mockPush).toHaveBeenCalledWith(`/venue/${targetVenue.id}`);
  });
});