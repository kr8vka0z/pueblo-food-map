"use client";

/**
 * EmptyState — shown in the venue list panel when filters produce zero results.
 * Contains a sage line-art inline SVG (empty plate, ~120×120px, 1.5px stroke,
 * no fill) plus a two-line caption and a "Clear filters" CTA.
 */

import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface EmptyStateProps {
  locale?: Locale;
  onClearFilters?: () => void;
}

export default function EmptyState({
  locale = "en",
  onClearFilters,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center py-6 px-4 max-w-[260px] mx-auto">
      {/* Sage line-art plate illustration — inline SVG, ~120px square */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120 120"
        width="120"
        height="120"
        fill="none"
        stroke="var(--color-sage-500)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        role="img"
      >
        {/* Plate rim (outer ellipse) */}
        <ellipse cx="60" cy="65" rx="46" ry="38" />
        {/* Plate well (inner ellipse) */}
        <ellipse cx="60" cy="65" rx="36" ry="29" />
        {/* Fork — left of plate */}
        <line x1="22" y1="30" x2="22" y2="52" />
        <line x1="18" y1="30" x2="18" y2="42" />
        <line x1="22" y1="30" x2="26" y2="30" />
        <line x1="26" y1="30" x2="26" y2="42" />
        <path d="M18 42 Q22 46 26 42" />
        <line x1="22" y1="46" x2="22" y2="52" />
        {/* Knife — right of plate */}
        <line x1="98" y1="30" x2="98" y2="52" />
        <path d="M98 30 Q103 36 98 42" />
        {/* Small fork-tine decoration inside plate (empty plate suggestion) */}
        <line x1="52" y1="58" x2="52" y2="68" strokeOpacity="0.4" />
        <line x1="60" y1="56" x2="60" y2="70" strokeOpacity="0.4" />
        <line x1="68" y1="58" x2="68" y2="68" strokeOpacity="0.4" />
      </svg>

      {/* Caption */}
      <div>
        <p className="text-sm font-semibold text-[var(--color-ink-700)] leading-snug mb-1">
          {t("empty.title", locale)}
        </p>
      </div>

      {/* Clear filters CTA */}
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className={
            "inline-flex items-center justify-center px-4 h-10 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
            "text-sm font-semibold transition-colors duration-150 " +
            "hover:bg-[var(--color-sage-600)] " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
          }
        >
          {t("empty.clear", locale)}
        </button>
      )}
    </div>
  );
}
