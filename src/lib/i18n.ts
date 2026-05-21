/**
 * Tiny i18n shim. t(key, locale) reads from the EN dictionary first.
 * Added in PR 3: full Mexican Spanish (es) dictionary covering every UI
 * string. t() falls back to EN if a key is missing in ES (defensive).
 */

export type Locale = "en" | "es";

const en: Record<string, string> = {
  // App
  "app.name": "Pueblo Food Map",
  "app.tagline": "Food resources in Pueblo County, CO",

  // Top bar
  "topbar.locate": "Show my location on the map",
  "topbar.locale.en": "EN",
  "topbar.locale.es": "ES",

  // Search
  "search.placeholder": "Search venues or address…",
  "search.aria": "Search venues",
  "search.shortcut": "⌘K",

  // Category labels
  "category.all": "All",
  "category.pantry": "Pantry",
  "category.grocery": "Grocery",
  "category.convenience": "Convenience",
  "category.farm": "Farm",
  "category.garden": "Garden",
  "category.edible_landscape": "Edible Landscape",
  "category.meal_site": "Meal Site",

  // Category labels (full)
  "category.full.pantry": "Food Pantry",
  "category.full.grocery": "Grocery / Supermarket",
  "category.full.convenience": "Convenience Store",
  "category.full.farm": "Farm / Market",
  "category.full.garden": "Community Garden",
  "category.full.edible_landscape": "Edible Landscape",
  "category.full.meal_site": "Meal Site",

  // Category rail section headers
  "rail.categories": "Categories",
  "rail.filters": "Filters",

  // Filters
  "filter.openNow": "Open now",
  "filter.snap": "Accepts SNAP",
  "filter.walkingDistance": "Walking distance",

  // Bottom sheet / list
  "sheet.places": "{count} places near you",
  "sheet.viewList": "View list",
  "sheet.sortedBy": "Sorted by distance",

  // Location status
  "location.loading": "Detecting your location…",
  "location.granted": "Sorted by distance from your location",
  "location.denied": "Showing distance from downtown Pueblo",
  "location.unavailable": "Showing distance from downtown Pueblo",
  "location.fallback": "Showing distance from downtown Pueblo",

  // Venue detail
  "detail.back": "Back",
  "detail.close": "Close",
  "detail.getDirections": "Get directions",
  "detail.hours": "HOURS",
  "detail.contact": "CONTACT",
  "detail.about": "ABOUT",
  "detail.sources": "SOURCES & DATA",
  "detail.lastVerified": "Last verified",
  "detail.acceptsSnap": "Accepts SNAP",
  "detail.acceptsWic": "Accepts WIC",
  "detail.today": "Today",
  "detail.closedToday": "Closed today",
  "detail.seeFullDetails": "See full details →",
  "detail.collapseToSummary": "Collapse to quick summary",
  "detail.venueDetailsPanel": "Venue details panel",
  "detail.venueDetails": "venue details",
  "detail.dragToExpand": "Drag to expand or close venue details",
  "detail.expandDetails": "Expand details for {name}",

  // Badges
  "badge.openNow": "Open now",
  "badge.opensAt": "Opens at {time}",
  "badge.closesAt": "Closes {time}",
  "badge.closedToday": "Closed today",
  "badge.snap": "SNAP",
  "badge.wic": "WIC",

  // Distance
  "distance.fromYou": "from you",
  "distance.youAreHere": "You are here",

  // Days
  "day.mon": "Mon",
  "day.tue": "Tue",
  "day.wed": "Wed",
  "day.thu": "Thu",
  "day.fri": "Fri",
  "day.sat": "Sat",
  "day.sun": "Sun",

  // Closed
  "hours.closed": "Closed",

  // Empty state (PR 3)
  "empty.title": "No places match your filters.",
  "empty.clear": "Clear filters",
  "empty.noMatches": "No matches for \"{query}\"",
  "empty.tryCategoryInstead": "Try a category instead:",
  "empty.showCategoryAria": "Show {label} venues",

  // Sponsor credit (#69)
  "sponsor.text": "Sponsored by Pueblo Food Project",

  // Legend (#72)
  "legend.button_label": "Map legend",

  // Operator attribution (#63)
  "operator.operated_by": "Operated by",

  // Splash page (#68)
  "splash.tagline": "Find food close to home — pantries, gardens, grocery, and more.",
  "splash.cta.primary": "Find food near me",
  "splash.cta.secondary": "Show the Pueblo map",
  "splash.cta.secondary.aria": "Show the Pueblo map without using my location",
  "splash.microcopy": "We only use your location to show food nearby. Nothing is saved.",
  "splash.whatYoullFind": "What you'll find",
  "splash.howItWorks": "How it works →",
  "splash.comingSoon": "Coming soon",

  // Splash categories (#68) — kept in sync with CATEGORIES array in SplashScreen.tsx
  "splash.cat.pantry": "Food pantry",
  "splash.cat.grocery": "Grocery store",
  "splash.cat.convenience": "Convenience store",
  "splash.cat.farm": "Farm",
  "splash.cat.garden": "Community garden",
  "splash.cat.edible_landscape": "Edible landscape",
  "splash.cat.meal_site": "Meal site",

  // Location denied banner (#68)
  "banner.title": "Location turned off",
  "banner.body": "We can’t show food near you without your location. You can still browse the Pueblo map below, or try again.",
  "banner.retry": "Try again",
  "banner.dismiss": "Browse Pueblo map",
};

// ─── Mexican Spanish dictionary (PR 3) ────────────────────────────────────────
// Conventions: Mexican / Latin American Spanish throughout.
// Program names (SNAP, WIC) are kept as-is — they don't translate.
// Keys marked [CHECK] were translated with high confidence but a native
// Mexican-Spanish speaker should review for regional naturalness.

const es: Record<string, string> = {
  // App
  "app.name": "Pueblo Food Map",
  "app.tagline": "Recursos de alimentos en el Condado de Pueblo, CO",

  // Top bar
  "topbar.locate": "Mostrar mi ubicación en el mapa",
  "topbar.locale.en": "EN",
  "topbar.locale.es": "ES",

  // Search
  "search.placeholder": "Buscar lugares o dirección…",
  "search.aria": "Buscar lugares",
  "search.shortcut": "⌘K",

  // Category labels
  "category.all": "Todos",
  "category.pantry": "Despensa",
  "category.grocery": "Supermercado",
  "category.convenience": "Conveniencia",
  "category.farm": "Granja",
  "category.garden": "Huerto",
  "category.edible_landscape": "Paisaje comestible", // [CHECK]
  "category.meal_site": "Comedor",

  // Category labels (full)
  "category.full.pantry": "Despensa de alimentos",
  "category.full.grocery": "Supermercado",
  "category.full.convenience": "Tienda de conveniencia",
  "category.full.farm": "Granja / Mercado",
  "category.full.garden": "Huerto comunitario",
  "category.full.edible_landscape": "Paisaje comestible", // [CHECK]
  "category.full.meal_site": "Comedor comunitario",

  // Category rail section headers
  "rail.categories": "Categorías",
  "rail.filters": "Filtros",

  // Filters
  "filter.openNow": "Abierto ahora",
  "filter.snap": "Acepta SNAP",
  "filter.walkingDistance": "Distancia caminando",

  // Bottom sheet / list
  "sheet.places": "{count} lugares cerca de ti",
  "sheet.viewList": "Ver lista",
  "sheet.sortedBy": "Ordenado por distancia",

  // Location status
  "location.loading": "Detectando tu ubicación…",
  "location.granted": "Ordenado por distancia desde tu ubicación",
  "location.denied": "Mostrando distancia desde el centro de Pueblo",
  "location.unavailable": "Mostrando distancia desde el centro de Pueblo",
  "location.fallback": "Mostrando distancia desde el centro de Pueblo",

  // Venue detail
  "detail.back": "Atrás",
  "detail.close": "Cerrar",
  "detail.getDirections": "Cómo llegar",
  "detail.hours": "HORARIO",
  "detail.contact": "CONTACTO",
  "detail.about": "ACERCA DE",
  "detail.sources": "FUENTES Y DATOS",
  "detail.lastVerified": "Última verificación",
  "detail.acceptsSnap": "Acepta SNAP",
  "detail.acceptsWic": "Acepta WIC",
  "detail.today": "Hoy",
  "detail.closedToday": "Cerrado hoy",
  "detail.seeFullDetails": "Ver detalles completos →",
  "detail.collapseToSummary": "Contraer al resumen",
  "detail.venueDetailsPanel": "Panel de detalles del lugar",
  "detail.venueDetails": "detalles del lugar",
  "detail.dragToExpand": "Arrastrar para expandir o cerrar detalles",
  "detail.expandDetails": "Expandir detalles de {name}",

  // Badges
  "badge.openNow": "Abierto ahora",
  "badge.opensAt": "Abre a las {time}",
  "badge.closesAt": "Cierra a las {time}",
  "badge.closedToday": "Cerrado hoy",
  "badge.snap": "SNAP",
  "badge.wic": "WIC",

  // Distance
  "distance.fromYou": "de ti",
  "distance.youAreHere": "Aquí estás",

  // Days
  "day.mon": "Lun",
  "day.tue": "Mar",
  "day.wed": "Mié",
  "day.thu": "Jue",
  "day.fri": "Vie",
  "day.sat": "Sáb",
  "day.sun": "Dom",

  // Closed
  "hours.closed": "Cerrado",

  // Empty state (PR 3)
  "empty.title": "Ningún lugar coincide con tus filtros.",
  "empty.clear": "Borrar filtros",
  "empty.noMatches": "Sin resultados para \"{query}\"",
  "empty.tryCategoryInstead": "Prueba una categoría:",
  "empty.showCategoryAria": "Mostrar lugares de {label}",

  // Sponsor credit (#69)
  "sponsor.text": "Patrocinado por Pueblo Food Project",

  // Legend (#72)
  "legend.button_label": "Leyenda del mapa",

  // Operator attribution (#63)
  "operator.operated_by": "Operado por",

  // Splash page (#68)
  "splash.tagline": "Encuentra alimentos cerca de casa — despensas, huertos, supermercados y más.",
  "splash.cta.primary": "Buscar alimentos cerca de mí",
  "splash.cta.secondary": "Ver el mapa de Pueblo",
  "splash.cta.secondary.aria": "Ver el mapa de Pueblo sin usar mi ubicación",
  "splash.microcopy": "Solo usamos tu ubicación para mostrar alimentos cercanos. Nada se guarda.",
  "splash.whatYoullFind": "Qué encontrarás",
  "splash.howItWorks": "Cómo funciona →",
  "splash.comingSoon": "Próximamente",

  // Splash categories (#68)
  "splash.cat.pantry": "Despensa de alimentos",
  "splash.cat.grocery": "Supermercado",
  "splash.cat.convenience": "Tienda de conveniencia",
  "splash.cat.farm": "Granja",
  "splash.cat.garden": "Huerto comunitario",
  "splash.cat.edible_landscape": "Paisaje comestible", // [CHECK]
  "splash.cat.meal_site": "Comedor comunitario",

  // Location denied banner (#68)
  "banner.title": "Ubicación desactivada",
  "banner.body": "No podemos mostrar alimentos cercanos sin tu ubicación. Aún puedes explorar el mapa de Pueblo, o intentarlo de nuevo.",
  "banner.retry": "Intentar de nuevo",
  "banner.dismiss": "Explorar el mapa de Pueblo",
};

/** Substitute simple {key} placeholders. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function t(
  key: string,
  locale: Locale = "en",
  vars?: Record<string, string>,
): string {
  const dict = locale === "es" ? es : en;
  // Defensive fallback: if the ES key is missing, use EN.
  const raw = dict[key] ?? en[key] ?? key;
  return vars ? interpolate(raw, vars) : raw;
}
