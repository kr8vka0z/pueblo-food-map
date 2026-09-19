// @vitest-environment jsdom
/**
 * Tests for BoxActivityList (Blessing Boxes slice 3) — EN/ES line rendering,
 * the recent/older timestamp switch, detail-line rendering, and the empty
 * state. Same LocaleProvider pattern as BoxContent.test.tsx.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import BoxActivityList from "@/components/BoxActivityList";
import type { ActivityItem } from "@/lib/boxActivity";

const NOW = new Date("2026-09-17T12:00:00.000Z");

function makeItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    source: "checkin",
    kind: "filled",
    detail: null,
    photoId: null,
    createdAt: "2026-09-17T10:00:00.000Z", // 2h before NOW
    venueId: "box-1",
    venueName: "Blessing Box - 216 W Routt",
    venueAddress: "216 W Routt Ave",
    ...overrides,
  };
}

describe("BoxActivityList", () => {
  test("empty items -> the empty-state message, no list", () => {
    render(<BoxActivityList items={[]} showVenueName now={NOW} />);
    expect(screen.getByText("No activity to show yet.")).toBeInTheDocument();
  });

  test("a custom emptyMessageKey is honored", () => {
    render(<BoxActivityList items={[]} showVenueName={false} emptyMessageKey="activity.recentEmpty" now={NOW} />);
    expect(screen.getByText("No activity at this box yet.")).toBeInTheDocument();
  });

  test("showVenueName=true renders the real venue name in the line (EN)", () => {
    render(<BoxActivityList items={[makeItem()]} showVenueName now={NOW} />);
    expect(screen.getByText(/Blessing Box - 216 W Routt was filled/)).toBeInTheDocument();
  });

  test("showVenueName=false substitutes a generic 'This box' (per-box embed, D3)", () => {
    render(<BoxActivityList items={[makeItem()]} showVenueName={false} now={NOW} />);
    expect(screen.getByText(/This box was filled/)).toBeInTheDocument();
    expect(screen.queryByText(/216 W Routt/)).not.toBeInTheDocument();
  });

  test("Spanish locale renders the ES line template", () => {
    render(
      <LocaleProvider initialLocale="es">
        <BoxActivityList items={[makeItem()]} showVenueName now={NOW} />
      </LocaleProvider>,
    );
    expect(screen.getByText(/fue surtida/)).toBeInTheDocument();
  });

  test("a lifecycle event with a detail string renders the detail as a second line", () => {
    const item = makeItem({ source: "event", kind: "moved", detail: "Old Address → New Address" });
    render(<BoxActivityList items={[item]} showVenueName now={NOW} />);
    expect(screen.getByText(/moved/)).toBeInTheDocument();
    expect(screen.getByText("Old Address → New Address")).toBeInTheDocument();
  });

  test("a check-in never renders a detail line (detail is always null for checkins)", () => {
    const { container } = render(<BoxActivityList items={[makeItem({ detail: null })]} showVenueName now={NOW} />);
    // Only the one line paragraph; no second <p> for detail.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  test("an item within 7 days shows a relative time ('ago')", () => {
    render(<BoxActivityList items={[makeItem({ createdAt: "2026-09-17T10:00:00.000Z" })]} showVenueName now={NOW} />);
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  test("an item older than 7 days shows a short calendar date, not a relative time", () => {
    // Noon UTC, not midnight — a midnight-UTC timestamp renders as the
    // PRIOR day in any negative-offset timezone (e.g. Mountain Time,
    // CI/dev machines), which is correct client behavior, not a bug this
    // test should trip over.
    const oldItem = makeItem({ createdAt: "2026-08-01T12:00:00.000Z" });
    render(<BoxActivityList items={[oldItem]} showVenueName now={NOW} />);
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    expect(screen.getByText(/Aug 1/)).toBeInTheDocument();
  });

  test("multiple items each render their own line", () => {
    const items = [makeItem({ kind: "filled" }), makeItem({ kind: "took", createdAt: "2026-09-17T09:00:00.000Z" })];
    render(<BoxActivityList items={items} showVenueName now={NOW} />);
    expect(screen.getByText(/was filled/)).toBeInTheDocument();
    expect(screen.getByText(/Someone used/)).toBeInTheDocument();
  });

  // #511 — photo + sponsor entries (per-box history page only; see
  // boxActivity.ts's own header for why the global feed never sees these).
  describe("photo entries (#511)", () => {
    function makePhotoItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
      return makeItem({ source: "photo", kind: "photo_added", detail: null, photoId: 42, ...overrides });
    }

    test("renders the 'Photo added' line and a thumbnail sourced from the public serve route", () => {
      render(<BoxActivityList items={[makePhotoItem()]} showVenueName={false} now={NOW} />);
      expect(screen.getByText(/A new photo was added/)).toBeInTheDocument();
      const thumb = screen.getByRole("img") as HTMLImageElement;
      expect(thumb.src).toContain("/api/public/box-photos/42");
    });

    test("tapping the thumbnail opens the full-size PhotoViewer", async () => {
      const user = userEvent.setup();
      render(<BoxActivityList items={[makePhotoItem()]} showVenueName={false} now={NOW} />);
      await user.click(screen.getByRole("button", { name: /view photo full size/i }));
      const dialog = screen.getByRole("dialog") as HTMLDialogElement;
      expect(dialog.open).toBe(true);
    });

    test("a photo entry never renders a stray detail line (detail is always null on a photo row)", () => {
      const { container } = render(<BoxActivityList items={[makePhotoItem()]} showVenueName={false} now={NOW} />);
      expect(container.querySelectorAll("li p")).toHaveLength(1);
    });
  });

  describe("sponsor entries (#511)", () => {
    function makeSponsorItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
      return makeItem({ source: "sponsor", kind: "sponsor_added", detail: "Jane D.", photoId: null, ...overrides });
    }

    test("renders '<name> became a sponsor' using the sponsor's own display name, not the venue name", () => {
      render(<BoxActivityList items={[makeSponsorItem()]} showVenueName={false} now={NOW} />);
      expect(screen.getByText(/Jane D\. became a sponsor/)).toBeInTheDocument();
      expect(screen.queryByText(/This box became a sponsor/)).not.toBeInTheDocument();
    });

    test("does not duplicate the sponsor's name as a second detail line (detail already appears in the main line)", () => {
      const { container } = render(<BoxActivityList items={[makeSponsorItem()]} showVenueName={false} now={NOW} />);
      expect(container.querySelectorAll("li p")).toHaveLength(1);
    });
  });
});
