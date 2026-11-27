/**
 * Regression guards for public-site design polish (#957, #958, #959):
 *   - LinkifyText turns emails, 2-1-1, 898-211, 10-digit phones, and bare domains into real links
 *   - Public EN/ES copy has zero prose em-dashes (except box.stats.noData)
 *   - AdoptBoxForm & BoxAlertSignupForm use inline validation (noValidate) instead of native browser popups
 *   - VenueContent places CategoryLabel below <h1> (no uppercase eyebrow above)
 *   - EventPage avoids two competing filled primary CTAs when active
 *   - HomeShell skip-link z-index clears bottom nav, SplashScreen uses px-4, VenueMarker uses CSS hover class
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import LinkifyText from "@/components/LinkifyText";
import AdoptBoxForm from "@/components/AdoptBoxForm";
import BoxAlertSignupForm from "@/components/BoxAlertSignupForm";
import VenueContent from "@/components/VenueContent";
import EventPage from "@/components/EventPage";
import { LocaleProvider } from "@/lib/LocaleContext";
import { I18N_DICTIONARIES } from "@/lib/i18n";
import { serverEn, serverEs } from "@/lib/i18n.server";
import type { Venue } from "@/types/venue";
import type { PublicEventDetail } from "@/lib/events";

vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

describe("LinkifyText (#958)", () => {
  test("linkifies emails, 2-1-1, 898-211, 10-digit phones, and bare domains without altering plain textContent", () => {
    const raw =
      "Email hello@pueblofoodmap.com, call 2-1-1 or 855-855-4626, text 898-211, or visit coloradowicsignup.com.";
    const { container } = render(<p><LinkifyText text={raw} /></p>);

    expect(container.querySelector("p")?.textContent).toBe(raw);
    expect(screen.getByRole("link", { name: "hello@pueblofoodmap.com" }).getAttribute("href")).toBe(
      "mailto:hello@pueblofoodmap.com",
    );
    expect(screen.getByRole("link", { name: "2-1-1" }).getAttribute("href")).toBe("tel:211");
    expect(screen.getByRole("link", { name: "855-855-4626" }).getAttribute("href")).toBe("tel:+18558554626");
    expect(screen.getByRole("link", { name: "898-211" }).getAttribute("href")).toBe("sms:898211");
    expect(screen.getByRole("link", { name: "coloradowicsignup.com" }).getAttribute("href")).toBe(
      "https://coloradowicsignup.com",
    );
  });
});

describe("Public i18n em-dash ban (#958)", () => {
  test("EN and ES dictionaries (client + server) contain zero prose em-dashes (except box.stats.noData)", () => {
    const allowed = new Set(["box.stats.noData"]);
    const allEn = { ...I18N_DICTIONARIES.en, ...serverEn };
    const allEs = { ...I18N_DICTIONARIES.es, ...serverEs };
    const enOffenders = Object.entries(allEn)
      .filter(([k, v]) => !allowed.has(k) && v.includes("—"))
      .map(([k]) => k);
    const esOffenders = Object.entries(allEs)
      .filter(([k, v]) => !allowed.has(k) && v.includes("—"))
      .map(([k]) => k);
    expect(enOffenders).toEqual([]);
    expect(esOffenders).toEqual([]);
  });
});

describe("Card forms inline validation (#959)", () => {
  test("AdoptBoxForm validates name and email inline on submit and moves focus to the first invalid input", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider initialLocale="en">
        <AdoptBoxForm boxId="box-1" open onOpenChange={vi.fn()} />
      </LocaleProvider>,
    );
    await user.click(screen.getByRole("button", { name: /Send application/i }));

    expect(screen.getByText(/Please enter your name/i)).toBeDefined();
    expect(screen.getByText(/Please enter your email address/i)).toBeDefined();
    expect(document.activeElement).toBe(document.getElementById("adopt-display-name"));
  });

  test("BoxAlertSignupForm validates email inline on submit and moves focus to the email input", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider initialLocale="en">
        <BoxAlertSignupForm boxId="box-1" />
      </LocaleProvider>,
    );
    await user.click(screen.getByRole("button", { name: /Email me when it needs filling/i }));
    await user.type(screen.getByLabelText(/Your email/i), "bad-email");
    await user.click(screen.getByRole("button", { name: /Sign me up/i }));

    expect(screen.getByText(/valid email address/i)).toBeDefined();
    expect(document.activeElement).toBe(document.getElementById("box-alert-email"));
  });
});

describe("VenueContent and EventPage hierarchy (#958)", () => {
  const venue: Venue = {
    id: "v-1",
    name: "Test Pantry",
    category: "pantry",
    lat: 38.27,
    lng: -104.61,
    address: "100 Main St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-05-01",
  };

  test("VenueContent renders CategoryLabel after <h1>, with no uppercase eyebrow above", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <VenueContent venue={venue} />
      </LocaleProvider>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Test Pantry" });
    const header = h1.closest("header")!;
    expect(header.firstElementChild).toBe(h1);
    expect(container.querySelector("header")?.textContent).toContain("Food Pantry");
  });

  test("EventPage gives active events only one filled primary CTA (Get directions)", () => {
    const event: PublicEventDetail = {
      id: "ev-1",
      name: "Turkey Giveaway",
      name_es: null,
      host: "Pueblo Food Project",
      host_es: null,
      description: "Free turkeys for Pueblo neighbors.",
      description_es: null,
      what_to_bring: null,
      what_to_bring_es: null,
      starts_at: "2099-11-22T17:00:00.000Z",
      ends_at: "2099-11-22T20:00:00.000Z",
      address: "100 Main St, Pueblo, CO 81003",
      lat: 38.27,
      lng: -104.61,
      venue_id: null,
      link_url: null,
      status: "published",
      cancel_note: null,
      cancel_note_es: null,
    };
    render(<EventPage event={event} locale="en" nowMs={Date.parse("2099-11-20T12:00:00.000Z")} />);
    const mapLink = screen.getByRole("link", { name: /Open on the map/i });
    const dirLink = screen.getByRole("link", { name: /Get directions/i });
    expect(dirLink.className).toContain("bg-[var(--color-event-pin)]");
    expect(mapLink.className).not.toContain("bg-[var(--color-sage-600)]");
    expect(mapLink.className).toContain("border-[var(--color-sage-600)]");
  });
});

describe("CSS & layout foundations (#957)", () => {
  test("HomeShell skip-link clears bottom nav, SplashScreen uses px-4, VenueMarker uses CSS hover class", () => {
    const homeShell = readFileSync(join(process.cwd(), "src/components/HomeShell.tsx"), "utf-8");
    const splash = readFileSync(join(process.cwd(), "src/components/SplashScreen.tsx"), "utf-8");
    const marker = readFileSync(join(process.cwd(), "src/components/VenueMarker.tsx"), "utf-8");

    expect(homeShell).toContain("focus:z-[9600]");
    expect(splash).toContain("px-4");
    expect(marker).toContain("pfm-venue-pin");
    expect(marker).toContain("pfm-venue-pin__body");
    expect(marker).not.toContain("scale(1.12)");
  });
});
