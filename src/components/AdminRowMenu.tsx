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
 *   items       { label, onSelect, danger?, disabled? }[]. Rendered in the
 *               given order, except danger items, which always go last under
 *               a bone 200 line (the risky choice last). Keyboard order is
 *               the rendered order.
 *
 * Keyboard (the WAI-ARIA menu-button pattern): Enter, Space or ArrowDown on
 * the button opens and focuses the first item; ArrowUp opens on the last;
 * ArrowDown / ArrowUp move with wrap; Home / End; Escape closes and returns
 * focus to the button; Tab closes (focus moves on from the button);
 * choosing an item closes, returns focus to the button, then calls
 * onSelect. A press outside closes. No open animation (it is often opened
 * by keyboard).
 *
 * Disabled items use aria-disabled, not the disabled attribute: a natively
 * disabled button refuses focus, which would stall the arrow keys. Choosing
 * one does nothing.
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

export type AdminRowMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type AdminRowMenuProps = {
  labelledBy: string;
  items: AdminRowMenuItem[];
};

export default function AdminRowMenu({ labelledBy, items }: AdminRowMenuProps) {
  const baseId = useId();
  const buttonId = `${baseId}-button`;
  const menuId = `${baseId}-menu`;
  const prefixId = `${baseId}-prefix`;
  const [open, setOpen] = useState(false);
  // Which item to focus once the menu has rendered.
  const focusOnOpen = useRef<"first" | "last">("first");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const ordered = [...items.filter((i) => !i.danger), ...items.filter((i) => i.danger)];
  const firstDanger = ordered.findIndex((i) => i.danger);

  function openMenu(where: "first" | "last") {
    focusOnOpen.current = where;
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const list = itemRefs.current.slice(0, ordered.length);
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
    const list = itemRefs.current.slice(0, ordered.length);
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
    if (item.disabled) return;
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
        id={buttonId}
        type="button"
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
          " " +
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
          {ordered.map((item, i) => (
            <button
              key={`${i}-${item.label}`}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              onClick={() => choose(item)}
              className={
                "flex min-h-12 w-full items-center px-4 py-2 text-left text-sm transition-colors duration-150 " +
                "hover:bg-[var(--color-sage-100)] focus-visible:bg-[var(--color-sage-100)] focus-visible:outline-none " +
                (i === firstDanger ? "border-t border-[var(--color-bone-200)] " : "") +
                (item.danger ? "text-[var(--color-danger)] " : "text-[var(--color-ink-700)] ") +
                (item.disabled ? "cursor-not-allowed opacity-50" : "")
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
