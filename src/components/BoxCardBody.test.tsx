/**
 * BoxCardBody tests (card redesign, 2026-09-19 — see this component's own
 * header, and the atlas-kb note "PFM AGENTS History — Blessing Boxes", for
 * the full as-built record; AGENTS.md itself was cut to a 150-line cap the
 * same day (#504) and no longer carries this history inline). Covers: the
 * status pill's "· filled {time}"/"·
 * Not marked filled yet" detail segment, the always-present sponsor band in
 * all three adopter-count states, the address-as-directions-link (and the
 * explicit absence of any DirectionButtons/Walk-Bus-Drive row on a box),
 * the removal of the public host NAME + "Host" heading (the note alone
 * survives), the History link/footer, the photo slot's full-bleed layout
 * with its overlaid caption chip, and the no-photo fallback (inline pill,
 * no <img>). Reuses BoxCheckinPanel.test.tsx's own Turnstile-stub
 * convention since BoxCardBody renders that panel directly (not mocked).
 *
 * The old "most recent check-in" describe block is GONE — the redesign
 * removed that block from the card entirely (spec item 5: "Remove the
 * 'Most recent check-in' block from the card"); box.box.recentCheckins is
 * no longer read by this component at all.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import BoxCardBody from "@/components/BoxCardBody";
import { googleMapsUrl } from "@/components/DirectionButtons";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const BASE_BOX: PublicBlessingBox = {
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
  },
};

function renderCard(box: Partial<PublicBlessingBox["box"]> = {}, showHistoryLink?: boolean) {
  const fullBox: PublicBlessingBox = { ...BASE_BOX, box: { ...BASE_BOX.box, ...box } };
  return render(
    <LocaleProvider initialLocale="en">
      <BoxCardBody box={fullBox} showHistoryLink={showHistoryLink} />
    </LocaleProvider>,
  );
}

describe("BoxCardBody — status pill", () => {
  test("renders the box's current status", () => {
    renderCard({ status: "empty" });
    const badge = screen.getByTestId("box-status-badge");
    expect(badge.textContent).toContain("Empty");
  });

  test("shows 'Not marked filled yet' as the pill's detail segment when lastFilledAt is null", () => {
    renderCard({ lastFilledAt: null });
    expect(screen.getByText(/not marked filled yet/i)).toBeDefined();
  });
});

describe("BoxCardBody — conditional sections", () => {
  test("most-needed section only renders when set", () => {
    const { rerender } = render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={{ ...BASE_BOX, box: { ...BASE_BOX.box, mostNeeded: null } }} />
      </LocaleProvider>,
    );
    expect(screen.queryByText("Most needed")).toBeNull();

    rerender(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={{ ...BASE_BOX, box: { ...BASE_BOX.box, mostNeeded: "Canned goods" } }} />
      </LocaleProvider>,
    );
    expect(screen.getByText("Most needed")).toBeDefined();
    expect(screen.getByText("Canned goods")).toBeDefined();
  });

  // ─── Needs ask (migration 0012) — "Most needed · from people who use
  // this box" self-fills when there's no admin-typed mostNeeded text. ────
  describe("BoxCardBody — neededFromVisitors (self-filling 'Most needed')", () => {
    test("renders the visitor-sourced list with counts when mostNeeded is unset", () => {
      renderCard({
        mostNeeded: null,
        neededFromVisitors: [
          { key: "canned_food", count: 6 },
          { key: "diapers", count: 4 },
        ],
      });
      expect(screen.getByText("Most needed · from people who use this box")).toBeDefined();
      expect(screen.getByText("Canned food")).toBeDefined();
      expect(screen.getByText("· 6")).toBeDefined();
      expect(screen.getByText("Diapers")).toBeDefined();
      expect(screen.getByText("· 4")).toBeDefined();
    });

    test("the admin-typed mostNeeded wins — the visitor-sourced block does not render alongside it", () => {
      renderCard({
        mostNeeded: "Canned goods",
        neededFromVisitors: [{ key: "canned_food", count: 6 }],
      });
      expect(screen.getByText("Most needed")).toBeDefined();
      expect(screen.queryByText("Most needed · from people who use this box")).toBeNull();
    });

    test("neither block renders when both are empty", () => {
      renderCard({ mostNeeded: null, neededFromVisitors: [] });
      expect(screen.queryByText("Most needed")).toBeNull();
      expect(screen.queryByText("Most needed · from people who use this box")).toBeNull();
    });

    test("neededFromVisitors omitted entirely (undefined) -> no crash, no visitor block", () => {
      expect(() => renderCard({ mostNeeded: null, neededFromVisitors: undefined })).not.toThrow();
      expect(screen.queryByText("Most needed · from people who use this box")).toBeNull();
    });
  });

  // Redesign spec item 4: "Remove the public host NAME and the 'Host'
  // heading entirely." Only the host's own note (when set) survives, as a
  // plain quiet line with no heading above it.
  test("never renders the host name, even when set — only the host note (no heading)", () => {
    const noHost = renderCard({ hostName: null, hostNote: null });
    expect(screen.queryByText("Host")).toBeNull();
    noHost.unmount();

    renderCard({ hostName: "Jane Doe", hostNote: "Ring the bell" });
    expect(screen.queryByText("Jane Doe")).toBeNull();
    expect(screen.queryByText("Host")).toBeNull();
    expect(screen.getByText("Ring the bell")).toBeDefined();
  });
});

describe("BoxCardBody — History link (footer)", () => {
  test("links to /box/<id>/history by default", () => {
    renderCard({});
    const link = screen.getByRole("link", { name: "History" });
    expect(link.getAttribute("href")).toBe("/box/test-box-1/history");
  });

  test("showHistoryLink={false} hides it (used where a caller already renders an equivalent link)", () => {
    renderCard({}, false);
    expect(screen.queryByRole("link", { name: "History" })).toBeNull();
  });
});

describe("BoxCardBody — address is the directions link, no orange button", () => {
  // Fix pass (2026-09-19, item 4): no preset travel mode — googleMapsUrl is
  // called with no third argument, so the deeplink carries no `travelmode`
  // param and Google Maps itself lets the visitor pick walk/bus/drive.
  test("the address text itself opens directions with no preset travel mode", () => {
    renderCard();
    const addressText = screen.getByText("123 Test St, Pueblo, CO");
    expect(addressText.tagName).toBe("A");
    expect(addressText.getAttribute("href")).toBe(googleMapsUrl(BASE_BOX.lat, BASE_BOX.lng));
    expect(addressText.getAttribute("href")).not.toContain("travelmode");
    expect(addressText.getAttribute("target")).toBe("_blank");
  });

  // Fix pass (2026-09-19, item 3, WCAG 2.5.3 label-in-name): the accessible
  // name must CONTAIN the visible address text, not just an unrelated
  // "Directions to <name>" phrase.
  test("the accessible name (aria-label) contains the visible address text", () => {
    renderCard();
    const addressText = screen.getByText("123 Test St, Pueblo, CO");
    const label = addressText.getAttribute("aria-label") ?? "";
    expect(label).toContain("123 Test St, Pueblo, CO");
  });

  test("no Walk/Bus/Drive DirectionButtons row renders on a box card", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: "Walk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bus" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Drive" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Drive" })).toBeNull();
  });
});

describe("BoxCardBody — sponsor band (always present, 3 adopter-count states)", () => {
  test("shows 'needs a sponsor' + adopt link when there are no approved adopters", () => {
    renderCard({ adopters: [] });
    expect(screen.getByText("This box needs a sponsor.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Apply to adopt this box" })).toBeDefined();
  });

  test("shows the single sponsor's name", () => {
    renderCard({ adopters: ["The Martinez Family"] });
    expect(screen.getByText(/sponsored by/i)).toBeDefined();
    expect(screen.getByText("The Martinez Family")).toBeDefined();
  });

  test("shows 'A and B' for exactly two sponsors", () => {
    renderCard({ adopters: ["The Martinez Family", "Jane Doe"] });
    const band = screen.getByText(/sponsored by/i).closest("p");
    expect(band?.textContent).toBe("Sponsored by The Martinez Family and Jane Doe");
  });

  test("shows 'A, B +N more' for three or more sponsors", () => {
    renderCard({ adopters: ["The Martinez Family", "Jane Doe", "Sam Lee", "Eastside Youth Group"] });
    const band = screen.getByText(/sponsored by/i).closest("p");
    expect(band?.textContent).toBe("Sponsored by The Martinez Family, Jane Doe +2 more");
  });

  test("the adopt link expands AdoptBoxForm in place", async () => {
    const user = userEvent.setup();
    renderCard();
    const trigger = screen.getByRole("button", { name: "Apply to adopt this box" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("textbox", { name: /your name/i })).toBeDefined();
  });
});

describe("BoxCardBody — email-me-when-it-needs-filling (footer)", () => {
  test("renders collapsed to a plain link", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Email me when it needs filling" })).toBeDefined();
  });
});

describe("BoxCardBody — photo slot (slice 5) and no-photo fallback", () => {
  test("renders the approved photo full-bleed with an overlaid status pill and caption chip", () => {
    renderCard({
      latestPhoto: { id: 42, createdAt: "2026-09-17T09:00:00.000Z" },
    });

    const img = screen.getByRole("img", { name: /photo of test blessing box/i });
    expect(img.getAttribute("src")).toBe("/api/public/box-photos/42");

    // Caption chip — "Photo · <relative time>"
    expect(screen.getByText(/photo ·/i)).toBeDefined();

    // Report control now lives in the check-in panel's quiet-links row, not
    // the photo slot itself — still rendered somewhere on the card.
    expect(screen.getByRole("button", { name: "Report this photo" })).toBeDefined();
  });

  test("no-photo layout: no <img>, the status pill renders inline instead of overlaid", () => {
    renderCard({ latestPhoto: null });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button", { name: "Report this photo" })).toBeNull();
    // The pill still renders (status badge testid), just not layered over a photo.
    expect(screen.getByTestId("box-status-badge")).toBeDefined();
  });
});
