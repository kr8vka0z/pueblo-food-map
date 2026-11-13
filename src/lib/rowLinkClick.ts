/**
 * rowLinkClick.ts — lets a click anywhere on an admin table row open the
 * row's own link (#926: the row turns green under the pointer, so the whole
 * row has to do something). Used by the Places, Blessing Boxes and Events
 * tables with tableLinkRowClass (src/lib/adminCardStyles.ts).
 *
 *   <tr className={tableLinkRowClass} onClick={openRowLink}>
 *     <td><Link href={…} data-row-link className={linkClass}>Name</Link></td>
 *
 * The real link (marked data-row-link) stays the keyboard and screen-reader
 * path; the row click is a pointer convenience only, so the row itself is
 * not focusable on purpose. The click is handed to that link with
 * link.click(), so it opens exactly the link's address through next/link.
 *
 * Left alone, so the browser or the control does its own thing:
 *   - a click on a link, button or other control inside the row;
 *   - Ctrl / Cmd / Shift / Alt clicks and any non-left button (a new tab or
 *     window is only ever opened by the real link; a middle click never
 *     fires click at all);
 *   - a click that ends a text selection (copying an address).
 */

import type { MouseEvent } from "react";

const CONTROLS = "a, button, input, select, textarea, label, summary, [role='button'], [role='menuitem']";

export function openRowLink(e: MouseEvent<HTMLElement>): void {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest(CONTROLS)) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && e.currentTarget.contains(selection.anchorNode)) return;
  e.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]")?.click();
}
