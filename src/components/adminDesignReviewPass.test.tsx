/**
 * Regression tests for the admin design-library pass:
 *   - AdminNav skip link + landmarks (AdminLoading outside <main>)
 *   - DashboardNeedsStrip tappable chevron cue vs flat KpiCard (no card-in-card)
 *   - PublishPanel removals-only confirm wording + AdminSuccessTick on publish
 *   - EventForm per-action busy label ("Publishing…" on Publish, not "Saving…" on Save draft)
 *   - AddVenueForm & EventForm beforeunload dirty guard + on-blur validation
 *   - AddVenueForm blessing-box return href + folded Hours/SNAP/WIC disclosure
 *   - ArchiveVenueButton custom afterArchiveHref (/admin/boxes)
 *   - VenueListView & AllBoxesTable URL query-param sync + folded StatusKey / SourceSwitchList
 *   - formatSubmittedAt pinned to Pueblo time (America/Denver) for SSR/client parity
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}));

import AdminNav from "@/components/AdminNav";
import AdminLoading from "@/app/(site)/admin/loading";
import DashboardNeedsStrip from "@/components/DashboardNeedsStrip";
import KpiCard from "@/components/KpiCard";
import PublishPanel from "@/components/PublishPanel";
import EventForm from "@/components/EventForm";
import AddVenueForm from "@/components/AddVenueForm";
import ArchiveVenueButton from "@/components/ArchiveVenueButton";
import VenueListView from "@/components/VenueListView";
import AllBoxesTable from "@/components/AllBoxesTable";
import ActivityLog from "@/components/ActivityLog";
import { buildActivityDays } from "@/lib/activityLog";
import { SourceSwitchList } from "@/components/SourceSwitchPanel";
import { formatSubmittedAt } from "@/lib/adminCardStyles";
import type { AdminVenueRow } from "@/types/venue";
import type { BoxHealthEntry } from "@/lib/boxHealth";

const mockFetch = vi.fn();

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockRefresh.mockReset();
  mockFetch.mockReset();
  mockSearchParams = new URLSearchParams();
  vi.stubGlobal("fetch", mockFetch);
  window.history.replaceState(null, "", "/admin/places");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeVenue(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "v1",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Manual entry",
    last_verified: "2026-07-03",
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-07-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: "2026-07-01T00:00:00.000Z",
    published_by: "admin@pueblofoodmap.com",
    ...overrides,
  };
}

function makeBox(overrides: Partial<BoxHealthEntry> = {}): BoxHealthEntry {
  return {
    venueId: "box-1",
    name: "Riverside Box",
    address: "100 River St",
    lat: 38.25,
    lng: -104.6,
    health: { status: "empty", latest: null, daysSinceLastReport: 2 },
    sponsors: [],
    removedOn: null,
    ...overrides,
  };
}

describe("Admin shell, nav, loading skeleton, and dashboard surfaces", () => {
  test("AdminNav renders a Skip to main content link pointing at #admin-main", () => {
    render(
      <AdminNav
        email="admin@pueblofoodmap.com"
        active="dashboard"
        counts={{ submissions: 0, proposals: 0, photos: 0, adopters: 0 }}
      />,
    );
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveAttribute("href", "#admin-main");
  });

  test("AdminLoading keeps header outside <main id='admin-main' aria-busy='true'> and renders bone-tinted shimmer blocks", () => {
    const { container } = render(<AdminLoading />);
    const main = container.querySelector("main#admin-main");
    const header = container.querySelector("header");
    expect(main).not.toBeNull();
    expect(header).not.toBeNull();
    expect(main?.contains(header!)).toBe(false);
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".pfm-skeleton").length).toBeGreaterThanOrEqual(8);
  });

  test("DashboardNeedsStrip renders a directional chevron icon cue on each clickable card", () => {
    render(
      <DashboardNeedsStrip
        cards={[{ key: "review", label: "Places to review", count: 3, href: "/admin/places?show=review" }]}
      />,
    );
    const link = screen.getByRole("link", { name: /Places to review/ });
    expect(link.querySelector("svg")).not.toBeNull();
  });

  test("KpiCard uses a flat bone-50 tile (no nested card elevation or border)", () => {
    const { container } = render(<KpiCard label="Visitors" displayValue="1,204" value={1204} />);
    const tile = container.firstElementChild;
    expect(tile?.className).toContain("bg-[var(--color-bone-50)]");
    expect(tile?.className).not.toContain("elevation-1");
  });
});

describe("PublishPanel removals-only confirm and success tick", () => {
  test("removals-only summary asks to remove places instead of publishing 0 new and 0 edited", async () => {
    const user = userEvent.setup();
    render(<PublishPanel summary={{ newDrafts: 0, editedSincePublish: 0, archived: 2 }} />);
    await user.click(screen.getByRole("button", { name: /^publish$/i }));
    expect(screen.getByRole("group", { name: "Remove 2 places from the public map?" })).toBeInTheDocument();
  });

  test("successful publish renders the restrained AdminSuccessTick SVG", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        ok: true,
        prUrl: "https://github.com/kr8vka0z/pueblo-food-map/pull/99",
        prNumber: 99,
        reused: false,
        publishedCount: 1,
        archivedCount: 0,
        snapshotCount: 10,
      }),
    });
    const user = userEvent.setup();
    const { container } = render(<PublishPanel summary={{ newDrafts: 1, editedSincePublish: 0, archived: 0 }} />);
    await user.click(screen.getByRole("button", { name: /^publish$/i }));
    await user.click(screen.getByRole("button", { name: /^publish$/i }));
    await screen.findByText(/Published:/);
    expect(container.querySelector("svg.pfm-success-tick")).not.toBeNull();
  });
});

describe("EventForm busy button labeling and beforeunload guard", () => {
  test("pressing Publish shows 'Publishing…' on Publish while keeping 'Save draft' unchanged", async () => {
    let resolveFetch!: (v: unknown) => void;
    mockFetch.mockReturnValueOnce(new Promise((r) => (resolveFetch = r)));
    const user = userEvent.setup();
    render(
      <EventForm
        venues={[]}
        initialValues={{
          name: "Food giveaway",
          startsLocal: "2026-12-01T10:00",
          endsLocal: "2026-12-01T12:00",
          address: "100 Main St, Pueblo, CO",
          lat: "38.25",
          lng: "-104.60",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(screen.getByRole("button", { name: "Publishing…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();

    resolveFetch({ status: 201, json: async () => ({ id: "evt-1", status: "published", updated_at: "2026-12-01T00:00:00.000Z" }) });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/events/evt-1/edit?saved=1"));
  });

  test("dirty EventForm attaches a beforeunload listener", async () => {
    const user = userEvent.setup();
    render(<EventForm venues={[]} />);
    await user.type(screen.getByLabelText(/^Name \(English\)/), "Holiday drive");

    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("AddVenueForm & ArchiveVenueButton blessing-box flow, blur validation, and dirty guard", () => {
  test("blessing box edit folds Hours/SNAP/WIC in a closed disclosure and Cancel links to defaultReturnHref", () => {
    const { container } = render(
      <AddVenueForm
        venueId="box-1"
        initialValues={{ name: "Park Box", category: "blessing_box", address: "1 Park Way", lat: "38.25", lng: "-104.6" }}
        defaultReturnHref="/admin/boxes"
      />,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/admin/boxes");
  });

  test("validates required fields on blur and warns on beforeunload when dirty", async () => {
    const user = userEvent.setup();
    render(<AddVenueForm />);

    const nameInput = screen.getByLabelText(/^Name/);
    await user.click(nameInput);
    await user.tab();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();

    await user.type(nameInput, "New Pantry");
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("ArchiveVenueButton navigates to afterArchiveHref after archiving a blessing box", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const user = userEvent.setup();
    render(
      <ArchiveVenueButton
        venueId="box-1"
        venueName="Park Box"
        alreadyArchived={false}
        kind="box"
        afterArchiveHref="/admin/boxes"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove from map" }));
    await user.click(screen.getByRole("button", { name: "Remove from map" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/boxes"));
  });
});

describe("List URL syncing and folded secondary panels", () => {
  test("VenueListView folds StatusKey in a closed <details> and syncs filters to the URL", async () => {
    const user = userEvent.setup();
    const venues = [
      makeVenue({ id: "v1", name: "Alpha Pantry", status: "published" }),
      makeVenue({ id: "v2", name: "Beta Draft", status: "draft" }),
    ];
    const { container } = render(
      <VenueListView venues={venues} statusByVenueId={{ v1: "live", v2: "draft" }} />,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);

    await user.click(screen.getByRole("button", { name: /^Draft \(1\)/ }));
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: "Beta" } });

    await waitFor(() => {
      expect(window.location.search).toContain("status=draft");
      expect(window.location.search).toContain("q=Beta");
    });
  });

  test("AllBoxesTable uses type='search' and syncs status/sort/search to the URL", async () => {
    window.history.replaceState(null, "", "/admin/boxes");
    const user = userEvent.setup();
    const entries = [makeBox(), makeBox({ venueId: "box-2", name: "Eastside Box", health: { status: "ok", latest: null, daysSinceLastReport: 1 } })];
    render(<AllBoxesTable entries={entries} />);

    const searchInput = screen.getByLabelText(/Search boxes/i);
    expect(searchInput).toHaveAttribute("type", "search");

    await user.click(screen.getByRole("button", { name: /^Empty \(1\)/ }));
    await user.selectOptions(screen.getByLabelText(/^Sort$/i), "name");

    await waitFor(() => {
      expect(window.location.search).toContain("status=empty");
      expect(window.location.search).toContain("sort=name");
    });
  });

  test("AllBoxesTable re-syncs when navigating back to the initial ?show=review URL after a local filter change", async () => {
    window.history.replaceState(null, "", "/admin/boxes?show=review");
    mockSearchParams = new URLSearchParams("show=review");
    const user = userEvent.setup();
    const entries = [makeBox({ venueId: "box-1", name: "Review Box" }), makeBox({ venueId: "box-2", name: "Plain Box" })];
    const reviewByVenueId = {
      "box-1": { photo: { id: 1, status: "pending" as const, flagCount: 0 } },
    };
    const { rerender } = render(
      <AllBoxesTable entries={entries} reviewByVenueId={reviewByVenueId} initialShowReview />,
    );
    expect(screen.getByRole("button", { name: "To review (1)" })).toHaveAttribute("aria-pressed", "true");

    // Click All locally (updates URL via replaceState to bare /admin/boxes,
    // which vinext's patched replaceState forwards to useSearchParams).
    await user.click(screen.getByRole("button", { name: "All (2)" }));
    expect(screen.getByRole("button", { name: "All (2)" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(window.location.search).toBe(""));
    mockSearchParams = new URLSearchParams("");
    rerender(<AllBoxesTable entries={entries} reviewByVenueId={reviewByVenueId} initialShowReview />);
    expect(screen.getByRole("button", { name: "All (2)" })).toHaveAttribute("aria-pressed", "true");

    // Simulate clicking "Show them" (<Link href="/admin/boxes?show=review">):
    // server props are identical (initialShowReview=true), but live searchParams change back.
    window.history.replaceState(null, "", "/admin/boxes?show=review");
    mockSearchParams = new URLSearchParams("show=review");
    rerender(<AllBoxesTable entries={entries} reviewByVenueId={reviewByVenueId} initialShowReview />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "To review (1)" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  test("VenueListView resets local filters when navigating back to bare /admin/places", async () => {
    window.history.replaceState(null, "", "/admin/places");
    mockSearchParams = new URLSearchParams();
    const user = userEvent.setup();
    const venues = [
      makeVenue({ id: "v1", name: "Alpha Pantry", status: "published" }),
      makeVenue({ id: "v2", name: "Beta Draft", status: "draft" }),
    ];
    const { rerender } = render(
      <VenueListView venues={venues} statusByVenueId={{ v1: "live", v2: "draft" }} />,
    );

    await user.click(screen.getByRole("button", { name: /^Draft \(1\)/ }));
    expect(screen.getByRole("button", { name: /^Draft \(1\)/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(window.location.search).toBe("?status=draft"));
    mockSearchParams = new URLSearchParams("status=draft");
    rerender(<VenueListView venues={venues} statusByVenueId={{ v1: "live", v2: "draft" }} />);
    expect(screen.getByRole("button", { name: /^Draft \(1\)/ })).toHaveAttribute("aria-pressed", "true");

    // Simulate clicking the Places nav tab (<Link href="/admin/places">):
    // server props are still the bare defaults, while live searchParams drop ?status=draft.
    window.history.replaceState(null, "", "/admin/places");
    mockSearchParams = new URLSearchParams();
    rerender(<VenueListView venues={venues} statusByVenueId={{ v1: "live", v2: "draft" }} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All places (2)" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  test("SourceSwitchList starts folded inside a closed <details>", () => {
    const { container } = render(
      <SourceSwitchList states={[{ source: "care_and_share", field: "phone", streak: 2, on: false }]} />,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
  });
});

describe("Hydration-safe Pueblo timestamp formatting & valid ActivityLog HTML", () => {
  test("formatSubmittedAt renders in America/Denver (MDT/MST), not UTC", () => {
    // 2026-07-02T01:30:00Z is July 1, 7:30 PM MDT in Pueblo.
    expect(formatSubmittedAt("2026-07-02T01:30:00.000Z")).toBe("Jul 1, 2026, 7:30 PM");
  });

  test("ActivityLog renders maskable IP <details> inside a <div>, never inside a <p>", () => {
    const days = buildActivityDays({
      actions: [],
      sessionHeaders: [],
      events: [
        {
          id: 1,
          created_at: "2026-07-02T01:30:00.000Z",
          email: "admin@pueblofoodmap.com",
          user_id: "u-1",
          session_id: "sess-1",
          event: "sign_in",
          method: "passkey",
          ip: "192.0.2.42",
          user_agent: "Mozilla/5.0",
          city: "Pueblo",
          region: "CO",
          country: "US",
          detail_json: null,
        },
      ],
    });
    const { container } = render(
      <ActivityLog
        days={days}
        filters={{ person: "", type: "all", from: "", to: "", q: "" }}
        people={["admin@pueblofoodmap.com"]}
        olderHref={null}
      />,
    );
    expect(container.querySelector("details")).not.toBeNull();
    expect(container.querySelector("p details")).toBeNull();
  });
});
