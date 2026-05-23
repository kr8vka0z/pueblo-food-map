"use client";

/**
 * Legend — collapsible category color legend button.
 *
 * Positioned in the top-right control cluster alongside LocateButton.
 * Default state: collapsed (button shows Palette icon).
 * Click / outside-click / Escape → toggles open/closed.
 *
 * Reuses:
 *   - categoryColors from src/data/venues.ts (authoritative hex values)
 *   - category.full.* keys from src/lib/i18n.ts (localized labels)
 *
 * A11y:
 *   - Button: aria-expanded reflects open/closed state
 *   - Panel: role="region" aria-label from i18n "legend.button_label"
 *   - Color dots: aria-hidden="true" (decorative)
 *   - Escape closes and returns focus to button
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { categoryColors, categoryLabels } from "@/data/venues";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { VenueCategory } from "@/types/venue";

// Ordered list of all 7 categories for consistent rendering
const LEGEND_CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
];

interface LegendProps {
  /** Locale for button aria-label and category labels. Both use i18n keys from src/lib/i18n.ts (EN + ES). */
  locale?: Locale;
}

export default function Legend({ locale = "en" }: LegendProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const buttonLabel = t("legend.button_label", locale);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        // Sit below LocateButton (#71: hamburger top-4=16+h-11=44+8gap=68; locate h-11=44+8gap=8 → 68+44+8=120px)
        top: "120px",
        right: "16px",
        zIndex: 1000,
      }}
    >
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls="legend-panel"
        onClick={toggle}
        className={
          "flex items-center justify-center " +
          "w-11 h-11 md:w-[52px] md:h-[52px] " +
          "rounded-full " +
          "bg-[var(--color-brand-navy)] " +
          "transition-[background-color,opacity] duration-150 " +
          "hover:opacity-90 active:scale-95 " +
          "focus-visible:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
          "elevation-2"
        }
      >
        <Palette
          size={18}
          className="md:hidden"
          style={{ color: "#ffffff" }}
          aria-hidden
        />
        <Palette
          size={22}
          className="hidden md:block"
          style={{ color: "#ffffff" }}
          aria-hidden
        />
      </button>

      {/* Expandable panel */}
      {open && (
        <div
          id="legend-panel"
          role="region"
          aria-label={buttonLabel}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "min(200px, calc(100vw - 32px))",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            padding: "12px 0",
            zIndex: 1000,
          }}
        >
          {LEGEND_CATEGORIES.map((cat) => (
            <div
              key={cat}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 14px",
              }}
            >
              {/* Color dot — decorative, hidden from screen readers */}
              <span
                data-legend-dot
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: categoryColors[cat],
                  flexShrink: 0,
                }}
              />
              {/* Label */}
              <span
                style={{
                  fontSize: "13px",
                  lineHeight: "1.3",
                  color: "#1a1a1a",
                }}
              >
                {t(`category.full.${cat}`, locale) || categoryLabels[cat]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
