"use client";

/**
 * HamburgerMenuItem — a single slot in the hamburger menu list.
 *
 * Renders as a <li role="menuitem"> with a full-width anchor or button.
 * Accepts an href for link items (rendered via next/link) or an onClick for
 * action items (rendered as a button).
 *
 * External link support (#96):
 *   Pass isExternal={true} together with href to open in a new tab with
 *   rel="noopener noreferrer". Supply an icon (e.g. Lucide ExternalLink)
 *   to show it to the right of the label. Provide an ariaLabel to add
 *   "opens in new tab" context for screen readers.
 */

import Link from "next/link";
import type { ReactNode } from "react";

interface HamburgerMenuItemProps {
  /** Display label for the item. */
  label: string;
  /** If provided, renders as a Next.js Link (or plain <a> for external links). */
  href?: string;
  /** If provided (and no href), renders as a button with this handler. */
  onClick?: () => void;
  /**
   * When true, renders an <a> with target="_blank" and rel="noopener noreferrer"
   * instead of a Next.js Link. Requires href.
   */
  isExternal?: boolean;
  /**
   * Optional icon element to show to the right of the label.
   * Typically a small Lucide icon (size 14-16).
   */
  icon?: ReactNode;
  /**
   * Override the accessible label. Used to add "opens in new tab" suffix
   * for external links without showing it visually.
   */
  ariaLabel?: string;
}

export default function HamburgerMenuItem({
  label,
  href,
  onClick,
  isExternal = false,
  icon,
  ariaLabel,
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

  return (
    <li role="menuitem">
      {href && isExternal ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          className={itemClass}
        >
          {children}
        </a>
      ) : href ? (
        <Link href={href} aria-label={ariaLabel} className={itemClass}>
          {children}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={itemClass}>
          {children}
        </button>
      )}
    </li>
  );
}
