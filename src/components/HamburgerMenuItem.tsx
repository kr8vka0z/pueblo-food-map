"use client";

/**
 * HamburgerMenuItem — a single slot in the hamburger menu list.
 *
 * Renders as a <li role="menuitem"> with a full-width anchor or button.
 * Accepts an href for link items (rendered via next/link) or an onClick for
 * action items (rendered as a button).
 */

import Link from "next/link";

interface HamburgerMenuItemProps {
  /** Display label for the item. */
  label: string;
  /** If provided, renders as a Next.js Link. */
  href?: string;
  /** If provided (and no href), renders as a button with this handler. */
  onClick?: () => void;
}

export default function HamburgerMenuItem({
  label,
  href,
  onClick,
}: HamburgerMenuItemProps) {
  const itemClass =
    "block w-full text-left px-5 py-3 text-sm font-medium " +
    "text-[var(--color-ink-800)] " +
    "hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-900)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset " +
    "focus-visible:ring-[var(--color-sage-500)] " +
    "transition-colors duration-100";

  return (
    <li role="menuitem">
      {href ? (
        <Link href={href} className={itemClass}>
          {label}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={itemClass}>
          {label}
        </button>
      )}
    </li>
  );
}
