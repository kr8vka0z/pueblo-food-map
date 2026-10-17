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
  | "filterChoices"
  | "pin"
  | "card"
  | "boxesNav"
  | "boxesMap"
  | "boxCheckin"
  | "boxPhoto"
  | "boxHelp"
  | "nearMe"
  | "saved"
  | "menu";

export interface TourStep {
  id: TourStepId;
  /**
   * CSS selector for the element this step points at, or null for a centered
   * card with no highlight. The "pin" and "boxesMap" steps' targets depend on
   * the sample venue / box, so GuidedTour.tsx builds them at runtime.
   */
  target: string | null;
  /** True for the one step that opens the sample venue's card. */
  showsCard?: boolean;
  /** True for the steps that open the sample Blessing Box's card. */
  showsBox?: boolean;
  /** Open the card fully (the phone sheet's below-the-fold part holds it). */
  cardExpanded?: boolean;
  /** Scroll the target into view inside its card before pointing at it. */
  scrollTarget?: boolean;
  /** Skipped when there's no sample box (live box feed empty or not loaded). */
  needsBox?: boolean;
  /**
   * A live demo the step runs while it is open: "search" types the sample
   * word into the real search box, "filters" opens the real Filters panel,
   * "boxes" turns the map's Boxes view on (held across the box steps).
   * MapWrapper undoes each when its steps are left.
   */
  demo?: "search" | "filters" | "boxes";
}

// Mapped to today's controls (the issue's list predates the bottom nav, the
// Filters panel and #514's removal of the inline Map/List switch): Map/List
// now lives in the Menu ("List view") and the empty-search suggestion, so the
// Menu step carries it. Card sits right after Pin (same sample venue) and
// before the nav steps: BottomNav unmounts while a card is open on a phone
// (MapWrapper's venueSheetOpen), and closing the card first brings it back.
export const TOUR_STEPS: readonly TourStep[] = [
  { id: "welcome", target: null },
  // The search box plus the results popover the typing demo brings up;
  // GuidedTour highlights the union of matches.
  { id: "search", target: '[data-testid="search-input"], [data-tour="search-results"]', demo: "search" },
  // Two beats for Filters: the button that opens the panel, then the open
  // panel's "Show only" rows (FilterPanel's SwitchRow), with the tooltip
  // below them so the panel's header and those choices stay in view.
  { id: "filters", target: '[data-testid="filters-button"]' },
  { id: "filterChoices", target: '[data-tour="filter-switch-row"]', demo: "filters" },
  { id: "pin", target: null },
  // BottomSheet (phone) / DesktopVenueWindow (desktop) — both already carry
  // these attributes; no tour-only hook needed on either.
  { id: "card", target: '[data-bottom-sheet], [aria-labelledby^="venue-window-title-"]', showsCard: true },
  // Blessing Boxes, after the place card (BottomNav is back once the card
  // closes on a phone) and before the other nav items. The tour only points
  // at the box card's buttons: its full-screen layer swallows every tap, so
  // nothing on the card can be pressed and nothing is ever sent.
  { id: "boxesNav", target: '[data-testid="nav-boxes"]' },
  { id: "boxesMap", target: null, demo: "boxes", needsBox: true },
  {
    id: "boxCheckin",
    target: '[data-tour="box-checkin-choices"]',
    demo: "boxes",
    showsBox: true,
    needsBox: true,
    scrollTarget: true,
  },
  { id: "boxPhoto", target: '[data-tour="box-photo"]', demo: "boxes", showsBox: true, needsBox: true, scrollTarget: true },
  {
    id: "boxHelp",
    target: '[data-tour="box-adopt"], [data-tour="box-alerts"]',
    demo: "boxes",
    showsBox: true,
    cardExpanded: true,
    needsBox: true,
    scrollTarget: true,
  },
  { id: "nearMe", target: '[data-testid="nav-near-me"]' },
  { id: "saved", target: '[data-testid="nav-saved"]' },
  { id: "menu", target: '[data-testid="nav-top"]' },
];

export type TourAction = "next" | "back" | "close";

/**
 * Step index while running, null once finished or closed. `total` is the
 * length of the step list actually shown (box steps drop out with no box).
 */
export function tourReducer(index: number | null, action: TourAction, total = TOUR_STEPS.length): number | null {
  if (index === null || action === "close") return null;
  if (action === "back") return Math.max(0, index - 1);
  return index + 1 < total ? index + 1 : null;
}

/** The steps a tour shows: the box steps only when there's a box to show. */
export function tourSteps(hasBox: boolean): readonly TourStep[] {
  return hasBox ? TOUR_STEPS : TOUR_STEPS.filter((s) => !s.needsBox);
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
  skip: string;
  counter: (n: number, total: number) => string;
  /** Typed into the search box by the search step; must match places in the data. */
  searchWord: string;
  steps: Record<TourStepId, StepCopy>;
}

// Everyday words, one idea per step — many visitors read under stress or in
// a second language. Sentences are joined with commas and "and"/"so" rather
// than cut into rows of short ones (Kyle finds those clipped; atlas-kb
// Writing Standard). Control names match the on-screen labels exactly
// (i18n.ts's nav.* / filters.* / box.* values) so people can find them.
export const TOUR_COPY: Record<Locale, TourCopy> = {
  en: {
    dialogLabel: "How to use this map",
    next: "Next",
    back: "Back",
    done: "Done",
    skip: "Skip",
    counter: (n, total) => `Step ${n} of ${total}`,
    searchWord: "pantry",
    steps: {
      welcome: {
        title: "Welcome!",
        body: "This map shows places to get food across Pueblo County, and many of them are run by neighbors and local groups: food pantries, meal sites, community gardens and Blessing Boxes. Here's a quick look at how it works.",
      },
      search: {
        title: "Search",
        body: "Type the name of a place, or a kind of place like pantry, and the places that match show up as you type.",
      },
      filters: {
        title: "Filters",
        body: "Tap Filters to choose which places the map shows, like the ones open now or the ones that take SNAP or WIC.",
      },
      filterChoices: {
        title: "Filter choices",
        body: "These are the choices, so turn one on to see only places that are open now, take SNAP or WIC, or are one kind of place.",
      },
      pin: {
        title: "Pins",
        body: "Each pin is a place to get food. The color shows what kind of place it is.",
      },
      card: {
        title: "Place details",
        body: "Tap a pin to see its hours, address, and directions. Tap the star to save it.",
      },
      boxesNav: {
        title: "Boxes",
        body: "Tap Boxes to see only the Blessing Boxes, small food boxes that neighbors fill and anyone can take from.",
      },
      boxesMap: {
        title: "Blessing Boxes",
        body: "Each of these pins is a Blessing Box, and you can tap one to see what's in it and when someone last filled it.",
      },
      boxCheckin: {
        title: "Say what's in it",
        body: "When you visit a box, tap I filled it, I used this box or It's empty, so the next neighbor knows what to expect.",
      },
      boxPhoto: {
        title: "Add a photo",
        body: "You can add a photo of the box, so people can see what's inside before they go.",
      },
      boxHelp: {
        title: "Help a box",
        body: "Apply to sponsor a box you'd like to look after, or ask for an email when it needs filling.",
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
    skip: "Saltar", // [CHECK]
    counter: (n, total) => `Paso ${n} de ${total}`,
    searchWord: "despensa",
    steps: {
      welcome: {
        title: "¡Bienvenidos!", // [CHECK]
        body: "Este mapa muestra lugares para conseguir comida en todo el condado de Pueblo, y muchos los manejan vecinos y grupos locales: despensas, comedores comunitarios, huertos comunitarios y Cajas de bendiciones. Aquí te mostramos cómo funciona.", // [CHECK]
      },
      search: {
        title: "Buscar",
        body: "Escribe el nombre de un lugar o un tipo de lugar, como despensa, y los lugares que coinciden aparecen mientras escribes.", // [CHECK]
      },
      filters: {
        title: "Filtros",
        body: "Toca Filtros para elegir qué lugares muestra el mapa, como los que están abiertos ahora o los que aceptan SNAP o WIC.", // [CHECK]
      },
      filterChoices: {
        title: "Opciones de filtro", // [CHECK]
        body: "Estas son las opciones, así que activa una para ver solo lugares abiertos ahora, que aceptan SNAP o WIC, o de un solo tipo.", // [CHECK]
      },
      pin: {
        title: "Marcadores", // [CHECK]
        body: "Cada marcador es un lugar para conseguir comida. El color muestra qué tipo de lugar es.", // [CHECK]
      },
      card: {
        title: "Detalles del lugar", // [CHECK]
        body: "Toca un marcador para ver su horario, dirección y cómo llegar. Toca la estrella para guardarlo.", // [CHECK]
      },
      boxesNav: {
        // Matches the ES bottom-nav label (i18n.ts nav.boxes = "Cajas").
        title: "Cajas",
        body: "Toca Cajas para ver solo las Cajas de bendiciones, pequeñas cajas de comida que los vecinos llenan y de las que cualquiera puede tomar.", // [CHECK]
      },
      boxesMap: {
        title: "Cajas de bendiciones", // [CHECK]
        body: "Cada uno de estos marcadores es una Caja de bendiciones, y puedes tocar uno para ver qué tiene y cuándo la surtieron por última vez.", // [CHECK]
      },
      boxCheckin: {
        title: "Cuenta qué tiene", // [CHECK]
        body: "Cuando visites una caja, toca La surtí, Usé esta caja o Está vacía, para que el próximo vecino sepa qué esperar.", // [CHECK]
      },
      boxPhoto: {
        title: "Agregar una foto", // [CHECK]
        body: "Puedes agregar una foto de la caja, para que la gente vea qué tiene antes de ir.", // [CHECK]
      },
      boxHelp: {
        title: "Ayuda a una caja", // [CHECK]
        body: "Solicita ser patrocinador de una caja que quieras cuidar, o pide un correo cuando necesite surtido.", // [CHECK]
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
