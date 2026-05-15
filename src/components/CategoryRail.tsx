"use client";

import type { VenueCategory } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const ALL_CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
];

interface CategoryRailProps {
  selected: Set<VenueCategory> | null; // null = "All"
  counts: Partial<Record<VenueCategory, number>>;
  totalCount: number;
  onToggle: (cat: VenueCategory | null) => void;
  filterOpenNow: boolean;
  onFilterOpenNow: (v: boolean) => void;
  filterSnap: boolean;
  onFilterSnap: (v: boolean) => void;
  filterWalking: boolean;
  onFilterWalking: (v: boolean) => void;
  locale?: Locale;
}

function RailRow({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex items-center w-full px-4 h-10 gap-3 text-sm text-left " +
        "transition-colors duration-150 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
        (active
          ? "bg-[var(--color-sage-50)] border-l-[3px] border-[var(--color-sage-500)]"
          : "hover:bg-[var(--color-bone-100)] border-l-[3px] border-transparent")
      }
    >
      {color && (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      <span
        className={
          "flex-1 font-medium " +
          (active
            ? "text-[var(--color-sage-700)]"
            : "text-[var(--color-ink-700)]")
        }
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          className="text-xs font-mono text-[var(--color-ink-400)] tabular-nums"
          aria-label={`${count} venues`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 px-4 h-10 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[var(--color-sage-500)] shrink-0"
      />
      <span className="text-sm text-[var(--color-ink-700)] group-hover:text-[var(--color-ink-900)]">
        {label}
      </span>
    </label>
  );
}

export default function CategoryRail({
  selected,
  counts,
  totalCount,
  onToggle,
  filterOpenNow,
  onFilterOpenNow,
  filterSnap,
  onFilterSnap,
  filterWalking,
  onFilterWalking,
  locale = "en",
}: CategoryRailProps) {
  const isAll = selected === null || selected.size === 0;

  return (
    <aside className="flex flex-col overflow-y-auto py-3">
      {/* Category section */}
      <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
        {t("category.all", locale)} CATEGORIES
      </p>

      <RailRow
        label={t("category.all", locale)}
        count={totalCount}
        active={isAll}
        onClick={() => onToggle(null)}
      />

      {ALL_CATEGORIES.map((cat) => {
        const count = counts[cat] ?? 0;
        if (count === 0) return null;
        const isActive = selected !== null && selected.has(cat);
        return (
          <RailRow
            key={cat}
            label={t(`category.${cat}`, locale)}
            count={count}
            color={categoryColors[cat]}
            active={isActive}
            onClick={() => onToggle(cat)}
          />
        );
      })}

      {/* Divider */}
      <div
        className="my-3 mx-4 border-t border-[var(--color-bone-200)]"
        aria-hidden
      />

      {/* Advanced filters */}
      <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
        FILTERS
      </p>
      <ToggleRow
        label={t("filter.openNow", locale)}
        checked={filterOpenNow}
        onChange={onFilterOpenNow}
      />
      <ToggleRow
        label={t("filter.snap", locale)}
        checked={filterSnap}
        onChange={onFilterSnap}
      />
      <ToggleRow
        label={`${t("filter.walkingDistance", locale)} (< 1 mi)`}
        checked={filterWalking}
        onChange={onFilterWalking}
      />
    </aside>
  );
}
