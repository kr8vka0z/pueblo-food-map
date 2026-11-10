/**
 * CategoryLabel — the kind of place as colored words under a name (#917,
 * DESIGN.md R3): the category in its category color, then any benefits
 * (SNAP, WIC) in sage 700, joined by ink 400 middle dots. Semibold, no fill,
 * no pill. Used by the place card, the box card and the SNAP and WIC page.
 *
 * WHY words in, no t() and no "use client": it renders in client cards and in
 * the server-rendered hub page, so callers pass already-translated words and
 * this file stays out of the client i18n key graph.
 *
 * WHY a hidden ", " beside each aria-hidden dot: a screen reader then hears
 * "Food Pantry, SNAP, WIC" instead of reading out "middle dot".
 */

import { Fragment } from "react";
import type { VenueCategory } from "@/types/venue";
import { categoryColors } from "@/lib/categories";

interface CategoryLabelProps {
  category: VenueCategory;
  /** The category's translated name, e.g. "Food Pantry". */
  label: string;
  /** Translated benefit words, only those the place takes, e.g. ["SNAP", "WIC"]. */
  benefits?: string[];
  /** Size and spacing classes; R3 is 14 px (`text-sm`) everywhere. */
  className?: string;
}

export default function CategoryLabel({ category, label, benefits = [], className = "text-sm" }: CategoryLabelProps) {
  return (
    <p className={`font-semibold ${className}`}>
      <span style={{ color: categoryColors[category] }}>{label}</span>
      {benefits.map((b) => (
        <Fragment key={b}>
          <span aria-hidden="true" className="mx-[6px] text-[var(--color-ink-400)]">
            ·
          </span>
          <span className="sr-only">, </span>
          <span className="text-[var(--color-sage-700)]">{b}</span>
        </Fragment>
      ))}
    </p>
  );
}
