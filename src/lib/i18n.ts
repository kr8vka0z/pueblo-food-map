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
  "detail.showDetails": "Show details",
  "detail.hideDetails": "Hide details",
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

  // Wordmark (#61)
  "wordmark.ariaLabel": "Pueblo Food Map — reset map view",

  // Search typeahead (#67)
  "typeahead.matchCount": "{count} venues match",
  "typeahead.moreMatches": "+{count} more matches",
  "typeahead.noMatch": "No venues match",

  // Hamburger menu (#71, #96, #99)
  "menu.open": "Open menu",
  "menu.close": "Close menu",
  "menu.suggest": "Suggest a venue",
  "menu.about": "About Pueblo Food Project",
  "menu.showWelcome": "Show welcome screen",

  // Category browse dropdown (#95)
  "categoryBrowse.clearFilter": "Clear category filter",

  // Suggest form (#71)
  "suggest.title": "Suggest a venue",
  "suggest.subtitle": "Know a food resource we're missing? Tell us about it.",
  "suggest.venueName.label": "Venue name",
  "suggest.venueName.placeholder": "e.g. Eastside Food Pantry",
  "suggest.address.label": "Address",
  "suggest.address.placeholder": "123 Main St, Pueblo, CO",
  "suggest.category.label": "Category",
  "suggest.category.placeholder": "Select a category",
  "suggest.category.pantry": "Food Pantry",
  "suggest.category.grocery": "Grocery / Supermarket",
  "suggest.category.convenience": "Convenience Store",
  "suggest.category.farm": "Farm / Market",
  "suggest.category.garden": "Community Garden",
  "suggest.category.edible_landscape": "Edible Landscape",
  "suggest.category.meal_site": "Meal Site",
  "suggest.hours.label": "Hours (optional)",
  "suggest.hours.placeholder": "e.g. Mon–Fri 9am–5pm",
  "suggest.contact.label": "Contact info (optional)",
  "suggest.contact.placeholder": "Phone, email, or website URL",
  "suggest.snap.label": "Accepts SNAP",
  "suggest.wic.label": "Accepts WIC",
  "suggest.notes.label": "Additional notes (optional)",
  "suggest.notes.placeholder": "Anything else we should know?",
  "suggest.submitterEmail.label": "Your email (optional)",
  "suggest.submitterEmail.placeholder": "email@example.com",
  "suggest.submitterEmail.hint": "Only used if we need to follow up with you.",
  "suggest.submit": "Submit suggestion",
  "suggest.submitting": "Sending…",
  "suggest.fallback": "Or email us at suggestions@pueblofoodmap.com",
  "suggest.backToMap": "Back to map",
  "suggest.success.title": "Thank you!",
  "suggest.success.body": "Your suggestion has been submitted. We review all suggestions and will add verified venues to the map.",
  "suggest.error.title": "Something went wrong",
  "suggest.error.body": "Your suggestion couldn't be sent. Please try again, or email us directly at suggestions@pueblofoodmap.com.",
  "suggest.error.retry": "Try again",
  "suggest.validation.nameRequired": "Please enter a venue name.",
  "suggest.validation.addressRequired": "Please enter an address.",
  "suggest.validation.categoryRequired": "Please select a category.",
  "suggest.validation.emailInvalid": "Please enter a valid email address.",
  "suggest.error.rateLimit": "Too many submissions from this address. Please try again in an hour.",

  // Report form (#70)
  "report.button": "Report an issue with this venue",
  "report.title": "Report an issue",
  "report.subtitle": "Help us keep this information accurate.",
  "report.venueLabel": "Venue",
  "report.issueType.label": "What's wrong?",
  "report.issueType.placeholder": "Select an issue type",
  "report.issueType.location": "Location is wrong (wrong address or pin position)",
  "report.issueType.hours": "Hours are wrong or out of date",
  "report.issueType.contact": "Contact info (phone / email / URL) is wrong",
  "report.issueType.closed": "Venue has closed permanently",
  "report.issueType.snapwic": "SNAP / WIC acceptance is wrong",
  "report.issueType.other": "Other",
  "report.description.label": "Description",
  "report.description.placeholder": "Tell us more about the issue (required, at least 10 characters)",
  "report.email.label": "Your email (optional)",
  "report.email.placeholder": "email@example.com",
  "report.email.hint": "Only used if we need to follow up with you.",
  "report.submit": "Submit report",
  "report.submitting": "Sending…",
  "report.fallback": "Or email us at issues@pueblofoodmap.com",
  "report.backToMap": "Back to map",
  "report.success.title": "Thank you!",
  "report.success.body": "Your report has been sent. We review all submissions and will update the map as we verify changes.",
  "report.error.title": "Something went wrong",
  "report.error.body": "Your report couldn't be sent. Please try again, or email us directly at issues@pueblofoodmap.com.",
  "report.error.retry": "Try again",
  "report.validation.issueTypeRequired": "Please select an issue type.",
  "report.validation.descriptionRequired": "Please describe the issue (at least 10 characters).",
  "report.validation.emailInvalid": "Please enter a valid email address.",
  "report.error.rateLimit": "Too many submissions from this address. Please try again in an hour.",
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
  "detail.showDetails": "Ver detalles",
  "detail.hideDetails": "Ocultar detalles",
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

  // Wordmark (#61)
  "wordmark.ariaLabel": "Mapa de alimentos de Pueblo — restablecer vista",

  // Search typeahead (#67)
  "typeahead.matchCount": "{count} lugares coinciden",
  "typeahead.moreMatches": "+{count} más resultados",
  "typeahead.noMatch": "Ningún lugar coincide",

  // Hamburger menu (#71, #96, #99)
  "menu.open": "Abrir menú",
  "menu.close": "Cerrar menú",
  "menu.suggest": "Sugerir un lugar",
  "menu.about": "About Pueblo Food Project",
  "menu.showWelcome": "Mostrar pantalla de bienvenida",

  // Category browse dropdown (#95)
  "categoryBrowse.clearFilter": "Borrar filtro de categoría",

  // Suggest form (#71)
  "suggest.title": "Sugerir un lugar",
  "suggest.subtitle": "¿Conoces un recurso alimentario que nos falta? Cuéntanos.",
  "suggest.venueName.label": "Nombre del lugar",
  "suggest.venueName.placeholder": "p. ej. Despensa Eastside",
  "suggest.address.label": "Dirección",
  "suggest.address.placeholder": "123 Main St, Pueblo, CO",
  "suggest.category.label": "Categoría",
  "suggest.category.placeholder": "Selecciona una categoría",
  "suggest.category.pantry": "Despensa de alimentos",
  "suggest.category.grocery": "Supermercado",
  "suggest.category.convenience": "Tienda de conveniencia",
  "suggest.category.farm": "Granja / Mercado",
  "suggest.category.garden": "Huerto comunitario",
  "suggest.category.edible_landscape": "Paisaje comestible",
  "suggest.category.meal_site": "Comedor comunitario",
  "suggest.hours.label": "Horario (opcional)",
  "suggest.hours.placeholder": "p. ej. Lun–Vie 9am–5pm",
  "suggest.contact.label": "Información de contacto (opcional)",
  "suggest.contact.placeholder": "Teléfono, correo o sitio web",
  "suggest.snap.label": "Acepta SNAP",
  "suggest.wic.label": "Acepta WIC",
  "suggest.notes.label": "Notas adicionales (opcional)",
  "suggest.notes.placeholder": "¿Algo más que debamos saber?",
  "suggest.submitterEmail.label": "Tu correo electrónico (opcional)",
  "suggest.submitterEmail.placeholder": "correo@ejemplo.com",
  "suggest.submitterEmail.hint": "Solo se usa si necesitamos hacerte un seguimiento.",
  "suggest.submit": "Enviar sugerencia",
  "suggest.submitting": "Enviando…",
  "suggest.fallback": "O escríbenos a suggestions@pueblofoodmap.com",
  "suggest.backToMap": "Volver al mapa",
  "suggest.success.title": "¡Gracias!",
  "suggest.success.body": "Tu sugerencia ha sido enviada. Revisamos todas las sugerencias y agregaremos los lugares verificados al mapa.",
  "suggest.error.title": "Algo salió mal",
  "suggest.error.body": "No se pudo enviar tu sugerencia. Por favor intenta de nuevo, o escríbenos directamente a suggestions@pueblofoodmap.com.",
  "suggest.error.retry": "Intentar de nuevo",
  "suggest.validation.nameRequired": "Por favor ingresa el nombre del lugar.",
  "suggest.validation.addressRequired": "Por favor ingresa una dirección.",
  "suggest.validation.categoryRequired": "Por favor selecciona una categoría.",
  "suggest.validation.emailInvalid": "Por favor ingresa un correo electrónico válido.",
  "suggest.error.rateLimit": "Demasiados envíos desde esta dirección. Por favor intenta de nuevo en una hora.",

  // Report form (#70)
  "report.button": "Reportar un problema con este lugar",
  "report.title": "Reportar un problema",
  "report.subtitle": "Ayúdanos a mantener esta información actualizada.",
  "report.venueLabel": "Lugar",
  "report.issueType.label": "¿Qué está mal?",
  "report.issueType.placeholder": "Selecciona un tipo de problema",
  "report.issueType.location": "La ubicación es incorrecta (dirección o pin equivocado)",
  "report.issueType.hours": "El horario es incorrecto o está desactualizado",
  "report.issueType.contact": "La información de contacto (teléfono / correo / URL) es incorrecta",
  "report.issueType.closed": "El lugar cerró permanentemente",
  "report.issueType.snapwic": "La aceptación de SNAP / WIC es incorrecta",
  "report.issueType.other": "Otro",
  "report.description.label": "Descripción",
  "report.description.placeholder": "Cuéntanos más sobre el problema (requerido, al menos 10 caracteres)",
  "report.email.label": "Tu correo electrónico (opcional)",
  "report.email.placeholder": "correo@ejemplo.com",
  "report.email.hint": "Solo se usa si necesitamos hacerte un seguimiento.",
  "report.submit": "Enviar reporte",
  "report.submitting": "Enviando…",
  "report.fallback": "O escríbenos a issues@pueblofoodmap.com",
  "report.backToMap": "Volver al mapa",
  "report.success.title": "¡Gracias!",
  "report.success.body": "Tu reporte ha sido enviado. Revisamos todos los envíos y actualizaremos el mapa cuando verifiquemos los cambios.",
  "report.error.title": "Algo salió mal",
  "report.error.body": "No se pudo enviar tu reporte. Por favor intenta de nuevo, o escríbenos directamente a issues@pueblofoodmap.com.",
  "report.error.retry": "Intentar de nuevo",
  "report.validation.issueTypeRequired": "Por favor selecciona un tipo de problema.",
  "report.validation.descriptionRequired": "Por favor describe el problema (al menos 10 caracteres).",
  "report.validation.emailInvalid": "Por favor ingresa un correo electrónico válido.",
  "report.error.rateLimit": "Demasiados envíos desde esta dirección. Por favor intenta de nuevo en una hora.",
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
