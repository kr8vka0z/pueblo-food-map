/**
 * AdminRowMenu.test.tsx — the three-dot menu's keyboard and pointer paths
 * (menu-button pattern) and its accessible name built from visible text.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminRowMenu from "@/components/AdminRowMenu";

function setup() {
  const draft = vi.fn();
  const dismiss = vi.fn();
  const user = userEvent.setup();
  render(
    <div>
      <h3 id="item-name">Community Soup Night</h3>
      <AdminRowMenu
        labelledBy="item-name"
        items={[
          { label: "Dismiss", onSelect: dismiss, danger: true },
          { label: "Make it a draft event", onSelect: draft },
        ]}
      />
      <button type="button">Elsewhere</button>
    </div>,
  );
  const button = screen.getByRole("button", { name: "More actions for Community Soup Night" });
  return { user, button, draft, dismiss };
}

const items = () => screen.getAllByRole("menuitem");

describe("AdminRowMenu", () => {
  test("its name includes the visible item name, and the danger item renders last", async () => {
    const { user, button } = setup();
    await user.click(button);
    expect(items().map((i) => i.textContent)).toEqual(["Make it a draft event", "Dismiss"]);
  });

  test.each([
    ["click", async (user: ReturnType<typeof userEvent.setup>, b: HTMLElement) => user.click(b)],
    ["Enter", async (user: ReturnType<typeof userEvent.setup>, b: HTMLElement) => (b.focus(), user.keyboard("{Enter}"))],
    ["Space", async (user: ReturnType<typeof userEvent.setup>, b: HTMLElement) => (b.focus(), user.keyboard(" "))],
    ["ArrowDown", async (user: ReturnType<typeof userEvent.setup>, b: HTMLElement) => (b.focus(), user.keyboard("{ArrowDown}"))],
  ])("opens by %s with focus on the first item", async (_how, openIt) => {
    const { user, button } = setup();
    await openIt(user, button);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(items()[0]).toHaveFocus();
  });

  test("ArrowUp opens on the last item; arrows wrap; Home and End jump", async () => {
    const { user, button } = setup();
    button.focus();
    await user.keyboard("{ArrowUp}");
    expect(items()[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items()[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(items()[1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(items()[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(items()[1]).toHaveFocus();
  });

  test("Escape closes and refocuses the button", async () => {
    const { user, button } = setup();
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
  });

  test("choosing an item calls its onSelect once, closes, and refocuses the button", async () => {
    const { user, button, draft, dismiss } = setup();
    await user.click(button);
    await user.click(screen.getByRole("menuitem", { name: "Dismiss" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(draft).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
  });

  test("a press outside closes it without choosing", async () => {
    const { user, button, draft, dismiss } = setup();
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(draft).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
