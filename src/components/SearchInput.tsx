"use client";

import { useRef } from "react";
import { Search } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  locale?: Locale;
  /** Show the ⌘K hint on desktop only */
  showShortcut?: boolean;
}

export default function SearchInput({
  value,
  onChange,
  locale = "en",
  showShortcut = false,
}: SearchInputProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 250);
  }

  return (
    <div className="relative w-full">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none"
        aria-hidden
      />
      <input
        type="search"
        defaultValue={value}
        onChange={handleChange}
        placeholder={t("search.placeholder", locale)}
        aria-label={t("search.aria", locale)}
        className={
          "w-full h-11 pl-9 pr-4 text-sm text-[var(--color-ink-700)] " +
          "bg-[var(--color-bone-50)] rounded-[var(--radius-md)] " +
          "border border-[var(--color-bone-200)] " +
          "placeholder:text-[var(--color-ink-400)] " +
          "transition-[border-color,box-shadow] duration-150 " +
          "focus:outline-none focus:border-[var(--color-sage-500)] " +
          "focus:ring-2 focus:ring-[rgba(74,132,102,0.15)]"
        }
        style={{ minHeight: 44 }}
      />
      {showShortcut && (
        <span
          className={
            "hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 " +
            "items-center px-1.5 h-5 rounded text-xs font-mono " +
            "text-[var(--color-ink-400)] border border-[var(--color-bone-200)] " +
            "select-none pointer-events-none"
          }
          aria-hidden
        >
          ⌘K
        </span>
      )}
    </div>
  );
}
