/**
 * /es homepage crawl nav (#709): the Spanish "Sitio" nav links to the venue
 * directory, /es/resources, /es/about and the three SEO hub pages. HomePageClient
 * (map + splash) is stubbed; only the server-rendered nav is under test.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import EsHomePage from "@/app/es/page";

vi.mock("../app/(site)/HomePageClient", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

describe("/es homepage — Sitio nav", () => {
  test("links to the /es pages and the three /es hubs", () => {
    render(<EsHomePage />);
    const nav = screen.getByRole("navigation", { name: "Sitio" });
    const hrefs = within(nav).getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual([
      "/es/venues",
      "/es/resources",
      "/es/about",
      "/es/food-pantries",
      "/es/snap-wic-stores",
      "/es/community-gardens",
    ]);
  });
});
