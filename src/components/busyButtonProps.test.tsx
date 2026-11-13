/**
 * busyButtonProps.test.tsx — a working button stays focusable but does
 * nothing (#926): its own onClick never runs, and a busy submit button sends
 * no form, whether pressed or reached by Enter in a field. This is the gate a
 * natively disabled button used to give.
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { busyButtonProps } from "@/components/formClasses";

function Harness({ busy, onPress, onSubmit }: { busy: boolean; onPress: () => void; onSubmit: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="box">Name</label>
      <input id="box" />
      <button type="submit" {...busyButtonProps(busy)}>
        Save
      </button>
      <button type="button" onClick={onPress} {...busyButtonProps(busy)}>
        Find location
      </button>
    </form>
  );
}

describe("busyButtonProps", () => {
  test.each([
    [true, 0],
    [false, 1],
  ])("busy %s: a press, a submit press and Enter in a field act %i time(s)", async (busy, times) => {
    const onPress = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness busy={busy} onPress={onPress} onSubmit={onSubmit} />);

    const find = screen.getByRole("button", { name: "Find location" });
    await user.click(find);
    expect(find).toHaveFocus();
    expect(onPress).toHaveBeenCalledTimes(times);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(times);
    await user.type(screen.getByRole("textbox", { name: "Name" }), "x{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(times * 2);
  });
});
