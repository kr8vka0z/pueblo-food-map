/**
 * AdminConfirm.test.tsx — the on-page confirm's gate and keyboard paths:
 * nothing fires before the action button, Cancel is the safe first stop,
 * focus moves in and back out, Escape cancels, busy locks both buttons.
 */

import { describe, test, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import AdminConfirm, { useAdminConfirm, useAdminStep } from "@/components/AdminConfirm";

/** A reject-style step: a reason box, Cancel that clears it, and a busy flag. */
function StepHarness({ busy = false }: { busy?: boolean }) {
  const [reason, setReason] = useState("");
  function cancelStep() {
    setReason("");
    closeStep();
  }
  const { open, openStep, closeStep, triggerRef, fieldRef } = useAdminStep({ busy, onCancel: cancelStep });
  return (
    <div>
      <button type="button" ref={triggerRef} hidden={open} onClick={openStep}>
        Reject
      </button>
      {open && (
        <div>
          <label htmlFor="reason">Reason</label>
          <textarea id="reason" ref={fieldRef} value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" disabled={busy} onClick={cancelStep}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

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

  // A Reject / Remove photo / Decline step closes the same two ways, and
  // leaves no half-typed reason behind for the next time it opens.
  test.each([
    ["Cancel", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Cancel" }))],
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
  ])("%s closes a reason step, returns focus to its trigger and clears the reason", async (_name, close) => {
    const user = userEvent.setup();
    render(<StepHarness />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const box = screen.getByRole("textbox", { name: "Reason" });
    expect(box).toHaveFocus();
    await user.type(box, "dup");
    await close(user);
    expect(screen.queryByRole("textbox", { name: "Reason" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reject" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("textbox", { name: "Reason" })).toHaveValue("");
  });

  test("Escape does not close a reason step while its request runs", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StepHarness />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    rerender(<StepHarness busy />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reason" }), { key: "Escape" });
    expect(screen.getByRole("textbox", { name: "Reason" })).toBeInTheDocument();
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
