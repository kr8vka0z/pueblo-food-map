/**
 * AdminNav.test.tsx — render coverage for the shared admin header/nav
 * (src/components/AdminNav.tsx). Fixture props only, no D1/auth — this
 * component takes everything it needs as props.
 *
 * #677 ("fold Photo review and Sponsor requests into the Blessing Boxes
 * tab"): "Photo review" and "Sponsor requests" are gone from this nav —
 * their queues folded into Blessing Boxes, whose own pill now carries their
 * combined count. Updated per that issue's own spec: "Neither nav item
 * remains."
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminNav from "@/components/AdminNav";
import { ZERO_ADMIN_NAV_COUNTS } from "@/lib/adminNavCounts";

describe("AdminNav", () => {
  test("renders the wordmark, signed-in email, and every nav link", () => {
    render(<AdminNav email="admin@example.com" active="dashboard" counts={ZERO_ADMIN_NAV_COUNTS} />);

    expect(screen.getByText("Pueblo Food Map Admin")).toBeDefined();
    expect(screen.getByText("admin@example.com")).toBeDefined();
    for (const label of ["Dashboard", "Blessing Boxes", "Places", "Review queue"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${label}`) })).toBeDefined();
    }
    // #674: "Data refresh" is gone — folded into Places.
    expect(screen.queryByRole("link", { name: /Data refresh/ })).toBeNull();
    // #677: "Photo review" / "Sponsor requests" are gone — folded into Blessing Boxes.
    expect(screen.queryByRole("link", { name: /Photo review/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Sponsor requests/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Add place" }).getAttribute("href")).toBe("/admin/venues/new");
  });

  test("marks the active tab with aria-current, and only that one", () => {
    render(<AdminNav email="a@b.com" active="boxes" counts={ZERO_ADMIN_NAV_COUNTS} />);

    const boxesLink = screen.getByRole("link", { name: /^Blessing Boxes/ });
    expect(boxesLink.getAttribute("aria-current")).toBe("page");
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.getAttribute("aria-current")).toBeNull();
  });

  test("shows a pending-count pill only when a queue's count is non-zero", () => {
    render(
      <AdminNav
        email="a@b.com"
        active="submissions"
        counts={{ submissions: 3, proposals: 7, photos: 0, adopters: 0 }}
      />,
    );

    expect(screen.getByRole("link", { name: /Review queue/ }).textContent).toContain("3");
    // #674: the "proposals" count (formerly Data refresh's own pill) now
    // shows on Places.
    expect(screen.getByRole("link", { name: /^Places/ }).textContent).toContain("7");
    // Zero photos AND zero adopters -> Blessing Boxes renders with no pill at all.
    expect(screen.getByRole("link", { name: "Blessing Boxes" }).textContent).toBe("Blessing Boxes");
  });

  test("Blessing Boxes' pill is the COMBINED photos+adopters count (#677)", () => {
    render(
      <AdminNav
        email="a@b.com"
        active="boxes"
        counts={{ submissions: 0, proposals: 0, photos: 2, adopters: 3 }}
      />,
    );

    expect(screen.getByRole("link", { name: /^Blessing Boxes/ }).textContent).toContain("5");
  });

  test("every nav href points at the right route", () => {
    render(<AdminNav email="a@b.com" active="dashboard" counts={ZERO_ADMIN_NAV_COUNTS} />);

    const hrefByLabel: Record<string, string> = {
      Dashboard: "/admin",
      "Blessing Boxes": "/admin/boxes",
      Places: "/admin/places",
      "Review queue": "/admin/submissions",
    };
    for (const [label, href] of Object.entries(hrefByLabel)) {
      expect(screen.getByRole("link", { name: new RegExp(`^${label}`) }).getAttribute("href")).toBe(href);
    }
  });
});
