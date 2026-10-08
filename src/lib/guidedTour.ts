/**
 * Guided tour (#159) — the pure half: step list, step state machine, tooltip
 * placement math, and the tour's own EN/ES copy.
 *
 * Imported ONLY by GuidedTour.tsx, which MapWrapper loads with next/dynamic
 * the moment a tour starts — so none of this (copy included) is in any
 * bundle a visitor downloads unless they ask for the tour. WHY the copy lives
 * here instead of src/lib/i18n.ts: i18n.ts ships inside the MapWrapper/Splash
 * chunks every home-page visitor loads; ~2KB of tour text there is paid by
 * everyone for a feature few use (DESIGN.md "Low-end device guardrails").
 * Only the two trigger labels (splash button, menu item) live in i18n.ts.
 */

import type { Locale } from "@/lib/i18n";

export type TourStepId =
  | "welcome"
  | "search"
  | "filters"
  | "pin"
  | "card"
  | "nearMe"
  | "saved"
  | "menu";

export interface TourStep {
  id: TourStepId;
  /**
   * CSS selector for the element this step points at, or null for a centered
   * card with no highlight. The "pin" step's target depends on the sample
   * venue, so GuidedTour.tsx builds it at runtime.
   */
  target: string | null;
  /** True for the one step that opens the sample venue's card. */
  showsCard?: boolean;
}

// Mapped to today's controls (the issue's list predates the bottom nav, the
// Filters panel and #514's removal of the inline Map/List switch): Map/List
// now lives in the Menu ("List view") and the empty-search suggestion, so the
// Menu step carries it. Card sits right after Pin (same sample venue) and
// before the nav steps: BottomNav unmounts while a card is open on a phone
// (MapWrapper's venueSheetOpen), and closing the card first brings it back.
export const TOUR_STEPS: readonly TourStep[] = [
  { id: "welcome", target: null },
  { id: "search", target: '[data-testid="search-input"]' },
  { id: "filters", target: '[data-testid="filters-button"]' },
  { id: "pin", target: null },
  // BottomSheet (phone) / DesktopVenueWindow (desktop) — both already carry
  // these attributes; no tour-only hook needed on either.
  { id: "card", target: '[data-bottom-sheet], [aria-labelledby^="venue-window-title-"]', showsCard: true },
  { id: "nearMe", target: '[data-testid="nav-near-me"]' },
  { id: "saved", target: '[data-testid="nav-saved"]' },
  { id: "menu", target: '[data-testid="nav-top"]' },
];

export type TourAction = "next" | "back" | "close";

/** Step index while running, null once finished or closed. */
export function tourReducer(index: number | null, action: TourAction): number | null {
  if (index === null || action === "close") return null;
  if (action === "back") return Math.max(0, index - 1);
  return index + 1 < TOUR_STEPS.length ? index + 1 : null;
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Placement {
  top: number;
  left: number;
  placement: "center" | "below" | "above" | "right" | "left" | "over";
}

const MARGIN = 12; // keep the tooltip this far from every screen edge
const GAP = 12; // space between the highlight and the tooltip

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

/**
 * Where the tooltip goes: below the target, else above, else beside it
 * (desktop), else pinned to whichever screen edge has more room — always
 * clamped on screen. `target` should already include the highlight padding.
 */
export function placeTooltip(
  target: Rect | null,
  tip: { width: number; height: number },
  vp: { width: number; height: number },
): Placement {
  const maxLeft = vp.width - tip.width - MARGIN;
  const maxTop = vp.height - tip.height - MARGIN;
  if (!target) {
    return {
      left: clamp(Math.round((vp.width - tip.width) / 2), MARGIN, maxLeft),
      top: clamp(Math.round((vp.height - tip.height) / 2), MARGIN, maxTop),
      placement: "center",
    };
  }
  const bottom = target.top + target.height;
  const right = target.left + target.width;
  const hLeft = clamp(Math.round(target.left + target.width / 2 - tip.width / 2), MARGIN, maxLeft);
  const vTop = clamp(Math.round(target.top + target.height / 2 - tip.height / 2), MARGIN, maxTop);

  if (bottom + GAP + tip.height <= vp.height - MARGIN) {
    return { top: bottom + GAP, left: hLeft, placement: "below" };
  }
  if (target.top - GAP - tip.height >= MARGIN) {
    return { top: target.top - GAP - tip.height, left: hLeft, placement: "above" };
  }
  if (right + GAP + tip.width <= vp.width - MARGIN) {
    return { top: vTop, left: right + GAP, placement: "right" };
  }
  if (target.left - GAP - tip.width >= MARGIN) {
    return { top: vTop, left: target.left - GAP - tip.width, placement: "left" };
  }
  // Nothing fits cleanly (a tall card on a short phone): pin to the screen
  // edge with more free space so the least of the target is covered.
  const roomAbove = target.top;
  const roomBelow = vp.height - bottom;
  return {
    top: roomAbove > roomBelow ? MARGIN : Math.max(MARGIN, maxTop),
    left: hLeft,
    placement: "over",
  };
}

interface StepCopy {
  title: string;
  body: string;
}

interface TourCopy {
  dialogLabel: string;
  next: string;
  back: string;
  done: string;
  close: string;
  counter: (n: number, total: number) => string;
  steps: Record<TourStepId, StepCopy>;
}

// Short sentences, everyday words, one idea per step — many visitors read
// under stress or in a second language. Control names match the on-screen
// labels exactly (i18n.ts's nav.* / filters.* values) so people can find them.
export const TOUR_COPY: Record<Locale, TourCopy> = {
  en: {
    dialogLabel: "How to use this map",
    next: "Next",
    back: "Back",
    done: "Done",
    close: "Close tour",
    counter: (n, total) => `Step ${n} of ${total}`,
    steps: {
      welcome: {
        title: "Welcome!",
        body: "This map shows places to get food in Pueblo County. Here is a quick look at how it works.",
      },
      search: {
        title: "Search",
        body: "Type the name of a place, or a kind of place like pantry.",
      },
      filters: {
        title: "Filters",
        body: "Tap here to see only places that are open now, take SNAP or WIC, or are one kind of place.",
      },
      pin: {
        title: "Pins",
        body: "Each pin is a place to get food. The color shows what kind of place it is.",
      },
      card: {
        title: "Place details",
        body: "Tap a pin to see its hours, address, and directions. Tap the star to save it.",
      },
      nearMe: {
        title: "Near me",
        body: "Tap Near me to see food close to where you are.",
      },
      saved: {
        title: "Saved",
        body: "Places you save with the star are kept here.",
      },
      menu: {
        title: "Menu",
        body: "Open Menu to see every place as a list, change the language, or take this tour again.",
      },
    },
  },
  es: {
    dialogLabel: "Cómo usar este mapa", // [CHECK]
    next: "Siguiente",
    back: "Atrás",
    done: "Listo", // [CHECK]
    close: "Cerrar recorrido", // [CHECK]
    counter: (n, total) => `Paso ${n} de ${total}`,
    steps: {
      welcome: {
        title: "¡Bienvenidos!", // [CHECK]
        body: "Este mapa muestra lugares para conseguir comida en el condado de Pueblo. Aquí te mostramos cómo funciona.", // [CHECK]
      },
      search: {
        title: "Buscar",
        body: "Escribe el nombre de un lugar o un tipo de lugar, como despensa.", // [CHECK]
      },
      filters: {
        title: "Filtros",
        body: "Toca aquí para ver solo lugares abiertos ahora, que aceptan SNAP o WIC, o de un solo tipo.", // [CHECK]
      },
      pin: {
        title: "Marcadores", // [CHECK]
        body: "Cada marcador es un lugar para conseguir comida. El color muestra qué tipo de lugar es.", // [CHECK]
      },
      card: {
        title: "Detalles del lugar", // [CHECK]
        body: "Toca un marcador para ver su horario, dirección y cómo llegar. Toca la estrella para guardarlo.", // [CHECK]
      },
      nearMe: {
        // Matches the ES bottom-nav label (i18n.ts nav.nearMe = "Cercanos").
        title: "Cercanos",
        body: "Toca Cercanos para ver comida cerca de donde estás.", // [CHECK]
      },
      saved: {
        title: "Guardados",
        body: "Aquí están los lugares que guardaste con la estrella.", // [CHECK]
      },
      menu: {
        title: "Menú",
        body: "Abre el Menú para ver todos los lugares en una lista, cambiar el idioma o repetir este recorrido.", // [CHECK]
      },
    },
  },
};
