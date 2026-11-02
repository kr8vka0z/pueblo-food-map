/**
 * #721 — the box card (BoxCardBody) is lazy-loaded by both shells. Proves the
 * two things that could break with the split: the card shows the existing
 * "Loading…" line until its code arrives, then the real card; and a check-in
 * made in the lazily loaded card still reaches the shell's onCheckinSuccess
 * (MapWrapper patches its cached box record through it).
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

// Same vaul stand-in BottomSheet.test.tsx uses (jsdom has no drawer animation context).
vi.mock("vaul", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Root = ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null);
  return { Drawer: { Root, Portal: Pass, Content: Pass, Title: Pass, Description: Pass } };
});

const BOX: PublicBlessingBox = {
  id: "lazy-box-1",
  name: "Lazy Test Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "9 Lazy Ln, Pueblo, CO",
  source: "manual",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null, hostNote: null, mostNeeded: null, installedOn: null, removedOn: null,
    status: "stocked", lastFilledAt: null, recentCheckins: [], latestPhoto: null, adopters: [],
  },
};

const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("turnstile", {
    render: vi.fn((_c: HTMLElement, opts: { callback?: (t: string) => void }) => {
      opts.callback?.("test-turnstile-token");
      return "widget-id-1";
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lazy box card (#721)", () => {
  test("phone sheet: 'Loading…' first, then the card; a check-in reaches onCheckinSuccess", async () => {
    const onCheckinSuccess = vi.fn();
    const user = userEvent.setup();
    render(<BottomSheet venue={BOX} box={BOX} onClose={() => {}} onCheckinSuccess={onCheckinSuccess} />);
    expect(screen.getByText("Loading…")).toBeDefined();

    const empty = await screen.findByRole("button", { name: "It's empty" });
    expect(screen.queryByText("Loading…")).toBeNull();
    await waitFor(() => expect(empty).not.toBeDisabled());
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: "empty", lastFilledAt: null }) });
    await user.click(empty);
    await waitFor(() =>
      expect(onCheckinSuccess).toHaveBeenCalledWith({ status: "empty", lastFilledAt: null, kind: "empty" }),
    );
  });

  test("desktop window: 'Loading…' first, then the card", async () => {
    render(
      <DesktopVenueWindow
        venue={BOX}
        box={BOX}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.getByText("Loading…")).toBeDefined();
    expect(await screen.findByRole("button", { name: "I used this box" })).toBeDefined();
  });
});
