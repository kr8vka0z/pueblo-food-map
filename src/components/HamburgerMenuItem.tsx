"use client";

/**
 * HamburgerMenuItem — a single slot in the hamburger menu list.
 *
 * Renders as a <li role="menuitem"> with a full-width anchor or button.
 * Accepts an href for link items (rendered via next/link) or an onClick for
 * action items (rendered as a button). A link item may ALSO take onClick —
 * HamburgerMenu passes its close() there so navigating to the current page
 * (e.g. tapping "About this map" while already on /about) still closes the
 * drawer instead of leaving it open with body scroll locked (#PR-review item 2).
 *
 * isExternal/ariaLabel (#96, external-link support) were removed 2026-09-16:
 * every item here is an internal Link now — the one external row (the sponsor
 * card) is a plain <a>, not this component, so nothing called them.
 */

import Link from "next/link";
import type { ReactNode } from "react";

interface HamburgerMenuItemProps {
  /** Display label for the item. */
  label: string;
  /** If provided, renders as a Next.js Link. */
  href?: string;
  /**
   * Click handler. Action items (no href) use this as their sole behavior.
   * Link items may also pass this — e.g. to close the drawer — since a
   * next/link navigation to the current route doesn't otherwise fire anything.
   */
  onClick?: () => void;
  /**
   * Optional icon element to show to the right of the label.
   * Typically a small Lucide icon (size 14-16).
   */
  icon?: ReactNode;
}

export default function HamburgerMenuItem({
  label,
  href,
  onClick,
  icon,
}: HamburgerMenuItemProps) {
  const itemClass =
    "flex items-center gap-2 w-full text-left px-5 py-3 text-sm font-medium " +
    "text-[var(--color-ink-800)] " +
    "hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-900)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset " +
    "focus-visible:ring-[var(--color-sage-500)] " +
    "transition-colors duration-100";

  const children = (
    <>
      <span className="flex-1">{label}</span>
      {icon && (
        <span aria-hidden="true" className="flex-shrink-0 text-[var(--color-ink-400)]">
          {icon}
        </span>
      )}
    </>
  );

  // WHY role="menuitem" on <li>: this is a PRAGMATIC COMPROMISE, NOT strict WAI-ARIA.
  // Strict pattern is <li role="none"><a role="menuitem"> — the interactive element
  // carries the role, not the wrapper. Here the <a>/<button> is a focusable descendant
  // OF the menuitem rather than being the menuitem itself, which is technically a11y
  // debt. We keep it this way so testing-library queries work cleanly: getByRole("menuitem")
  // finds the <li>, getByRole("link") finds the <a> by its implicit role. Changing the
  // markup to strict conformance would require updating those test selectors. Known debt
  // for a future a11y pass.
  return (
    <li role="menuitem">
      {href ? (
        <Link href={href} onClick={onClick} className={itemClass}>
          {children}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={itemClass}>
          {children}
        </button>
      )}
    </li>
  );
}
