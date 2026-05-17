"use client";

/**
 * SearchBar — v2 floating search bar, positioned absolute above the map.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Mobile·375×812·map(located)
 * and §Desktop·1440×900·map(located)
 *
 * - Floats above Leaflet tiles (z-index 1000 — Leaflet uses 200–800).
 * - Near-full-width on mobile (16px margins each side).
 * - ~520px centered on desktop (≥768px).
 * - Controlled: value/onChange/onSubmit wired by PR 6 (MapWrapper).
 */

import { useCallback } from "react";
import { Search } from "lucide-react";

interface SearchBarProps {
  /** Controlled value — owned by MapWrapper. */
  value: string;
  onChange: (next: string) => void;
  /** Called when the user presses Enter to commit the current query. */
  onSubmit?: () => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search venues or categories",
}: SearchBarProps) {
  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
        onSubmit?.();
      }
    },
    [onSubmit],
  );

  return (
    <div
      className="absolute top-4 left-0 right-0 flex justify-center"
      style={{ zIndex: 1000, pointerEvents: "none" }}
      aria-hidden={false}
    >
      <div
        className="relative w-full mx-4 md:mx-0 md:w-[520px]"
        style={{ pointerEvents: "auto" }}
      >
        {/* Search icon — 16×16 mobile, 18×18 desktop */}
        <Search
          size={16}
          className={
            "absolute left-3 top-1/2 -translate-y-1/2 " +
            "text-[var(--color-ink-400)] pointer-events-none " +
            "md:hidden"
          }
          aria-hidden
        />
        <Search
          size={18}
          className={
            "hidden absolute left-3.5 top-1/2 -translate-y-1/2 " +
            "text-[var(--color-ink-400)] pointer-events-none " +
            "md:block"
          }
          aria-hidden
        />

        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          aria-label="Search venues or categories"
          className={
            "w-full h-11 md:h-[52px] " +
            "pl-9 md:pl-10 pr-4 " +
            "text-sm text-[var(--color-ink-700)] " +
            "bg-[var(--color-bone-50)] " +
            "border border-[var(--color-bone-300)] " +
            "rounded-[var(--radius-full)] " +
            "placeholder:text-[var(--color-ink-400)] " +
            "transition-[border-color,box-shadow] duration-150 " +
            "focus:outline-none " +
            "focus:border-[var(--color-sage-500)] " +
            "focus:ring-2 focus:ring-[rgba(74,132,102,0.15)] " +
            "elevation-1"
          }
        />
      </div>
    </div>
  );
}
