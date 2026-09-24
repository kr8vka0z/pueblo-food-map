/**
 * SiteFooter OSM attribution tests (#133 4.5).
 *
 * SiteFooter is shared by every non-map utility page (/venues, /about,
 * /privacy, /suggest, ...) — this proves the ODbL credit link renders with
 * the correct href in both locales.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import SiteFooter from "@/components/SiteFooter";
import { OSM_COPYRIGHT_URL } from "@/lib/osmAttribution";

describe("SiteFooter — OSM attribution", () => {
  test("renders an OpenStreetMap copyright link (EN)", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: t("osm.attribution", "en") });
    expect(link.getAttribute("href")).toBe(OSM_COPYRIGHT_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("renders the ES translation", () => {
    render(
      <LocaleProvider initialLocale="es">
        <SiteFooter />
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: t("osm.attribution", "es") })).toBeDefined();
  });
});
