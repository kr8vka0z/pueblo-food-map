/**
 * VenueContent phone + notes-suppression tests (fix/venue-page-phone-notes).
 *
 * New file, not an addition to VenueContent.test.tsx — this branch's write
 * guard refuses edits to a pre-existing test file, so these two independent
 * bugs get their own file instead of growing the locale-rendering one.
 *
 * Covers:
 *   1. VenueContent never rendered v.phone (BottomSheet/DesktopVenueWindow
 *      already do, via a `tel:` link) — 36 live venues have a phone.
 *   2. VenueContent rendered raw v.notes with no boilerplate guard, unlike
 *      BottomSheet/DesktopVenueWindow which both go through
 *      getDisplayNotes() (src/lib/venueNotes.ts) — so Plentiful's
 *      auto-generated "{name}. in Pueblo, CO. Phone: ..." filler leaked
 *      onto the standalone page even where the map card already hid it.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { t } from "@/lib/i18n";
import VenueContent from "@/components/VenueContent";
import type { Venue } from "@/types/venue";

const BASE_VENUE: Venue = {
  id: "test-venue",
  name: "Test Pantry",
  category: "pantry",
  lat: 38.27,
  lng: -104.6,
  address: "123 Test St, Pueblo, CO 81003",
  source: "manual",
  last_verified: "2026-09-01",
};

describe("VenueContent — phone", () => {
  test("renders a tap-to-call tel: link when venue.phone is set", () => {
    render(<VenueContent venue={{ ...BASE_VENUE, phone: "(719) 555-0100" }} />);
    const link = screen.getByRole("link", { name: /555-0100/ });
    expect(link.getAttribute("href")).toBe("tel:(719) 555-0100");
  });

  test("renders no phone section when venue.phone is absent", () => {
    render(<VenueContent venue={BASE_VENUE} />);
    expect(screen.queryByText(t("detail.contact", "en"))).toBeNull();
    expect(screen.queryByRole("link", { name: /tel:/ })).toBeNull();
  });
});

describe("VenueContent — notes suppression", () => {
  test("suppresses Plentiful auto-generated boilerplate notes", () => {
    render(
      <VenueContent
        venue={{
          ...BASE_VENUE,
          phone: "(719) 546-1271",
          notes: "Test Pantry. in Pueblo, CO. Phone: (719) 546-1271.",
        }}
      />,
    );
    expect(screen.queryByText(t("detail.about", "en"))).toBeNull();
  });

  test("still renders a real, informative note", () => {
    render(
      <VenueContent
        venue={{ ...BASE_VENUE, notes: "ID required at the door." }}
      />,
    );
    expect(screen.getByText("ID required at the door.")).toBeDefined();
  });
});

describe("tap target — phone link floors to 44px (mobile review convention)", () => {
  test("tel: link carries min-h-11 (Tailwind 44px), unlike BottomSheet/DesktopVenueWindow's own unfloored phone anchor", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/VenueContent.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/flex items-center gap-2\.5 min-h-11 text-sm/);
  });
});
