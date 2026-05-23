"use client";

/**
 * LocateButton — v2 circular geolocation trigger, positioned absolute top-right.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Mobile·375×812·map(located),
 *       §Desktop·1440×900·map(located), and Open question #3.
 *
 * States:
 *   idle   — navy bg, white Locate icon
 *   active — sage-500 bg, white LocateFixed icon (position fresh)
 *   denied — bone-200 bg, ink-500 Locate icon (still tappable)
 *
 * Size: 44×44 mobile / 52×52 desktop (≥768px).
 * Icon: 18×18 mobile / 22×22 desktop.
 * Position: absolute top-4 right-4, z-index 1000.
 */

import { Locate, LocateFixed } from "lucide-react";
import type { GeoState } from "@/lib/useGeolocation";
import { t, type Locale } from "@/lib/i18n";

interface LocateButtonProps {
  geoState: GeoState;
  onRequest: () => void;
  /** Locale for aria-label translation. Defaults to "en". */
  locale?: Locale;
}

export default function LocateButton({
  geoState,
  onRequest,
  locale = "en",
}: LocateButtonProps) {
  const isActive =
    geoState.permission === "granted" && geoState.position !== null;
  const isDenied = geoState.permission === "denied";

  // bg color
  const bg = isDenied
    ? "bg-[var(--color-bone-200)]"
    : isActive
      ? "bg-[var(--color-sage-500)]"
      : "bg-[var(--color-brand-navy)]";

  // icon color
  const iconColor = isDenied
    ? "var(--color-ink-500)"
    : "#ffffff";

  return (
    <button
      type="button"
      onClick={onRequest}
      aria-label={t("topbar.locate", locale)}
      className={
        // Positioning — absolute top-right, below HamburgerMenu (#71: top-[68px] = 16+44+8)
        "absolute right-4 " +
        // Size — 44×44 mobile / 52×52 desktop
        "w-11 h-11 md:w-[52px] md:h-[52px] " +
        "flex items-center justify-center " +
        "rounded-full " +
        bg + " " +
        "transition-[background-color,opacity] duration-150 " +
        "hover:opacity-90 active:scale-95 " +
        "focus-visible:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
        "elevation-2"
      }
      style={{ zIndex: 1000, top: "68px" }}
    >
      {/* Mobile icon: 18×18 */}
      {isActive ? (
        <>
          <LocateFixed
            size={18}
            className="md:hidden"
            style={{ color: iconColor }}
            aria-hidden
          />
          <LocateFixed
            size={22}
            className="hidden md:block"
            style={{ color: iconColor }}
            aria-hidden
          />
        </>
      ) : (
        <>
          <Locate
            size={18}
            className="md:hidden"
            style={{ color: iconColor }}
            aria-hidden
          />
          <Locate
            size={22}
            className="hidden md:block"
            style={{ color: iconColor }}
            aria-hidden
          />
        </>
      )}
    </button>
  );
}
