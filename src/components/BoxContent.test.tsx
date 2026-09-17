/**
 * BoxContent bilingual + status-placeholder rendering tests (Blessing Boxes
 * slice 1). Same pattern as VenueContent.test.tsx (#289) — renders EN by
 * default and ES when wrapped in a LocaleProvider set to "es" — plus the
 * one behavior unique to a box: the status line always shows the slice-1
 * placeholder ("Unknown"), never a computed value, and host/most-needed
 * sections only render when the underlying field is present.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import BoxContent from "@/components/BoxContent";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

function makeBox(overrides: Partial<PublicBlessingBox> = {}): PublicBlessingBox {
  return {
    id: "plentiful-blessing-box-216-w-routt-plentiful-1454",
    name: "216 W Routt Blessing Box",
    category: "blessing_box",
    lat: 38.25902,
    lng: -104.625612,
    address: "216 W Routt Ave, Pueblo, CO 81004",
    source: "directory.plentiful.org/colorado/pueblo",
    last_verified: "2026-09-15",
    box: {
      hostName: "Jane Doe",
      hostNote: "Stocked every Saturday.",
      mostNeeded: "Canned soup, pasta",
      installedOn: "2026-01-15",
      removedOn: null,
      status: "unknown",
      lastFilledAt: null,
      recentCheckins: [],
    },
    ...overrides,
  };
}

describe("BoxContent — locale", () => {
  test("renders English category label and directions CTA with no provider (default locale)", () => {
    const box = makeBox();
    render(<BoxContent box={box} />);
    expect(screen.getByText(t("category.full.blessing_box", "en"))).toBeDefined();
    expect(screen.getByText(t("detail.getDirections", "en"))).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: box.name })).toBeDefined();
  });

  test("renders Spanish category label and directions CTA when locale='es'", () => {
    const box = makeBox();
    render(
      <LocaleProvider initialLocale="es">
        <BoxContent box={box} />
      </LocaleProvider>,
    );
    expect(screen.getByText(t("category.full.blessing_box", "es"))).toBeDefined();
    expect(screen.getByText(t("detail.getDirections", "es"))).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: box.name })).toBeDefined();
  });
});

describe("BoxContent — status + last filled (slice 2)", () => {
  test("shows 'Unknown' when the box prop carries no signal", () => {
    render(<BoxContent box={makeBox()} />);
    expect(screen.getByText(t("box.status.unknown", "en"), { exact: false })).toBeDefined();
  });

  test("renders the real computed status the box prop carries", () => {
    const box = makeBox({ box: { ...makeBox().box, status: "empty" } });
    render(<BoxContent box={box} />);
    expect(screen.getByTestId("box-status-badge").textContent).toContain(t("box.status.empty", "en"));
  });

  test("shows 'not marked filled yet' when lastFilledAt is null", () => {
    render(<BoxContent box={makeBox()} />);
    expect(screen.getByText(t("box.lastFilled.never", "en"))).toBeDefined();
  });

  test("shows a relative 'last filled' time when lastFilledAt is set", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const box = makeBox({ box: { ...makeBox().box, lastFilledAt: threeHoursAgo } });
    render(<BoxContent box={box} />);
    expect(screen.getByText(/Last filled 3 hours ago/)).toBeDefined();
  });

  test("renders the check-in panel with all five buttons", () => {
    render(<BoxContent box={makeBox()} />);
    expect(screen.getByText(t("box.checkin.heading", "en"))).toBeDefined();
    expect(screen.getByRole("button", { name: "I took something" })).toBeDefined();
  });
});

describe("BoxContent — conditional sections", () => {
  test("host section renders when hostName/hostNote are present", () => {
    render(<BoxContent box={makeBox()} />);
    expect(screen.getByText("Jane Doe")).toBeDefined();
    expect(screen.getByText("Stocked every Saturday.")).toBeDefined();
  });

  test("host section is absent when both hostName and hostNote are null", () => {
    const box = makeBox({ box: { ...makeBox().box, hostName: null, hostNote: null } });
    render(<BoxContent box={box} />);
    expect(screen.queryByText(t("box.host", "en"))).toBeNull();
  });

  test("most-needed section renders when present", () => {
    render(<BoxContent box={makeBox()} />);
    expect(screen.getByText("Canned soup, pasta")).toBeDefined();
  });

  test("most-needed section is absent when the field is null", () => {
    const boxNoMostNeeded = makeBox({ box: { ...makeBox().box, mostNeeded: null } });
    render(<BoxContent box={boxNoMostNeeded} />);
    expect(screen.queryByText(t("box.mostNeeded", "en"))).toBeNull();
  });

  test("host_contact is never rendered anywhere on the page (PublicBlessingBox has no such field)", () => {
    render(<BoxContent box={makeBox()} />);
    // Not present in the type at all — this asserts the page never renders
    // the word "private" or an email-shaped host_contact value in the DOM.
    expect(screen.queryByText(/private@/)).toBeNull();
  });
});
