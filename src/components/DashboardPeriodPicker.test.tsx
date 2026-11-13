/**
 * DashboardPeriodPicker: choosing a period navigates to /admin with that
 * `period=` and keeps every other query value already in the address, by
 * pointer and by the arrow keys (real radios).
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
  test.each([
    ["a press", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("radio", { name: "90 days" }))],
    [
      "the arrow key",
      async (user: ReturnType<typeof userEvent.setup>) => {
        screen.getByRole("radio", { name: "30 days" }).focus();
        await user.keyboard("{ArrowRight}");
      },
    ],
  ])("%s moves to the new period, keeps the other query values and shows the choice at once", async (_how, act) => {
    window.history.replaceState(null, "", "/admin?period=30d&foo=1");
    const user = userEvent.setup();
    render(<DashboardPeriodPicker period="30d" options={OPTIONS} />);

    await act(user);

    expect(mockPush).toHaveBeenCalledTimes(1);
    const [href] = mockPush.mock.calls[0] as [string];
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/admin");
    expect(url.searchParams.get("period")).toBe("90d");
    expect(url.searchParams.get("foo")).toBe("1");
    expect(screen.getByRole("radio", { name: "90 days" })).toBeChecked();
  });
});
