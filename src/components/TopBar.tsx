"use client";

import { Locate } from "lucide-react";
import LocaleToggle from "./LocaleToggle";
import SearchInput from "./SearchInput";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface TopBarProps {
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onLocate: () => void;
  /** Mobile: search is rendered outside topbar in a floating row */
  showSearchInBar?: boolean;
}

export default function TopBar({
  locale,
  onLocaleChange,
  searchQuery,
  onSearchChange,
  onLocate,
  showSearchInBar = false,
}: TopBarProps) {
  return (
    <header
      className={
        "sticky top-0 z-[900] flex items-center gap-3 px-4 " +
        "bg-[var(--color-bone-50)] border-b border-[var(--color-bone-200)] " +
        // 56px mobile, 64px tablet, 72px desktop
        "h-14 md:h-16 lg:h-[72px]"
      }
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Wordmark */}
      <h1
        className="shrink-0 text-xl font-[500] text-[var(--color-ink-900)] leading-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("app.name", locale)}
      </h1>

      {/* Search input — shown in bar on md+ breakpoints */}
      {showSearchInBar && (
        <div className="flex-1 max-w-sm mx-4 hidden md:block">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            locale={locale}
            showShortcut
          />
        </div>
      )}

      {/* Spacer — pushes controls to the right on mobile */}
      <div className="flex-1" aria-hidden />

      {/* Locale toggle */}
      <LocaleToggle locale={locale} onChange={onLocaleChange} />

      {/* Locate-me button */}
      <button
        type="button"
        onClick={onLocate}
        aria-label={t("topbar.locate", locale)}
        className={
          "flex items-center justify-center w-11 h-11 rounded-full " +
          "text-[var(--color-sage-500)] hover:text-[var(--color-sage-600)] " +
          "hover:bg-[var(--color-sage-50)] " +
          "transition-colors duration-150 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        }
      >
        <Locate size={20} aria-hidden />
      </button>
    </header>
  );
}
