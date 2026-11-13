/**
 * DashboardPeriodPicker: choosing a period navigates to /admin with that
 * `period=` and keeps every other query value already in the address (the
 * arrow keys are AdminSegmented.test.tsx's: real radios).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import DashboardPeriodPicker from "@/components/DashboardPeriodPicker";

const OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

afterEach(() => {
  mockPush.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("DashboardPeriodPicker", () => {
  test("a press moves to the new period, keeps the other query values and shows the choice at once", async () => {
    window.history.replaceState(null, "", "/admin?period=30d&foo=1");
    const user = userEvent.setup();
    render(<DashboardPeriodPicker period="30d" options={OPTIONS} />);

    await user.click(screen.getByRole("radio", { name: "90 days" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const [href] = mockPush.mock.calls[0] as [string];
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/admin");
    expect(url.searchParams.get("period")).toBe("90d");
    expect(url.searchParams.get("foo")).toBe("1");
    expect(screen.getByRole("radio", { name: "90 days" })).toBeChecked();
  });
});
