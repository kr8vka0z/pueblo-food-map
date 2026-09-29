/**
 * loading.test.tsx — pins the admin route-segment loading state: the header
 * stays put while the next admin page renders on the server, and the
 * loading state is announced to assistive tech.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminLoading from "@/app/(site)/admin/loading";
import LoginLoading from "@/app/(site)/admin/login/loading";

describe("admin loading.tsx", () => {
  test("keeps the admin header and nav links visible, with no pills or active tab", () => {
    render(<AdminLoading />);

    expect(screen.getByText("Pueblo Food Map Admin")).toBeDefined();
    for (const label of ["Dashboard", "Blessing Boxes", "Places"]) {
      const link = screen.getByRole("link", { name: label });
      expect(link.getAttribute("aria-current")).toBeNull();
    }
    expect(screen.queryByText(/signed in as/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /activity/i })).toBeNull();
  });

  test("announces the busy state to assistive tech", () => {
    const { container } = render(<AdminLoading />);

    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });

  test("the login page opts out so the admin header never flashes over the sign-in form", () => {
    const { container } = render(<LoginLoading />);
    expect(container.innerHTML).toBe("");
  });
});
