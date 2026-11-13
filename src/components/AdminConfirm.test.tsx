/**
 * AdminConfirm.test.tsx — the on-page confirm's gate and keyboard paths:
 * nothing fires before the action button, Cancel is the safe first stop,
 * focus moves in and back out, Escape cancels, busy locks both buttons.
 */

import { describe, test, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminConfirm, { useAdminConfirm } from "@/components/AdminConfirm";

function Harness({
  onConfirm,
  onSubmit,
  busy = false,
}: {
  onConfirm: () => void;
  onSubmit?: () => void;
  busy?: boolean;
}) {
  const { asking, ask, cancel, triggerRef } = useAdminConfirm();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <button type="button" ref={triggerRef} hidden={asking} onClick={ask}>
        Remove from map
      </button>
      {asking && (
        <AdminConfirm
          title="Remove Eastside Pantry from the map?"
          confirmLabel="Remove from map"
          busyLabel="Removing…"
          tone="danger"
          busy={busy}
          onConfirm={onConfirm}
          onCancel={cancel}
        >
          Its record is kept.
        </AdminConfirm>
      )}
    </form>
  );
}

async function open(props: Parameters<typeof Harness>[0]) {
  const user = userEvent.setup();
  const utils = render(<Harness {...props} />);
  await user.click(screen.getByRole("button", { name: "Remove from map" }));
  const group = screen.getByRole("group", { name: "Remove Eastside Pantry from the map?" });
  return { user, group, ...utils };
}

describe("AdminConfirm", () => {
  test("opening does not act; the action button acts once and submits no surrounding form", async () => {
    const onConfirm = vi.fn();
    const onSubmit = vi.fn();
    const { user } = await open({ onConfirm, onSubmit });
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove from map" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("Cancel comes before the action button, takes focus on open, and Enter there cancels", async () => {
    const onConfirm = vi.fn();
    const { user, group } = await open({ onConfirm });
    const buttons = Array.from(group.querySelectorAll("button")).map((b) => b.textContent);
    expect(buttons).toEqual(["Cancel", "Remove from map"]);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("group")).toBeNull();
  });

  test.each([
    ["Cancel", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Cancel" }))],
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
  ])("%s closes it and returns focus to the trigger", async (_name, close) => {
    const onConfirm = vi.fn();
    const { user } = await open({ onConfirm });
    await close(user);
    expect(screen.queryByRole("group")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Remove from map" });
    expect(trigger).toBeVisible();
    expect(trigger).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("busy disables both buttons, shows the busy label, and Escape does not close", async () => {
    const onConfirm = vi.fn();
    const { group } = await open({ onConfirm, busy: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Removing…" })).toBeDisabled();
    // Fired on the group itself: with both buttons disabled nothing inside holds focus.
    fireEvent.keyDown(group, { key: "Escape" });
    expect(screen.getByRole("group")).toBeInTheDocument();
  });
});
