/**
 * Touch-target guardrail (#233) — pins the hit-area classes the home/map
 * audit added so a later restyle can't quietly drop a control back under
 * DESIGN.md's "Low-end device guardrails" floor (48×48 CSS px, neighbouring
 * hit areas ≥8px apart).
 *
 * jsdom does no layout, so these are class assertions, not measurements —
 * cheap by design. The real measurement is the Playwright audit whose
 * before/after table lives in the PR that added this file. Where a control
 * keeps its visual size and gets an invisible `::before` overlay instead,
 * the test pins the overlay's inset classes (and the `relative` it is
 * positioned against).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/SearchBar";
import FilterPanel from "@/components/FilterPanel";
import HamburgerMenu from "@/components/HamburgerMenu";
import HamburgerMenuItem from "@/components/HamburgerMenuItem";
import LanguageToggle from "@/components/LanguageToggle";
import ListView from "@/components/ListView";
import ShareButton from "@/components/ShareButton";
import FavoriteButton from "@/components/FavoriteButton";
import DirectionButtons from "@/components/DirectionButtons";
import ReportVenueButton from "@/components/ReportVenueButton";
import BottomSheet from "@/components/BottomSheet";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

// Box cards mount BoxCheckinPanel's Turnstile widget — same stub as the
// BoxCardBody/DesktopVenueWindow tests.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("turnstile", { render: vi.fn(() => "w"), reset: vi.fn(), remove: vi.fn() });
  // HamburgerMenu's breakpoint hooks read matchMedia, which jsdom lacks.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// Same vaul stand-in as BottomSheet.test.tsx: plain divs, no portal/animation.
vi.mock("vaul", () => {
  const Root = ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null;
  const Pass = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Content = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div {...rest}>{children}</div>
  );
  const Title = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  );
  const Description = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={className}>{children}</p>
  );
  return { Drawer: { Root, Portal: Pass, Content, Title, Description } };
});

function classes(el: Element | null | undefined): string[] {
  return (el?.getAttribute("class") ?? "").split(/\s+/);
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "tt-venue",
    name: "Touch Target Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "1 Main St, Pueblo, CO 81003",
    phone: "(719) 555-0233",
    source: "test",
    last_verified: "2026-09-01",
    ...overrides,
  };
}

const filterProps = {
  open: true,
  onClose: vi.fn(),
  resultCount: 3,
  filterOpenNow: false,
  onToggleOpenNow: vi.fn(),
  filterSnap: false,
  onToggleSnap: vi.fn(),
  filterWic: false,
  onToggleWic: vi.fn(),
  selectedCategories: null,
  onToggleCategory: vi.fn(),
  onClearAll: vi.fn(),
};

describe("SearchBar", () => {
  test("the input is 48px tall on phones (desktop keeps its 52px)", () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} />);
    const input = container.querySelector("input[type='search']");
    expect(classes(input)).toEqual(expect.arrayContaining(["h-12", "md:h-[52px]"]));
    expect(classes(input)).not.toContain("h-11");
  });

  test("the 44px Filters control carries a 2px-all-round overlay → 48×48", () => {
    render(
      <SearchBar value="" onChange={vi.fn()} filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }} />,
    );
    const btn = screen.getByRole("button", { name: "Filters" });
    expect(classes(btn)).toEqual(expect.arrayContaining(["before:absolute", "before:-inset-0.5"]));
  });
});

describe("FilterPanel", () => {
  test("Clear all keeps its text size but gets a 48px-tall overlay", () => {
    render(<FilterPanel {...filterProps} />);
    const btn = screen.getByRole("button", { name: "Clear all" });
    expect(classes(btn)).toEqual(
      expect.arrayContaining(["relative", "before:absolute", "before:inset-x-0", "before:-inset-y-3.5"]),
    );
  });

  test("the header spaces Clear all and × far enough apart for 8px between hit areas", () => {
    render(<FilterPanel {...filterProps} />);
    const close = screen.getByRole("button", { name: "Close filters" });
    expect(classes(close)).toEqual(expect.arrayContaining(["w-12", "h-12", "-m-2"]));
    expect(classes(close.parentElement)).toContain("gap-4");
  });

  test("each switch's overlay spans its whole 48px row, so the row label is tappable too", () => {
    render(<FilterPanel {...filterProps} />);
    for (const sw of screen.getAllByRole("switch")) {
      // No `relative` on the switch: the overlay must resolve against the row.
      expect(classes(sw)).toEqual(expect.arrayContaining(["before:absolute", "before:inset-0"]));
      expect(classes(sw)).not.toContain("relative");
      expect(classes(sw.parentElement)).toEqual(expect.arrayContaining(["relative", "min-h-12"]));
    }
  });

  test("every Kind-of-place row is at least 48px tall", () => {
    render(<FilterPanel {...filterProps} />);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.length).toBeGreaterThan(0);
    for (const cb of boxes) expect(classes(cb.closest("label"))).toContain("min-h-12");
  });

  test("the Show N places footer button is 48px tall", () => {
    render(<FilterPanel {...filterProps} />);
    expect(classes(screen.getByRole("button", { name: /Show 3 places/ }))).toContain("h-12");
  });
});

describe("HamburgerMenu", () => {
  test("close × is a 48×48 box", () => {
    render(<HamburgerMenu locale="en" open onClose={vi.fn()} />);
    expect(classes(screen.getByRole("button", { name: "Close menu" }))).toEqual(
      expect.arrayContaining(["w-12", "h-12", "-m-2"]),
    );
  });

  test("menu items (link and button forms) are at least 48px tall", () => {
    render(
      <ul>
        <HamburgerMenuItem label="A link" href="/about" />
        <HamburgerMenuItem label="A button" onClick={vi.fn()} />
      </ul>,
    );
    expect(classes(screen.getByRole("link", { name: "A link" }))).toContain("min-h-12");
    expect(classes(screen.getByRole("button", { name: "A button" }))).toContain("min-h-12");
  });

  test("Saved rows are at least 48px tall", () => {
    render(
      <HamburgerMenu
        locale="en"
        open
        onClose={vi.fn()}
        view="saved"
        savedVenues={[{ ...makeVenue(), distanceMiles: 0.4 }]}
      />,
    );
    expect(classes(screen.getByRole("button", { name: /Touch Target Pantry/ }))).toContain("min-h-12");
  });
});

describe("LanguageToggle", () => {
  test("the pill no longer clips (a clipped overlay can't be tapped)", () => {
    render(<LanguageToggle />);
    expect(classes(screen.getByRole("group"))).not.toContain("overflow-hidden");
  });

  test("each segment rounds its own outer end and reaches 48px tall, extending outward only", () => {
    render(<LanguageToggle />);
    for (const name of ["Language: English", "Language: Spanish"]) {
      expect(classes(screen.getByRole("button", { name }))).toEqual(
        expect.arrayContaining([
          "relative",
          "first:rounded-l-full",
          "last:rounded-r-full",
          "before:absolute",
          "before:inset-x-0",
          "before:-inset-y-[11px]",
          "first:before:-left-2.5",
          "last:before:-right-2.5",
        ]),
      );
    }
  });
});

describe("ListView", () => {
  test("OSM attribution link and the empty-state Clear filters button are 48px tall", () => {
    render(<ListView venues={[]} selectedVenueId={null} onSelect={vi.fn()} onClearFilters={vi.fn()} showClearFilters locale="en" />);
    expect(classes(screen.getByRole("link", { name: /OpenStreetMap/ }))).toContain("min-h-12");
    expect(classes(screen.getByRole("button", { name: /Clear filters/i }))).toContain("h-12");
  });
});

describe("Venue card controls", () => {
  test("Share and Save are 48×48 boxes", () => {
    render(
      <>
        <ShareButton venueId="v" venueName="V" locale="en" />
        <FavoriteButton venueId="v" venueName="V" locale="en" />
      </>,
    );
    for (const b of screen.getAllByRole("button")) expect(classes(b)).toEqual(expect.arrayContaining(["w-12", "h-12"]));
  });

  test("Walk / Bus / Drive are at least 48px tall", () => {
    render(<DirectionButtons venue={makeVenue()} onWalk={vi.fn()} locale="en" />);
    const walk = screen.getByRole("button", { name: /Walking directions/ });
    const bus = screen.getByRole("link", { name: /Bus directions/ });
    const drive = screen.getByRole("link", { name: /Drive directions/ });
    for (const el of [walk, bus, drive]) expect(classes(el)).toContain("min-h-12");
  });

  test("Report an issue keeps its 36px look with a 48px-tall overlay", () => {
    render(<ReportVenueButton venueId="v" locale="en" />);
    expect(classes(screen.getByRole("link"))).toEqual(
      expect.arrayContaining(["relative", "before:absolute", "before:inset-x-0", "before:-inset-y-[7px]"]),
    );
  });

  test("BottomSheet header: 48px close, 16px flex gap so Share/Save/× hit areas sit 8px apart", () => {
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close" });
    expect(classes(close)).toEqual(expect.arrayContaining(["w-12", "h-12", "-ml-1", "-mr-3"]));
    expect(classes(close.parentElement)).toContain("gap-4");
  });

  test("BottomSheet Show details overlay grows it to 48px without moving anything", () => {
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} />);
    expect(classes(screen.getByRole("button", { name: /Show details/ }))).toEqual(
      expect.arrayContaining(["relative", "before:absolute", "before:inset-x-0", "before:-top-1", "before:-bottom-3"]),
    );
  });

  test("BottomSheet phone link keeps min-h-11 and adds a 2px overlay → 48px", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Show details/ }));
    expect(classes(screen.getByRole("link", { name: /555-0233/ }))).toEqual(
      expect.arrayContaining(["relative", "before:absolute", "before:inset-x-0", "before:-inset-y-0.5"]),
    );
  });
});

describe("Share/Save rows elsewhere keep 8px between the enlarged hit areas", () => {
  const mapboxMap = {
    project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
  };
  const windowProps = {
    expanded: false,
    mapboxMap,
    onExpand: vi.fn(),
    onCollapse: vi.fn(),
    onClose: vi.fn(),
    locale: "en" as const,
  };
  const box: PublicBlessingBox = {
    ...makeVenue({ id: "tt-box", name: "TT Box" }),
    category: "blessing_box",
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
    },
  };

  test("DesktopVenueWindow venue header", () => {
    render(<DesktopVenueWindow venue={makeVenue()} {...windowProps} />);
    const share = screen.getByRole("button", { name: /Share Touch Target Pantry/ });
    expect(classes(share.parentElement)).toContain("gap-4");
  });

  test("box card actions row (BoxCardBody — phone sheet and desktop window both use it)", () => {
    render(<DesktopVenueWindow venue={box} box={box} {...windowProps} />);
    const share = screen.getByRole("button", { name: /Share TT Box/ });
    expect(classes(share.parentElement)).toContain("gap-4");
  });
});
