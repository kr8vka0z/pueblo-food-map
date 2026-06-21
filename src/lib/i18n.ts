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
  "filter.wic": "Accepts WIC",
  "filter.walkingDistance": "Walking distance",
  "filter.favorites": "Favorites",

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
  "detail.plentifulLink": "See hours, eligibility & what to bring on Plentiful",
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

  // Splash page (#68, #100)
  "splash.tagline": "Find food close to home — pantries, gardens, grocery, and more.",
  "splash.purpose": "A free, community-built map of food resources across Pueblo County.",
  "splash.cta.primary": "Find food near me",
  "splash.microcopy": "We only use your location to show food nearby. Nothing is saved.",

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

  // Location control (#108)
  "locate.locating": "Locating…",
  "locate.recenter": "Re-center",
  "locate.outsideCounty": "Your location is outside Pueblo County",

  // Saved places (#132)
  "menu.saved.heading": "Saved places",

  // Hamburger menu (#71, #96, #99, #109)
  "menu.open": "Open menu",
  "menu.close": "Close menu",
  "menu.title": "Pueblo Food Map",
  "menu.help.heading": "Get help",
  "menu.help.211": "2-1-1 Colorado — find help",
  "menu.help.snap": "Apply for SNAP",
  "menu.help.wic": "Apply for WIC",
  "menu.help.doubleup": "Double Up Food Bucks",
  "menu.help.hotline": "Food hotline: 855-855-4626",
  "menu.suggest": "Suggest a venue",
  "menu.about": "About Pueblo Food Project",
  "menu.showWelcome": "Show welcome screen",
  "menu.language": "Language / Idioma",
  "menu.view": "View",

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

  // Hamburger menu — feedback item (#116)
  "menu.feedback": "Send us feedback",

  // Feedback form (#116)
  "feedback.title": "Send us feedback",
  "feedback.subtitle": "Compliments, bug reports, or feature ideas — we want to hear it.",
  "feedback.type.label": "Feedback type",
  "feedback.type.placeholder": "Select a type",
  "feedback.type.positive": "Positive / compliment",
  "feedback.type.problem": "Problem or bug",
  "feedback.type.feature": "Feature request",
  "feedback.type.other": "Other",
  "feedback.message.label": "Message",
  "feedback.message.placeholder": "Tell us more…",
  "feedback.email.label": "Your email",
  "feedback.email.placeholder": "email@example.com",
  "feedback.email.hint": "Needed so we can follow up with you.",
  "feedback.submit": "Send feedback",
  "feedback.submitting": "Sending…",
  "feedback.fallback": "Or email us at feedback@pueblofoodmap.com",
  "feedback.backToMap": "Back to map",
  "feedback.success.title": "Thank you!",
  "feedback.success.body": "Your feedback has been sent. We read every message and use it to improve the map.",
  "feedback.error.title": "Something went wrong",
  "feedback.error.body": "Your feedback couldn't be sent. Please try again, or email us directly at feedback@pueblofoodmap.com.",
  "feedback.error.retry": "Try again",
  "feedback.validation.typeRequired": "Please select a feedback type.",
  "feedback.validation.messageRequired": "Please enter a message.",
  "feedback.validation.emailRequired": "Please enter your email address.",
  "feedback.validation.emailInvalid": "Please enter a valid email address.",
  "feedback.error.rateLimit": "Too many submissions from this address. Please try again in an hour.",

  // Favorites (#132)
  "favorite.add": "Add {name} to saved",
  "favorite.remove": "Remove {name} from saved",
  "favorite.addGeneric": "Add to saved",
  "favorite.removeGeneric": "Remove from saved",

  // Share (#132)
  "share.label": "Share {name}",
  "share.labelGeneric": "Share this place",
  "share.copied": "Link copied",

  // View toggle (#129)
  "view.map": "Map",
  "view.list": "List",
  "view.toggleAria": "Choose map or list view",

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

  // Turnstile (#162)
  "form.turnstile.verifying": "Verifying…",
  "form.turnstile.error": "Couldn't verify you're human — please retry.",

  // Splash dialog (#162)
  "splash.dialogLabel": "Welcome — find food near you",

  // Short pin aria labels. category.full.* stays longer for chips and detail panels.
  // Screen readers hear each pin in a cluster, so ES copy stays conversational per #162.
  "marker.category.pantry": "Food pantry",
  "marker.category.grocery": "Grocery store",
  "marker.category.convenience": "Convenience store",
  "marker.category.farm": "Farm",
  "marker.category.garden": "Community garden",
  "marker.category.edible_landscape": "Edible landscape",
  "marker.category.meal_site": "Meal site",

  // External links (#162)
  "menu.opensInNewTab": "(opens in new tab)",

  // Map loading fallback — shown while dynamic import resolves (#i18n-leaks)
  "map.loading": "Loading map…",

  // Map unavailable fallback — shown when WebGL/Mapbox cannot initialize (#165)
  "map.unavailableTitle": "Map unavailable",
  "map.unavailableBody": "The interactive map can't load on this device, so we're showing the list instead.",

  // LanguageToggle group aria-label (#i18n-leaks)
  "lang.toggle.label": "Language selection",

  // CategoryChips group aria-label (#i18n-leaks)
  "chips.filterByCategory": "Filter by category",

  // SuggestForm SNAP/WIC fieldset legend — WCAG 1.3.1 (#i18n-leaks)
  "suggest.benefits.legend": "Accepted benefits",

  // Privacy disclosure (#160 1.7) — shown near email fields on all 3 forms
  // and on the /privacy page. One sentence that fits below an email input.
  "privacy.emailDisclosure": "Your email is used only to follow up on your submission. It is never sold or shared.",
  "privacy.linkLabel": "Privacy",
  "privacy.pageTitle": "Privacy — Pueblo Food Map",
  "privacy.heading": "Privacy",
  "privacy.body": "Pueblo Food Map collects only the information you type into our forms (venue reports, suggestions, and feedback). That information is used to review your submission and, if you provide an email address, to follow up with you. We do not sell, share, or store your contact information beyond what is needed to respond. IP addresses are used only for spam protection and are not logged or retained. No tracking cookies, advertising pixels, or analytics services are used.",

  // Directions (#134) — Walk / Bus / Drive buttons on venue detail cards
  "directions.walk": "Walk",
  "directions.bus": "Bus",
  "directions.drive": "Drive",
  "directions.walkAriaLabel": "Walking directions to {name} (opens on map)",
  "directions.busAriaLabel": "Bus directions to {name} (opens in new tab)",
  "directions.driveAriaLabel": "Drive directions to {name} (opens in new tab)",
  "directions.routeDistance": "{distance} walk",
  "directions.routeDuration": "{duration}",
  "directions.clearRoute": "Clear walking route",
  // Turn-by-turn step list (#134 enhancement)
  "directions.showSteps": "Show steps",
  "directions.hideSteps": "Hide steps",
  "directions.stepsListLabel": "Turn-by-turn directions",
  // Per-step distance suffixes — used when formatting short distances in the step list.
  // "ft" for sub-528 ft steps (sub-0.1 mi), otherwise the decimal miles value.
  "directions.stepFt": "{distance} ft",
  "directions.stepMi": "{distance} mi",
  // Google Maps walk handoff (#134 enhancement)
  "directions.openInGoogleMaps": "Open in Google Maps",
  "directions.openInGoogleMapsAria": "Open walking directions to {name} in Google Maps (opens in new tab)",

  // About page (#155) — DRAFT copy pending final text from Kyle / Pueblo Food Project
  "about.heading": "About Pueblo Food Map",
  "about.backToMap": "Back to map",
  "about.mission.heading": "Our mission",
  "about.mission.body": "Pueblo Food Map puts every free and low-cost food resource in Pueblo County on one mobile-friendly map — so anyone, in any neighborhood, can find what they need in minutes.",
  "about.vision.heading": "Our vision",
  "about.vision.body": "A Pueblo County where no one goes hungry because they couldn't find the resources already available in their community.",
  "about.origin.heading": "How it started",
  "about.origin.body": "Finding food assistance in Pueblo meant juggling separate tools — the Pueblo Food Project site, Plentiful, FoodFinder, Pueblo Transit, and 211. Pueblo Food Map consolidates those sources into a single, bilingual map that works on any smartphone, no app install required.",
  "about.howWeSource.heading": "How venues are added",
  "about.howWeSource.body": "Venue data comes from Pueblo Food Project, OpenStreetMap, Plentiful's public directory, and USDA benefit data. All listings are reviewed before going live. If you know of a resource we're missing, please suggest it.",
  "about.suggest.heading": "Know something we're missing?",
  "about.suggest.body": "If you know of a food pantry, community garden, or other resource that isn't on the map yet, let us know.",
  "about.suggest.cta": "Suggest a venue",

  // Nav and footer shared strings (#155)
  "nav.about": "About this map",
  "footer.backToMap": "Back to map",
  "footer.about": "About",
  "footer.privacy": "Privacy",
  "footer.suggest": "Suggest a venue",
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
  "filter.wic": "Acepta WIC",
  "filter.walkingDistance": "Distancia caminando",
  "filter.favorites": "Favoritos",

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
  "detail.plentifulLink": "Ver horarios, elegibilidad y qué llevar en Plentiful",
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

  // Splash page (#68, #100)
  "splash.tagline": "Encuentra alimentos cerca de casa — despensas, huertos, supermercados y más.",
  "splash.purpose": "Un mapa comunitario y gratuito de recursos alimentarios en el condado de Pueblo.",
  "splash.cta.primary": "Encuentra comida cerca de mí",
  "splash.microcopy": "Solo usamos tu ubicación para mostrar alimentos cercanos. Nada se guarda.",

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

  // Location control (#108)
  "locate.locating": "Localizando…",
  "locate.recenter": "Recentrar",
  "locate.outsideCounty": "Tu ubicación está fuera del condado de Pueblo",

  // Saved places (#132)
  "menu.saved.heading": "Lugares guardados",

  // Hamburger menu (#71, #96, #99, #109)
  "menu.open": "Abrir menú",
  "menu.close": "Cerrar menú",
  "menu.title": "Pueblo Food Map",
  "menu.help.heading": "Obtener ayuda",
  "menu.help.211": "2-1-1 Colorado — buscar ayuda",
  "menu.help.snap": "Solicitar SNAP",
  "menu.help.wic": "Solicitar WIC",
  "menu.help.doubleup": "Double Up Food Bucks",
  "menu.help.hotline": "Línea de ayuda: 855-855-4626",
  "menu.suggest": "Sugerir un lugar",
  "menu.about": "Acerca de Pueblo Food Project",
  "menu.showWelcome": "Mostrar pantalla de bienvenida",
  "menu.language": "Language / Idioma",
  "menu.view": "Vista",

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

  // Hamburger menu — feedback item (#116)
  "menu.feedback": "Envíanos tu opinión",

  // Feedback form (#116)
  "feedback.title": "Envíanos tu opinión",
  "feedback.subtitle": "Felicitaciones, reportes de problemas o ideas — queremos escucharte.",
  "feedback.type.label": "Tipo de comentario",
  "feedback.type.placeholder": "Selecciona un tipo",
  "feedback.type.positive": "Positivo / felicitación",
  "feedback.type.problem": "Problema o error",
  "feedback.type.feature": "Solicitud de función",
  "feedback.type.other": "Otro",
  "feedback.message.label": "Mensaje",
  "feedback.message.placeholder": "Cuéntanos más…",
  "feedback.email.label": "Tu correo electrónico",
  "feedback.email.placeholder": "correo@ejemplo.com",
  "feedback.email.hint": "Lo necesitamos para poder darte seguimiento.",
  "feedback.submit": "Enviar comentario",
  "feedback.submitting": "Enviando…",
  "feedback.fallback": "O escríbenos a feedback@pueblofoodmap.com",
  "feedback.backToMap": "Volver al mapa",
  "feedback.success.title": "¡Gracias!",
  "feedback.success.body": "Tu comentario ha sido enviado. Leemos cada mensaje y lo usamos para mejorar el mapa.",
  "feedback.error.title": "Algo salió mal",
  "feedback.error.body": "No se pudo enviar tu comentario. Por favor intenta de nuevo, o escríbenos directamente a feedback@pueblofoodmap.com.",
  "feedback.error.retry": "Intentar de nuevo",
  "feedback.validation.typeRequired": "Por favor selecciona un tipo de comentario.",
  "feedback.validation.messageRequired": "Por favor ingresa un mensaje.",
  "feedback.validation.emailRequired": "Por favor ingresa tu correo electrónico.",
  "feedback.validation.emailInvalid": "Por favor ingresa un correo electrónico válido.",
  "feedback.error.rateLimit": "Demasiados envíos desde esta dirección. Por favor intenta de nuevo en una hora.",

  // Favorites (#132)
  "favorite.add": "Agregar {name} a guardados",
  "favorite.remove": "Quitar {name} de guardados",
  "favorite.addGeneric": "Agregar a guardados",
  "favorite.removeGeneric": "Quitar de guardados",

  // Share (#132)
  "share.label": "Compartir {name}",
  "share.labelGeneric": "Compartir este lugar",
  "share.copied": "Enlace copiado",

  // View toggle (#129)
  "view.map": "Mapa",
  "view.list": "Lista",
  "view.toggleAria": "Elegir vista de mapa o lista",

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

  // Turnstile (#162)
  "form.turnstile.verifying": "Verificando…",
  "form.turnstile.error": "No pudimos verificar que eres humano. Por favor intenta de nuevo.",

  // Splash dialog (#162)
  "splash.dialogLabel": "Bienvenido — encuentra comida cerca de ti",

  // Map marker aria — short conversational labels (#162)
  "marker.category.pantry": "Despensa",
  "marker.category.grocery": "Supermercado",
  "marker.category.convenience": "Conveniencia",
  "marker.category.farm": "Granja",
  "marker.category.garden": "Huerto",
  "marker.category.edible_landscape": "Paisaje comestible",
  "marker.category.meal_site": "Comedor",

  // External links (#162)
  "menu.opensInNewTab": "(se abre en una pestaña nueva)",

  // Map loading fallback (#i18n-leaks)
  "map.loading": "Cargando mapa…",

  // Map unavailable fallback (#165)
  "map.unavailableTitle": "Mapa no disponible",
  "map.unavailableBody": "El mapa interactivo no se puede cargar en este dispositivo, así que mostramos la lista.",

  // LanguageToggle group aria-label (#i18n-leaks)
  "lang.toggle.label": "Selección de idioma",

  // CategoryChips group aria-label (#i18n-leaks)
  "chips.filterByCategory": "Filtrar por categoría",

  // SuggestForm SNAP/WIC fieldset legend (#i18n-leaks)
  "suggest.benefits.legend": "Beneficios aceptados",

  // Privacy disclosure (#160 1.7)
  "privacy.emailDisclosure": "Tu correo solo se usa para darte seguimiento. Nunca lo vendemos ni compartimos.",
  "privacy.linkLabel": "Privacidad",
  "privacy.pageTitle": "Privacidad — Pueblo Food Map",
  "privacy.heading": "Privacidad",
  "privacy.body": "Pueblo Food Map solo recopila la información que escribes en nuestros formularios (reportes de lugares, sugerencias y comentarios). Esa información se usa para revisar tu envío y, si proporcionas un correo, para darte seguimiento. No vendemos, compartimos ni guardamos tu información de contacto más allá de lo necesario para responder. Las direcciones IP solo se usan para protección contra spam y no se registran ni retienen. No usamos cookies de seguimiento, píxeles de publicidad ni servicios de análisis.",

  // Directions (#134) — Walk / Bus / Drive buttons on venue detail cards
  "directions.walk": "Caminar",
  "directions.bus": "Autobús",
  "directions.drive": "Manejar",
  "directions.walkAriaLabel": "Cómo llegar caminando a {name} (se muestra en el mapa)",
  "directions.busAriaLabel": "Cómo llegar en autobús a {name} (se abre en una pestaña nueva)",
  "directions.driveAriaLabel": "Cómo llegar manejando a {name} (se abre en una pestaña nueva)",
  "directions.routeDistance": "{distance} caminando",
  "directions.routeDuration": "{duration}",
  "directions.clearRoute": "Eliminar ruta a pie",
  // Turn-by-turn step list (#134 enhancement)
  "directions.showSteps": "Ver indicaciones",
  "directions.hideSteps": "Ocultar indicaciones",
  "directions.stepsListLabel": "Indicaciones paso a paso",
  // Per-step distance suffixes
  "directions.stepFt": "{distance} pies",
  "directions.stepMi": "{distance} mi",
  // Google Maps walk handoff (#134 enhancement)
  "directions.openInGoogleMaps": "Abrir en Google Maps",
  "directions.openInGoogleMapsAria": "Abrir indicaciones a pie a {name} en Google Maps (se abre en una pestaña nueva)",

  // About page (#155) — BORRADOR de texto pendiente aprobación de Kyle / Pueblo Food Project
  "about.heading": "Acerca de Pueblo Food Map",
  "about.backToMap": "Volver al mapa",
  "about.mission.heading": "Nuestra misión",
  "about.mission.body": "Pueblo Food Map pone todos los recursos de alimentos gratuitos y de bajo costo del condado de Pueblo en un mapa fácil de usar en el celular, para que cualquier persona, en cualquier colonia, pueda encontrar lo que necesita en minutos.",
  "about.vision.heading": "Nuestra visión",
  "about.vision.body": "Un condado de Pueblo donde nadie pase hambre por no poder encontrar los recursos disponibles en su comunidad.",
  "about.origin.heading": "Cómo comenzó",
  "about.origin.body": "Encontrar apoyo alimentario en Pueblo requería usar varias herramientas por separado: el sitio de Pueblo Food Project, Plentiful, FoodFinder, Pueblo Transit y el 211. Pueblo Food Map consolida esas fuentes en un solo mapa bilingüe que funciona en cualquier celular, sin necesidad de instalar una aplicación.",
  "about.howWeSource.heading": "Cómo agregamos lugares",
  "about.howWeSource.body": "Los datos de los lugares provienen de Pueblo Food Project, OpenStreetMap, el directorio público de Plentiful y datos de beneficios del USDA. Todos los registros se revisan antes de publicarse. Si conoces un recurso que no está en el mapa, puedes sugerirlo.",
  "about.suggest.heading": "¿Sabes de algo que nos falta?",
  "about.suggest.body": "Si conoces una despensa comunitaria, huerto o algún otro recurso alimentario que aún no está en el mapa, cuéntanos.",
  "about.suggest.cta": "Sugerir un lugar",

  // Nav and footer shared strings (#155)
  "nav.about": "Acerca de este mapa",
  "footer.backToMap": "Volver al mapa",
  "footer.about": "Acerca de",
  "footer.privacy": "Privacidad",
  "footer.suggest": "Sugerir un lugar",
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

/**
 * Exposed for test parity checks only, not runtime UI.
 * Key sets and placeholders must stay aligned between en and es when adding copy.
 */
export const I18N_DICTIONARIES = { en, es } as const;
