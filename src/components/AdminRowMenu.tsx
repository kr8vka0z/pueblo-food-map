"use client";

/**
 * AdminRowMenu — the three-dot menu for a list item with two or more
 * actions (#926 decision 9; picture: dotsMenu in
 * docs/design/design-system/pages/03c-components-admin.ts, `.pa-dotw` /
 * `.pa-dots` / `.menu` in mock.css). A single action on a row stays a plain
 * button or link: do not use this for one item.
 *
 * Props:
 *   labelledBy  id of the VISIBLE name of the row's thing (a place's or an
 *               event's name). The button is named "More actions for <that
 *               name>" through aria-labelledby, so no person- or
 *               place-supplied text ever goes into an attribute.
 *   items       { label, onSelect, danger? }[], rendered in the given order:
 *               pass the risky (danger) items last. A bone 200 line goes
 *               above the first danger item. Keyboard order is the rendered
 *               order.
 *   disabled    optional; turns the three-dot button off while the row's
 *               own request runs. It is aria-disabled, not natively disabled:
 *               choosing an item hands focus back to this button just as the
 *               row goes busy, and a natively disabled button would drop that
 *               focus to the page body. Presses and keys then do nothing and
 *               the menu never shows.
 *
 * Keyboard (the WAI-ARIA menu-button pattern): Enter, Space or ArrowDown on
 * the button opens and focuses the first item; ArrowUp opens on the last;
 * ArrowDown / ArrowUp move with wrap; Home / End; Escape closes and returns
 * focus to the button; Tab closes (focus moves on from the button);
 * choosing an item closes, returns focus to the button, then calls
 * onSelect. A press outside closes. No open animation (it is often opened
 * by keyboard).
 *
 * Layering: a small local z-20, enough to float over its own card and the
 * neighbouring rows on an admin page (no map there). It is deliberately NOT
 * a rung on DESIGN.md's layering ladder, which is for things over the map.
 *
 * Limit: the menu is absolutely positioned under the button, so a parent
 * with overflow (tableWrapClass's overflow-x-auto makes overflow-y auto too)
 * clips it. Inside a scrolling table, put the menu in a row with room below
 * or use plain buttons; this component does not portal.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { EllipsisVertical } from "lucide-react";
import { focusRingClass } from "@/lib/adminCardStyles";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

type AdminRowMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

type AdminRowMenuProps = {
  labelledBy: string;
  items: AdminRowMenuItem[];
  disabled?: boolean;
};

export default function AdminRowMenu({ labelledBy, items, disabled = false }: AdminRowMenuProps) {
  const baseId = useId();
  const menuId = `${baseId}-menu`;
  const prefixId = `${baseId}-prefix`;
  const [openState, setOpen] = useState(false);
  // A disabled menu never shows, even if it was open when `disabled` turned on.
  const open = openState && !disabled;
  // Which item to focus once the menu has rendered.
  const focusOnOpen = useRef<"first" | "last">("first");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const firstDanger = items.findIndex((i) => i.danger);

  function openMenu(where: "first" | "last") {
    if (disabled) return;
    focusOnOpen.current = where;
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const list = itemRefs.current.slice(0, items.length);
    (focusOnOpen.current === "first" ? list[0] : list[list.length - 1])?.focus();
    // Only on opening: a parent re-render while open must not pull focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      // preventDefault: otherwise Enter/Space also fire the native click,
      // which would toggle the menu straight back shut.
      e.preventDefault();
      openMenu("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu("last");
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const list = itemRefs.current.slice(0, items.length);
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => list[(to + list.length) % list.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(at + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(at - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(list.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case "Tab":
        // Focus the button first so the browser's own Tab moves on from it.
        close(true);
        break;
    }
  }

  function choose(item: AdminRowMenuItem) {
    close(true);
    item.onSelect();
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <span id={prefixId} className="sr-only">
        More actions for
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-disabled={disabled || undefined}
        aria-labelledby={`${prefixId} ${labelledBy}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={onButtonKeyDown}
        className={
          "inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] transition-colors duration-150 " +
          "hover:bg-[var(--color-sage-100)] hover:text-[var(--color-ink-700)] " +
          PRESS_FEEDBACK +
          " " +
          focusRingClass +
          " aria-disabled:cursor-not-allowed aria-disabled:opacity-50 " +
          (open ? "bg-[var(--color-sage-100)] text-[var(--color-ink-700)]" : "text-[var(--color-ink-500)]")
        }
      >
        <EllipsisVertical size={20} aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={`${prefixId} ${labelledBy}`}
          onKeyDown={onMenuKeyDown}
          className={
            "elevation-2 absolute right-0 top-full z-20 mt-1 w-max min-w-[200px] max-w-[calc(100vw-32px)] " +
            "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white py-1"
          }
        >
          {items.map((item, i) => (
            <button
              key={`${i}-${item.label}`}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => choose(item)}
              className={
                "flex min-h-12 w-full items-center px-4 py-2 text-left text-sm transition-colors duration-150 " +
                // The inset ring tells a keyboard stop from the pointer's fill (#926 decision 4).
                "hover:bg-[var(--color-sage-100)] focus-visible:bg-[var(--color-sage-100)] focus-visible:outline-none " +
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
                (i === firstDanger ? "border-t border-[var(--color-bone-200)] " : "") +
                (item.danger ? "text-[var(--color-danger)]" : "text-[var(--color-ink-700)]")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
