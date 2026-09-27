/**
 * BottomSheet tests — issue #122's boolean-expanded toggle, now (#666)
 * driven by a grab bar instead of a visible "Show details" text button.
 *
 * Verifies:
 *   1. Venue name and category label are visible in summary (collapsed).
 *   2. The detail section is collapsed (`aria-expanded="false"`) initially.
 *   3. Tapping the grab bar reveals phone/hours (`aria-expanded="true"`,
 *      content actually visible — jsdom has no layout engine, so "visible"
 *      here means present and NOT inside the clipped/collapsed wrapper).
 *   4. Tapping the bar again collapses it (`aria-expanded="false"`).
 *   5. Tapping the cut-off preview also expands it (#666 a11y section).
 *   6. Swiping the bar up expands; swiping it down while expanded collapses.
 *   7. Clicking the close X calls onClose.
 *
 * #666 replaced the old `{expanded && (...)}` conditional render with an
 * ALWAYS-mounted detail section that's only CSS-clipped when collapsed —
 * jsdom doesn't run layout, so it can't tell a clipped node from a visible
 * one. Tests that used to assert phone/hours were ABSENT from the DOM while
 * collapsed now assert `aria-expanded` instead; the actual visual clip is a
 * `device-sweep`/real-device concern, not a unit-test one.
 *
 * Mock strategy:
 *   vaul's Drawer.Root/Portal/Content/Title require a real DOM portal and
 *   animation context unavailable in jsdom. We mock the entire module so
 *   Drawer.Root/Portal/Content/Title all render their children as plain divs,
 *   enabling full assertion coverage without portal/animation overhead.
 *   next/link renders as <a> natively in the test environment (no mock needed).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import * as shareMod from "@/lib/share";

// BoxCardBody (rendered for a box venue) renders BoxCheckinPanel directly,
// which mounts a Turnstile widget — stub it the same way
// BoxCheckinPanel.test.tsx/BoxCardBody.test.tsx already do.
const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockTurnstile.render.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Mock vaul ───────────────────────────────────────────────────────────────
// Render children as plain divs; no portal / animation.
//
// `vaulRootProps` (module-scope, via vi.hoisted — a plain module variable
// referenced inside vi.mock's factory hits vitest's hoisting TDZ otherwise)
// captures whatever BottomSheet passes to Drawer.Root — `onDrag`,
// `onRelease`, `onOpenChange` — so tests below can call vaul's OWN hooks
// directly to prove the swipe-down-collapse-vs-close veto (follow-up to
// #666), without reimplementing vaul's real gesture math in a test.
const vaulRootProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("vaul", () => {
  const DrawerRoot = ({ children, open, ...rest }: { children: React.ReactNode; open: boolean; [key: string]: unknown }) => {
    vaulRootProps.current = rest;
    return open ? <div data-testid="vaul-root">{children}</div> : null;
  };

  const DrawerPortal = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="vaul-portal">{children}</div>
  );

  // `ref` destructured explicitly (React 19 lets a plain function component
  // accept it as a real prop) so BottomSheet's own `ref={drawerContentRef}`
  // — used to clear vaul's leftover drag transform on a vetoed dismiss —
  // lands on the actual DOM node the tests below inspect.
  const DrawerContent = ({
    children,
    ref,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; ref?: React.Ref<HTMLDivElement> }) => (
    <div data-testid="vaul-content" ref={ref} {...rest}>{children}</div>
  );

  const DrawerTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="vaul-title" className={className}>{children}</h2>
  );
  const DrawerDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="vaul-description" className={className}>{children}</p>
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

// ─── Fixture ─────────────────────────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-venue-122",
    name: "Pueblo Test Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St, Pueblo, CO 81003",
    phone: "(719) 555-0122",
    hours_weekly: {
      mon: ["09:00-12:00"],
      tue: ["09:00-12:00"],
      wed: [],
      thu: ["09:00-12:00"],
      fri: ["09:00-12:00"],
      sat: [],
      sun: [],
    },
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BottomSheet — summary always visible (collapsed)", () => {
  test("shows venue name in summary", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    expect(screen.getByText("Pueblo Test Pantry")).toBeDefined();
  });

  test("shows category label in summary", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    // categoryLabels["pantry"] === "Food pantry". The badge span also contains
    // an aria-hidden dot child, so use getByText with exact:false to match
    // elements whose text content includes the label.
    // #590: the sr-only Drawer.Description reuses the same category copy,
    // so exclude that match and require exactly one visible badge.
    const visible = screen
      .getAllByText(/Food pantry/i)
      .filter((el) => !el.closest('[data-testid="vaul-description"]'));
    expect(visible).toHaveLength(1);
  });
});

describe("BottomSheet — grab bar collapsed state (#666)", () => {
  test("grab bar reports aria-expanded=false initially, with the 'Show details' accessible name", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
  });

  test("the hours table is inside the grab bar's aria-controls target while collapsed", () => {
    // #666: the whole detail section (hours table included) is always
    // mounted now, only CSS-clipped when collapsed — jsdom has no layout
    // engine, so a DOM-presence check can't tell "clipped" from "visible"
    // (see this file's header). What a unit test CAN prove is that the
    // hours table lives inside the exact node the grab bar's
    // aria-controls/aria-expanded pair describes as collapsed.
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
    const detailSection = document.getElementById(bar.getAttribute("aria-controls")!);
    expect(detailSection?.querySelectorAll("dt").length).toBeGreaterThan(0);
  });
});

describe("BottomSheet — grab bar expand / collapse toggle (#666)", () => {
  test("tapping the grab bar reveals phone number and flips aria-expanded", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    await user.click(bar);
    expect(bar.getAttribute("aria-expanded")).toBe("true");
    expect(bar.getAttribute("aria-label")).toMatch(/hide details/i);
    expect(screen.getByText("(719) 555-0122")).toBeDefined();
  });

  test("revealed phone number is an underlined, green, 44px tel: link (option A, 2026-09-23)", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /show details/i }));
    const link = screen.getByRole("link", { name: /555-0122/ });
    expect(link.getAttribute("href")).toBe("tel:(719) 555-0122");
    expect(link.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["underline", "text-[var(--color-sage-700)]", "min-h-11"]),
    );
  });

  test("collapsed detail content is inert (not tabbable or announced) until expanded (#683 review)", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    const section = document.getElementById(bar.getAttribute("aria-controls")!)!;
    expect(section.firstElementChild!.hasAttribute("inert")).toBe(true);
    await user.click(bar);
    expect(section.firstElementChild!.hasAttribute("inert")).toBe(false);
  });

  test("tapping the grab bar again collapses it (aria-expanded back to false)", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    await user.click(bar);
    expect(bar.getAttribute("aria-expanded")).toBe("true");
    await user.click(bar);
    expect(bar.getAttribute("aria-expanded")).toBe("false");
    expect(bar.getAttribute("aria-label")).toMatch(/show details/i);
  });

  test("tapping the cut-off preview also expands (#666 accessibility: 'tapping the preview also expands')", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    // The preview is the detail section itself while collapsed — it has the
    // grab bar's aria-controls id and is clickable only when collapsed.
    const preview = document.getElementById(bar.getAttribute("aria-controls")!);
    expect(preview).not.toBeNull();
    fireEvent.click(preview!);
    expect(bar.getAttribute("aria-expanded")).toBe("true");
  });

  test("swiping the bar up expands; swiping it down while expanded collapses", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    // Swipe up (clientY decreases) past the 30px threshold.
    fireEvent.pointerDown(bar, { clientY: 200 });
    fireEvent.pointerUp(bar, { clientY: 150 });
    expect(bar.getAttribute("aria-expanded")).toBe("true");
    // Swipe down (clientY increases) past the threshold collapses it back.
    fireEvent.pointerDown(bar, { clientY: 150 });
    fireEvent.pointerUp(bar, { clientY: 200 });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
  });

  test("a small movement under the swipe threshold does not toggle on its own", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    fireEvent.pointerDown(bar, { clientY: 200 });
    fireEvent.pointerUp(bar, { clientY: 190 });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
  });
});

// ─── Whole-card swipe-up + swipe-down-collapse-vs-close (follow-up to #666) ──
// Kyle's original ask was "swipe up on the card", not only the bar, and a
// swipe down on the EXPANDED card should collapse before it closes. These
// tests exercise the two different mechanisms BottomSheet.tsx uses (see its
// own header comment on `dismissDragActive` for the full vaul-source
// citation): swipe-up is our own recognizer on Drawer.Content; swipe-down-
// while-expanded is vaul's own `onDrag`/`onRelease`/`onOpenChange` hooks,
// captured here via `vaulRootProps` rather than reimplemented.
describe("BottomSheet — swipe up anywhere on the collapsed card expands it", () => {
  test("swiping up on the card body (not the bar) expands", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    const content = screen.getByTestId("vaul-content");
    fireEvent.pointerDown(content, { clientY: 300 });
    fireEvent.pointerUp(content, { clientY: 250 });
    expect(bar.getAttribute("aria-expanded")).toBe("true");
  });

  test("swiping up starting on a button/link does not expand (Kyle's 'outside buttons/links')", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.pointerDown(closeButton, { clientY: 300 });
    fireEvent.pointerUp(closeButton, { clientY: 250 });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
  });

  test("a pointercancel (native scroll taking over) clears the gesture — no expand on the eventual pointerup elsewhere", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    const content = screen.getByTestId("vaul-content");
    fireEvent.pointerDown(content, { clientY: 300 });
    fireEvent.pointerCancel(content);
    fireEvent.pointerUp(content, { clientY: 250 });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("BottomSheet — swipe down while expanded collapses instead of closing", () => {
  test("a vaul drag-dismiss while expanded collapses the card and does NOT call onClose", () => {
    const onClose = vi.fn();
    render(<BottomSheet venue={makeVenue()} onClose={onClose} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    fireEvent.click(bar); // expand
    expect(bar.getAttribute("aria-expanded")).toBe("true");

    // Simulate vaul engaging a real drag (its own onDrag prop), then
    // deciding to dismiss (its own onOpenChange(false)) — exactly the two
    // calls vaul's source makes, in that order, for a real drag-dismiss.
    const onDrag = vaulRootProps.current.onDrag as (...args: unknown[]) => void;
    const onOpenChange = vaulRootProps.current.onOpenChange as (open: boolean) => void;
    act(() => {
      onDrag();
      onOpenChange(false);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(bar.getAttribute("aria-expanded")).toBe("false");
  });

  test("vaul's onRelease(event, false) after a vetoed dismiss clears the leftover drag transform", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    fireEvent.click(bar);

    const content = screen.getByTestId("vaul-content") as HTMLDivElement;
    // Simulate vaul's live drag having left an inline transform (exactly
    // what vaul's own onDrag does to the DOM node during a real drag).
    content.style.transition = "none";
    content.style.transform = "translate3d(0, 240px, 0)";

    const onDrag = vaulRootProps.current.onDrag as (...args: unknown[]) => void;
    const onOpenChange = vaulRootProps.current.onOpenChange as (open: boolean) => void;
    const onRelease = vaulRootProps.current.onRelease as (event: unknown, open: boolean) => void;
    act(() => {
      onDrag();
      onOpenChange(false);
      onRelease({}, false);
    });

    expect(content.style.transform).toBe("");
  });

  test("Escape (no prior onDrag) still closes normally even while expanded — #527/#604 unchanged", () => {
    const onClose = vi.fn();
    render(<BottomSheet venue={makeVenue()} onClose={onClose} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    fireEvent.click(bar);
    expect(bar.getAttribute("aria-expanded")).toBe("true");

    // No onDrag call this time — mirrors Escape/scrim, which route straight
    // to onOpenChange without ever touching vaul's onDrag prop.
    const onOpenChange = vaulRootProps.current.onOpenChange as (open: boolean) => void;
    act(() => {
      onOpenChange(false);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a drag-dismiss while COLLAPSED still closes (only the second swipe-down, from expanded, is vetoed)", () => {
    const onClose = vi.fn();
    render(<BottomSheet venue={makeVenue()} onClose={onClose} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    expect(bar.getAttribute("aria-expanded")).toBe("false");

    const onDrag = vaulRootProps.current.onDrag as (...args: unknown[]) => void;
    const onOpenChange = vaulRootProps.current.onOpenChange as (open: boolean) => void;
    act(() => {
      onDrag();
      onOpenChange(false);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("BottomSheet — close button", () => {
  test("clicking the close X calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={onClose} />);
    // Use exact match "Close" to avoid matching the drag handle's aria-label
    // "Drag to expand or close venue details" which also contains "close".
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("BottomSheet — Plentiful link (#128)", () => {
  test("shows the Plentiful link (new tab) for Plentiful-sourced venues when expanded", async () => {
    const user = userEvent.setup();
    const venue = makeVenue({
      source: "directory.plentiful.org/colorado/pueblo",
      url: "https://directory.plentiful.org/colorado/pueblo/test-pantry",
    });
    render(<BottomSheet venue={venue} onClose={() => {}} />);
    // Collapsed: the detail section (and this link inside it) is always
    // mounted now (#666) — the grab bar's own aria-expanded is the signal.
    expect(screen.getByRole("button", { name: /show details/i }).getAttribute("aria-expanded")).toBe("false");
    await user.click(screen.getByRole("button", { name: /show details/i }));
    const link = screen.getByRole("link", { name: /on Plentiful/i }) as HTMLAnchorElement;
    expect(link.href).toContain("directory.plentiful.org");
    expect(link.target).toBe("_blank");
  });

  test("no Plentiful link for non-Plentiful venues", async () => {
    const user = userEvent.setup();
    const venue = makeVenue({ source: "OpenStreetMap", url: "https://example.com/x" });
    render(<BottomSheet venue={venue} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.queryByRole("link", { name: /on Plentiful/i })).toBeNull();
  });
});

// ─── Blessing box (map-first rework, 2026-09-18) ───────────────────────────

function makeBoxVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return makeVenue({
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    phone: undefined,
    hours_weekly: undefined,
    ...overrides,
  });
}

function makeBox(overrides: Partial<PublicBlessingBox["box"]> = {}): PublicBlessingBox {
  return {
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    lat: 38.27,
    lng: -104.61,
    address: "123 Test St, Pueblo, CO",
    source: "manual",
    last_verified: "2026-09-01T00:00:00.000Z",
    box: {
      hostName: null,
      hostNote: null,
      mostNeeded: null,
      installedOn: "2026-01-01",
      removedOn: null,
      status: "stocked",
      lastFilledAt: "2026-09-17T09:00:00.000Z",
      recentCheckins: [],
      latestPhoto: null,
      adopters: [],
      ...overrides,
    },
  };
}

describe("BottomSheet — blessing box card (map-first rework)", () => {
  test("renders BoxCardBody content, with the SAME grab bar #666 gives ordinary venues (#667 supersedes 'box cards get no toggle')", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    // BoxCardBody's status badge is present — proves the box branch rendered.
    expect(screen.getByTestId("box-status-badge")).toBeDefined();
    // #667 supersedes #666's original "box cards get the bar only, no
    // preview" line — a box now gets the full bar + preview mechanics too.
    expect(screen.getByRole("button", { name: /show details/i })).toBeDefined();
  });

  test("tapping the grab bar expands the box card's below-the-fold section (#667)", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    expect(bar.getAttribute("aria-expanded")).toBe("false");
    await user.click(bar);
    expect(bar.getAttribute("aria-expanded")).toBe("true");
    // The below-the-fold wrapper is the exact node aria-controls names.
    const wrapper = document.getElementById(bar.getAttribute("aria-controls")!);
    expect(wrapper?.className).not.toContain("overflow-hidden");
  });

  test("the box's below-the-fold wrapper (sponsor band, footer) sits inside the grab bar's aria-controls target", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    const bar = screen.getByRole("button", { name: /show details/i });
    const wrapper = document.getElementById(bar.getAttribute("aria-controls")!);
    expect(wrapper?.textContent).toMatch(/needs a sponsor/i);
    expect(screen.getByRole("link", { name: "History" }).closest(`#${wrapper?.id}`)).not.toBeNull();
  });

  test("hours-today badge and notes paragraph are skipped for a box", () => {
    render(
      <BottomSheet
        venue={makeBoxVenue({ notes: "Some note text that would otherwise show" })}
        box={makeBox()}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText("Some note text that would otherwise show")).toBeNull();
    expect(screen.queryByText(/Open now|Closed|hours unknown/i)).toBeNull();
  });

  test("shows a loading fallback when box data hasn't arrived yet", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={null} onClose={() => {}} />);
    expect(screen.queryByTestId("box-status-badge")).toBeNull();
  });

  // Card redesign (2026-09-19), spec item 7: "Bottom, after a hairline
  // rule: ONLY two links — 'History' and 'Email me when it needs
  // filling'." Supersedes the 2026-09-18b "near the top" placement this
  // test used to assert — the History link now lives in the card's
  // footer, after the check-in panel, alongside the alert-signup link.
  test("shows the History link in the footer, after the check-in panel, alongside 'Email me when it needs filling'", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: "History" });
    expect(link.getAttribute("href")).toBe("/box/test-box-1/history");
    // "I used this box" is BoxCheckinPanel's first button — the History
    // link must come AFTER it in DOM order now (footer, not near the top).
    const takeButton = screen.getByRole("button", { name: "I used this box" });
    expect(link.compareDocumentPosition(takeButton) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email me when it needs filling" })).toBeDefined();
  });

  test("share button calls shareVenue with isBox: true for a box venue", async () => {
    // Same vi.spyOn(shareMod, "shareVenue") strategy ShareButton.test.tsx
    // uses for its clipboard-fallback case — avoids the userEvent-vs-
    // navigator.clipboard mock conflict documented in that file's own header.
    const shareSpy = vi.spyOn(shareMod, "shareVenue").mockResolvedValue("copied");
    const user = userEvent.setup();
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /share/i }));
    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ venueId: "test-box-1", isBox: true }));
    shareSpy.mockRestore();
  });
});
