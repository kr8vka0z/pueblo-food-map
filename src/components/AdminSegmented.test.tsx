/**
 * AdminSegmented.test.tsx — the slider is a real, named radio group that
 * reports the chosen value.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminSegmented from "@/components/AdminSegmented";

const options = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

describe("AdminSegmented", () => {
  test("one radio per option in a group named by the legend; the checked one matches value", () => {
    render(<AdminSegmented name="period" legend="Period" options={options} value="30" onChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Period" });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    radios.forEach((r) => expect(group).toContainElement(r));
    expect(screen.getByRole("radio", { name: "30 days" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "7 days" })).not.toBeChecked();
  });

  test.each([
    ["clicking it", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByText("90 days"))],
    ["the arrow key", async (user: ReturnType<typeof userEvent.setup>) => {
      screen.getByRole("radio", { name: "30 days" }).focus();
      await user.keyboard("{ArrowRight}");
    }],
  ])("choosing another option by %s calls onChange with its value", async (_how, choose) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AdminSegmented name="period" legend="Period" options={options} value="30" onChange={onChange} />);
    await choose(user);
    expect(onChange).toHaveBeenCalledWith("90");
  });
});
