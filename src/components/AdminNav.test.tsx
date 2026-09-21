/**
 * AdminNav.test.tsx — render coverage for the shared admin header/nav
 * (src/components/AdminNav.tsx). Fixture props only, no D1/auth — this
 * component takes everything it needs as props.
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
    for (const label of ["Dashboard", "Blessing Boxes", "Places", "Review queue", "Data refresh", "Photo review", "Adoption requests"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${label}`) })).toBeDefined();
    }
    expect(screen.getByRole("link", { name: "Add place" }).getAttribute("href")).toBe("/admin/venues/new");
  });

  test("marks the active tab with aria-current, and only that one", () => {
    render(<AdminNav email="a@b.com" active="boxes" counts={ZERO_ADMIN_NAV_COUNTS} />);

    const boxesLink = screen.getByRole("link", { name: "Blessing Boxes" });
    expect(boxesLink.getAttribute("aria-current")).toBe("page");
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.getAttribute("aria-current")).toBeNull();
  });

  test("shows a pending-count pill only when a queue's count is non-zero", () => {
    render(
      <AdminNav
        email="a@b.com"
        active="submissions"
        counts={{ submissions: 3, proposals: 0, photos: 5, adopters: 0 }}
      />,
    );

    expect(screen.getByRole("link", { name: /Review queue/ }).textContent).toContain("3");
    expect(screen.getByRole("link", { name: /Photo review/ }).textContent).toContain("5");
    // Zero-count queues render with no pill at all — the link text is exactly the label.
    expect(screen.getByRole("link", { name: "Data refresh" }).textContent).toBe("Data refresh");
    expect(screen.getByRole("link", { name: "Adoption requests" }).textContent).toBe("Adoption requests");
  });

  test("every nav href points at the right route", () => {
    render(<AdminNav email="a@b.com" active="dashboard" counts={ZERO_ADMIN_NAV_COUNTS} />);

    const hrefByLabel: Record<string, string> = {
      Dashboard: "/admin",
      "Blessing Boxes": "/admin/boxes",
      Places: "/admin/places",
      "Review queue": "/admin/submissions",
      "Data refresh": "/admin/flags",
      "Photo review": "/admin/box-photos",
      "Adoption requests": "/admin/box-adopters",
    };
    for (const [label, href] of Object.entries(hrefByLabel)) {
      expect(screen.getByRole("link", { name: new RegExp(`^${label}`) }).getAttribute("href")).toBe(href);
    }
  });
});
