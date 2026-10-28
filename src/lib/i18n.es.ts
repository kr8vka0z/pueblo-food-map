/**
 * Spanish strings for client components (#723). Loaded by the browser only
 * for a Spanish visitor: SpanishMessages.tsx imports it on the /es tree, and
 * loadSpanish() (i18n.ts) fetches it when an English-tree visitor switches.
 * Same keys as the English client strings in i18n.ts.
 */

// ─── Mexican Spanish dictionary (PR 3) ────────────────────────────────────────
// Conventions: Mexican / Latin American Spanish throughout.
// Program names (SNAP, WIC) are kept as-is — they don't translate.
// Keys marked [CHECK] were translated with high confidence but a native
// Mexican-Spanish speaker should review for regional naturalness.

const es: Record<string, string> = {
  // App
  "app.name": "Pueblo Food Map",
  "app.documentTitle": "Pueblo Food Map — Recursos de alimentos en el Condado de Pueblo, CO",

  "meta.home.title": "Pueblo Food Map — Recursos de alimentos en el Condado de Pueblo, CO",
  "meta.home.description":
    "Encuentra comida gratis y de bajo costo cerca de ti en el Condado de Pueblo, CO — despensas, huertos comunitarios, supermercados y comedores comunitarios, con información sobre SNAP/WIC y direcciones.", // [CHECK]

  // Search
  "search.placeholder": "Buscar",
  "search.aria": "Buscar lugares",

  // Category labels (full)
  "category.full.pantry": "Despensa de alimentos",
  "category.full.grocery": "Supermercado",
  "category.full.convenience": "Tienda de conveniencia",
  "category.full.farm": "Granja / Mercado",
  "category.full.garden": "Huerto comunitario",
  "category.full.edible_landscape": "Paisaje comestible", // [CHECK]
  "category.full.meal_site": "Comedor comunitario",
  "category.full.blessing_box": "Caja de bendiciones", // [CHECK]

  // Filters
  "filter.openNow": "Abierto ahora",
  "filter.snap": "Acepta SNAP",
  "filter.wic": "Acepta WIC",

  // Filters button + side panel (#513)
  "filters.button.label": "Filtros",
  "filters.button.labelActive": "Filtros, {count} activos", // [CHECK]
  "filters.panel.title": "Filtros",
  "filters.panel.close": "Cerrar filtros", // [CHECK]
  "filters.panel.showOnly": "Mostrar solo", // [CHECK]
  "filters.panel.kindOfPlace": "Tipo de lugar", // [CHECK]
  "filters.panel.clearAll": "Borrar todo", // [CHECK]
  "filters.panel.showResults": "Mostrar {count} lugares", // [CHECK]

  // Bottom sheet / list
  "sheet.places": "{count} lugares cerca de ti",
  "sheet.sortedBy": "Ordenado por distancia",

  // Venue detail
  "detail.close": "Cerrar",
  "detail.getDirections": "Cómo llegar",
  "detail.viewOnMap": "Ver en el mapa",
  "detail.hours": "HORARIO",
  "detail.contact": "CONTACTO",
  "detail.about": "ACERCA DE",
  "detail.sources": "FUENTES Y DATOS",
  "detail.acceptsSnap": "Acepta SNAP",
  "detail.acceptsWic": "Acepta WIC",
  "detail.plentifulLink": "Ver horarios, elegibilidad y qué llevar en Plentiful",
  "detail.today": "Hoy",
  "detail.showDetails": "Ver detalles",
  "detail.hideDetails": "Ocultar detalles",
  "detail.venueDetailsPanel": "Panel de detalles del lugar",
  "detail.venueDetails": "detalles del lugar",

  // Badges
  "badge.openNow": "Abierto ahora",
  "badge.opensAt": "Abre a las {time}",
  "badge.closesAt": "Cierra a las {time}",
  "badge.closedToday": "Cerrado hoy",
  "badge.hoursUnknown": "Horario desconocido — llama antes",
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

  // Irregular (monthly-ordinal etc.) schedules (#400)
  "hours.irregular.next": "Próximo: {when}", // [CHECK]
  "hours.irregular.monthlyOrdinal": "{ordinal} {weekday} de cada mes, {slots}", // [CHECK]
  "hours.irregular.monthlyDate": "El día {day} de cada mes, {slots}", // [CHECK]
  "hours.irregular.heading": "Mensual", // [CHECK]
  "hours.irregular.ordinal.1": "1.º", // [CHECK]
  "hours.irregular.ordinal.2": "2.º", // [CHECK]
  "hours.irregular.ordinal.3": "3.º", // [CHECK]
  "hours.irregular.ordinal.4": "4.º", // [CHECK]
  "hours.irregular.ordinal.5": "5.º", // [CHECK]
  "hours.irregular.ordinal.last": "Último", // [CHECK]

  // Empty state (PR 3)
  "empty.title": "Ningún lugar coincide con tus filtros.",
  "empty.clear": "Borrar filtros",
  "empty.noMatches": "Sin resultados para \"{query}\"",
  "empty.tryCategoryInstead": "Prueba una categoría:",
  "empty.showCategoryAria": "Mostrar lugares de {label}",

  // Sponsor credit (#69)

  // Operator attribution (#63)
  "operator.operated_by": "Operado por",

  // Splash page (#68, #100)
  "splash.purpose": "Un mapa comunitario y gratuito de recursos alimentarios en el condado de Pueblo.",
  "splash.microcopy": "Solo usamos tu ubicación para mostrar alimentos cercanos. Nada se guarda.",
  "splash.tour": "Ver cómo funciona", // [CHECK]

  // Location help card (#739) — all [CHECK]: native-speaker review pending.
  "locationCard.denied.title": "Ubicación desactivada", // [CHECK]
  "locationCard.denied.body": "No hay problema, aún puedes encontrar comida.", // [CHECK]
  "locationCard.denied.hint": "Para usar tu ubicación la próxima vez, actívala en la configuración del navegador o del teléfono.", // [CHECK]
  "locationCard.failed.title": "No pudimos encontrarte", // [CHECK]
  "locationCard.failed.body.timeout": "Tu teléfono tardó demasiado en encontrar dónde estás. Esto pasa mucho bajo techo.", // [CHECK]
  "locationCard.failed.body.unavailable": "Tu teléfono no pudo saber dónde estás en este momento.", // [CHECK]
  "locationCard.tapPin": "Toca cualquier punto del mapa para ver horarios y cómo llegar.", // [CHECK]
  "locationCard.retry": "Intentar de nuevo", // [CHECK]

  // Wordmark (#61)
  "wordmark.ariaLabel": "Mapa de alimentos de Pueblo — restablecer vista",

  // Search typeahead (#67)
  "typeahead.matchCount": "{count} lugares coinciden",
  "typeahead.moreMatches": "+{count} más resultados",

  // Location control (#108)
  "locate.locating": "Localizando…",
  "locate.outsideCounty": "Tu ubicación está fuera del condado de Pueblo",

  // Bottom navigation bar (docs/bottom-nav-spec.md §11)
  // "Cercanos" (#516, Kyle 2026-09-19) — matches Google Maps' Spanish
  // wording ("lugares cercanos") and is shorter, so it fits every phone.
  "nav.nearMe": "Cercanos", // [CHECK]
  "nav.saved": "Guardados",
  "nav.boxes": "Cajas", // [CHECK]
  "nav.resources": "Ayuda", // [CHECK]
  "nav.menu": "Menú",
  "nav.aria": "Principal",
  "nav.pageAria": "Página",

  // Saved places (#132)
  "menu.saved.heading": "Lugares guardados",
  "menu.saved.emptyTitle": "Todavía no tienes lugares guardados",
  "menu.saved.emptyBody": "Toca la estrella en cualquier lugar para guardarlo. Aparecerá aquí.",
  "panel.backToSaved": "← Guardados", // [CHECK]

  // Hamburger menu (#71, #96, #99, #109)
  "menu.open": "Abrir menú",
  "menu.close": "Cerrar menú",
  "menu.title": "Pueblo Food Map",
  "menu.suggest": "Sugerir un lugar",
  "menu.sponsoredBy": "Patrocinado por",
  "menu.donate": "Donar",
  "menu.roadmap": "Ideas y novedades",
  "menu.donateSub": "Apoya este mapa y otros proyectos de Pueblo Food Project",
  "credit.builtBy": "Diseñado, creado y administrado por",
  "menu.showWelcome": "Mostrar pantalla de bienvenida",
  "menu.tour": "Aprende a usar este mapa", // [CHECK]
  "menu.language": "Language / Idioma",
  "menu.listView": "Vista de lista",
  "menu.mapView": "Vista de mapa",

  // Suggest form (#71)
  "suggest.title": "Sugerir un lugar",
  "suggest.subtitle": "¿Conoces un recurso alimentario que nos falta? Cuéntanos.",
  "suggest.documentTitle": "Sugerir un lugar",
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
  "suggest.category.blessing_box": "Caja de bendiciones", // [CHECK]
  "suggest.hours.label": "Horario (opcional)",
  "suggest.hours.placeholder": "p. ej. Lun–Vie 9am–5pm",
  "suggest.contact.label": "Información de contacto (opcional)",
  "suggest.contact.placeholder": "Teléfono, correo o sitio web",
  "suggest.snap.label": "Acepta SNAP",
  "suggest.wic.label": "Acepta WIC",
  "suggest.notes.label": "Notas adicionales (opcional)",
  "suggest.notes.placeholder": "¿Algo más que debamos saber?",
  "suggest.submitterEmail.label": "Tu correo electrónico",
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
  "suggest.validation.emailRequired": "Por favor ingresa tu correo electrónico.",
  "suggest.validation.emailInvalid": "Por favor ingresa un correo electrónico válido.",
  "suggest.error.rateLimit": "Demasiados envíos desde esta dirección. Por favor intenta de nuevo en una hora.",

  // Hamburger menu — feedback item (#116)
  "menu.feedback": "Envíanos tu opinión",

  // Feedback form (#116)
  "feedback.title": "Envíanos tu opinión",
  "feedback.documentTitle": "Enviar comentarios",
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

  // View switch — search-bar suggestion row + Menu line (#514).
  "viewSuggestion.seeAsList": "Ver todos los lugares en una lista",
  "viewSuggestion.backToMap": "Volver al mapa",
  "viewSuggestion.placesCount": "{count} lugares",
  "viewSuggestion.seeMatchesAsList": "Ver los {count} resultados en una lista",

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
  "marker.category.blessing_box": "Caja de bendiciones", // [CHECK]

  // Special-event map pins (#758).
  "events.pin.today": "Hoy", // [CHECK]
  "events.pin.nowUntil": "AHORA, hasta {time}", // [CHECK]
  "events.pin.ariaLive": "{name}, evento especial, en curso, hasta {time}", // [CHECK]
  "events.pin.ariaUpcoming": "{name}, evento especial, {day} {time}", // [CHECK]

  // Special-event card (#759).
  "events.card.startsIn.min.one": "Empieza en {n} min", // [CHECK]
  "events.card.startsIn.min.other": "Empieza en {n} min", // [CHECK]
  "events.card.startsIn.hour.one": "Empieza en {n} hora", // [CHECK]
  "events.card.startsIn.hour.other": "Empieza en {n} horas", // [CHECK]
  "events.card.startsIn.day.one": "Empieza en {n} día", // [CHECK]
  "events.card.startsIn.day.other": "Empieza en {n} días", // [CHECK]
  "events.card.endsIn.min.one": "{n} minuto", // [CHECK]
  "events.card.endsIn.min.other": "{n} minutos", // [CHECK]
  "events.card.endsIn.hour.one": "{n} hora", // [CHECK]
  "events.card.endsIn.hour.other": "{n} horas", // [CHECK]
  "events.card.endsIn.day.one": "{n} día", // [CHECK]
  "events.card.endsIn.day.other": "{n} días", // [CHECK]
  "events.card.liveEndsIn": "En curso, termina en {remaining}", // [CHECK]
  "events.card.startsOn": "Empieza el {date}", // [CHECK]
  "events.card.ended": "Este evento ya terminó", // [CHECK]
  "events.card.cancelled": "Cancelado", // [CHECK]
  "events.card.hostedBy": "Organiza: {host}", // [CHECK]
  "events.card.when": "Cuándo", // [CHECK]
  "events.card.where": "Dónde", // [CHECK]
  "events.card.about": "Acerca del evento", // [CHECK]
  "events.card.bring": "Qué llevar", // [CHECK]
  "events.card.directions": "Cómo llegar", // [CHECK]
  "events.card.directionsAria": "Cómo llegar a {name} (se abre en una pestaña nueva)", // [CHECK]
  "events.card.share": "Compartir", // [CHECK]
  "events.card.shareCopied": "Enlace copiado", // [CHECK]
  "events.card.shareManual": "Aquí no se puede compartir. Copia este enlace:", // [CHECK]
  "events.card.calendar": "Agregar al calendario", // [CHECK]
  "events.card.moreInfo": "Más información", // [CHECK]
  "events.card.seeOpenNow": "Ver lugares abiertos ahora", // [CHECK]
  "events.card.endedHelp": "¿Buscas comida hoy? Mira qué está abierto ahora mismo.", // [CHECK]
  "events.card.cancelledNoNote": "Este evento no se llevará a cabo.", // [CHECK]
  "events.card.closeAria": "Cerrar los detalles del evento", // [CHECK]
  "events.here.now": "Evento aquí ahora", // [CHECK]
  "events.here.today": "Evento aquí hoy", // [CHECK]
  "events.here.day": "Evento aquí el {day}", // [CHECK]

  // "Happening today" strip, Events filter and list (#761)
  "events.strip.liveUntil": "En curso, hasta {time}", // [CHECK]
  "events.strip.today": "Hoy {time}", // [CHECK]
  "events.strip.more": "y {count} más", // [CHECK]
  "events.strip.moreAria": "y {count} más, ver la lista de eventos", // [CHECK]
  "events.strip.dismissAria": "Ocultar {name} por hoy", // [CHECK]
  "events.list.heading": "Eventos", // [CHECK]
  "events.list.empty": "No hay eventos próximos", // [CHECK]
  "events.filter.label": "Eventos", // [CHECK]
  "events.filter.showResults.one": "Mostrar {count} evento", // [CHECK]
  "events.filter.showResults.other": "Mostrar {count} eventos", // [CHECK]
  "events.list.emptyAction": "Volver a mostrar lugares", // [CHECK]

  // External links (#162)
  "menu.opensInNewTab": "(se abre en una pestaña nueva)",

  // Map loading fallback (#i18n-leaks)
  "map.loading": "Cargando mapa…",

  // Map unavailable fallback (#165)
  "map.unavailableTitle": "Mapa no disponible",
  "map.unavailableBody": "El mapa interactivo no se puede cargar en este dispositivo, así que mostramos la lista.",

  // Offline fallback (#130)
  "map.offlineTitle": "El mapa necesita conexión", // [CHECK]
  "map.offlineBody": "La lista sigue funcionando.", // [CHECK]

  // LanguageToggle group aria-label (#i18n-leaks)
  "lang.toggle.label": "Selección de idioma",

  // SuggestForm SNAP/WIC fieldset legend (#i18n-leaks)
  "suggest.benefits.legend": "Beneficios aceptados",

  // Privacy disclosure (#160 1.7)
  "privacy.emailDisclosure": "Tu correo solo se usa para darte seguimiento. Nunca lo vendemos ni compartimos.",
  "privacy.linkLabel": "Privacidad",
  "privacy.heading": "Privacidad",
  "privacy.collect.heading": "Qué recopilamos", // [CHECK]
  "privacy.collect.body": "Pueblo Food Map recopila la información que escribes en nuestros formularios (reportes de lugares, sugerencias y comentarios). La usamos para revisar lo que enviaste y, si diste un correo electrónico, para responderte. Tu dirección IP se revisa para bloquear spam cuando envías un formulario, y nunca se guarda junto con lo que enviaste. Los inicios de sesión en el área de administración del sitio, que usa el equipo de Pueblo Food Map, se registran con la hora, el dispositivo y la dirección IP, por seguridad.", // [CHECK]
  "privacy.checkins.heading": "Registros en cajas de bendición", // [CHECK]
  "privacy.checkins.body": "Registrar tu visita a una caja de bendición es anónimo. No pedimos tu nombre ni tu correo, y no guardamos tu dirección IP. Una foto que agregues se revisa antes de publicarse, y los detalles de ubicación ocultos en el archivo de la foto se eliminan.", // [CHECK]
  "privacy.checkins.body2": "Cada registro también usa un identificador aleatorio que tu navegador guarda, para distinguir registros repetidos sin pedirte tu nombre ni tu correo. No está vinculado a quién eres, y borrar los datos del sitio en tu navegador genera uno nuevo.", // [CHECK]
  "privacy.alerts.heading": "Alertas por correo y patrocinio de una caja", // [CHECK]
  "privacy.alerts.body1": "Guardamos tu correo electrónico solo si tú lo pides: cuando te suscribes a alertas de una caja de bendición, o cuando solicitas patrocinar una. Si eres anfitrión de una caja, el personal de Pueblo Food Map puede agregar tu correo, con tu autorización, para avisarte cuando tu caja esté vacía o tenga un problema. Usamos estas direcciones solo para enviar esos correos. Nunca las vendemos, las compartimos, ni las mostramos en el sitio.", // [CHECK]
  "privacy.alerts.body2": "Si patrocinas una caja, el nombre que nos das (por ejemplo, el de un grupo o una familia) se muestra en la tarjeta de esa caja. Tu correo no.", // [CHECK]
  "privacy.alerts.body3": "Cada correo de alerta tiene un enlace para detenerlo. Un clic detiene los correos, sin necesidad de iniciar sesión. Para que eliminemos tu correo por completo, escribe a issues@pueblofoodmap.com.", // [CHECK]
  "privacy.alerts.body4": "Nuestros correos se envían a través de un servicio de correo llamado Resend, que solo maneja tu dirección para entregarlos.", // [CHECK]
  "privacy.retention.heading": "Cuánto tiempo lo guardamos", // [CHECK]
  "privacy.retention.body": "Eliminamos automáticamente las direcciones de correo antiguas de nuestros registros: 90 días después de enviar una sugerencia o reporte de un lugar, de que se rechace una solicitud de patrocinio de caja, o de que canceles una alerta. Esto no afecta la copia que ya enviamos a nuestro propio correo cuando enviaste un formulario, ni un registro interno que el personal administrativo usa para dar seguimiento a decisiones de moderación. El correo de una alerta activa se mantiene hasta que la canceles.", // [CHECK]
  "privacy.other.heading": "Otros servicios que usamos", // [CHECK]
  "privacy.other.body": "Usamos Mapbox para mostrar el mapa. Cargarlo comparte tu dirección IP con Mapbox, y si pides indicaciones para caminar, también tu ubicación. Usamos Cloudflare Turnstile en nuestros formularios y en los registros de cajas para bloquear spam; revisa cierta información sobre tu dispositivo y navegador.", // [CHECK]
  "privacy.analytics": "Usamos PostHog y Cloudflare Web Analytics para ver cómo la gente usa el mapa: qué páginas se ven, los toques en el mapa y sus filtros, las palabras que la gente busca (solo se revisan las búsquedas usadas con frecuencia, nunca una búsqueda individual, esto nos ayuda a encontrar lugares que nos faltan), y una grabación de la actividad en pantalla para ayudarnos a mejorar el sitio. Lo que escribas siempre queda oculto en esa grabación. Ningún servicio usa cookies ni guarda nada en tu dispositivo, y tu dirección IP exacta se descarta antes de usarse para cualquier cosa. Nunca vemos lo que escribes en un formulario, tu ubicación exacta, ni quién eres.", // [CHECK]

  // Directions (#134) — Walk / Bus / Drive buttons on venue detail cards
  "directions.walk": "Caminar",
  "directions.bus": "Autobús",
  "directions.drive": "Manejar",
  "directions.walkAriaLabel": "Cómo llegar caminando a {name} (se muestra en el mapa)",
  "directions.busAriaLabel": "Cómo llegar en autobús a {name} (se abre en una pestaña nueva)",
  "directions.driveAriaLabel": "Cómo llegar manejando a {name} (se abre en una pestaña nueva)",
  "directions.boxAriaLabel": "Cómo llegar a {name} (se abre en una pestaña nueva)", // [CHECK]
  "directions.routeDistance": "{distance} caminando",
  "directions.routeDuration": "{duration}",
  "directions.clearRoute": "Eliminar ruta a pie",
  "directions.showCard": "Mostrar tarjeta", // [CHECK]
  // Walk-without-location hint (#207)
  "directions.locationHint": "Comparte tu ubicación para ver cómo llegar a pie.",
  // Turn-by-turn step list (#134 enhancement). showSteps/hideSteps retired
  // 2026-09-20 (#555) — see the EN dictionary's comment.
  "directions.steps": "Pasos", // [CHECK]
  "directions.stepsListLabel": "Indicaciones paso a paso",
  // #537
  "directions.noStepsForRoute": "No hay indicaciones paso a paso para esta ruta",
  // Per-step distance suffixes
  "directions.stepFt": "{distance} pies",
  "directions.stepMi": "{distance} mi",
  // Step-through stepper (#555) — see the EN dictionary's comment.
  "directions.stepCounter": "Paso {current} de {total}", // [CHECK]
  "directions.stepIn": "En {distance}", // [CHECK]
  "directions.stepArrived": "Has llegado", // [CHECK]
  "directions.stepThen": "Luego: {instruction}", // [CHECK]
  "directions.stepBack": "Giro anterior", // [CHECK]
  "directions.stepNext": "Siguiente giro", // [CHECK]
  "directions.allTurns": "Todos los giros", // [CHECK]
  "directions.fewerTurns": "Menos giros", // [CHECK]
  // Google Maps walk handoff (#134 enhancement)
  "directions.openInGoogleMaps": "Abrir en Google Maps",
  "directions.openInGoogleMapsAria": "Abrir indicaciones a pie a {name} en Google Maps (se abre en una pestaña nueva)",

  // About page (#155) — BORRADOR de texto pendiente aprobación de Kyle / Pueblo Food Project
  "about.heading": "Acerca de Pueblo Food Map",
  "about.documentTitle": "Acerca de",
  "about.mission.heading": "Nuestra misión",
  "about.mission.body": "Pueblo Food Map pone todos los recursos de alimentos gratuitos y de bajo costo del condado de Pueblo en un mapa fácil de usar en el celular, para que cualquier persona, en cualquier colonia, pueda encontrar lo que necesita en minutos.",
  "about.vision.heading": "Nuestra visión",
  "about.vision.body": "Un condado de Pueblo donde nadie pase hambre por no poder encontrar los recursos disponibles en su comunidad.",
  "about.origin.heading": "Cómo comenzó",
  "about.origin.body": "Encontrar apoyo alimentario en Pueblo requería usar varias herramientas por separado: el sitio de Pueblo Food Project, Plentiful, FoodFinder, Pueblo Transit y el 211. Pueblo Food Map consolida esas fuentes en un solo mapa bilingüe que funciona en cualquier celular, sin necesidad de instalar una aplicación.",
  "about.howWeSource.heading": "Cómo agregamos lugares",
  "about.howWeSource.body": "Los datos de los lugares provienen de Pueblo Food Project, OpenStreetMap, el directorio público de Plentiful y datos de beneficios del USDA. Todos los registros se revisan antes de publicarse. Si conoces un recurso que no está en el mapa, puedes sugerirlo.",
  "about.contact.body": "¿Preguntas o ideas para colaborar? Escríbenos a", // [CHECK]
  "about.suggest.heading": "¿Sabes de algo que nos falta?",
  "about.suggest.body": "Si conoces una despensa comunitaria, huerto o algún otro recurso alimentario que aún no está en el mapa, cuéntanos.",
  "about.suggest.cta": "Sugerir un lugar",

  // Nav and footer shared strings (#155)
  "nav.about": "Acerca de este mapa",
  "footer.backToMap": "Volver al mapa",
  "footer.about": "Acerca de",
  "footer.privacy": "Privacidad",
  "footer.suggest": "Sugerir un lugar",
  "footer.roadmap": "Ideas y novedades",
  "footer.venues": "Todos los lugares", // [CHECK]
  "footer.resources": "Programas de ayuda alimentaria",
  "breadcrumb.label": "Ruta de navegación", // [CHECK]
  "breadcrumb.map": "Mapa",

  // Venues directory (#PR4)
  "nav.venuesList": "Ver todos los lugares",
  "venues.heading": "Todos los recursos alimentarios",
  "venues.documentTitle": "Todos los recursos alimentarios",
  "venues.intro": "Cada despensa, supermercado, huerto comunitario, granja y comedor del mapa — agrupados por tipo, con direcciones y horarios.",
  "venues.noHours": "Horario no disponible",

  // Map-wide data freshness (board review finding #2)
  "freshness.updated": "Datos del mapa actualizados el {date}",

  // OSM attribution (#133 4.5)
  "osm.attribution": "Los datos de los lugares incluyen © colaboradores de OpenStreetMap", // [CHECK]

  // About page FAQ + stats (#PR4)
  "about.stat.insecurity": "Según el estudio Map the Meal Gap de Feeding America (datos de 2023), aproximadamente 1 de cada 6 residentes del condado de Pueblo — cerca del 16.5% — vive con inseguridad alimentaria, incluyendo casi 1 de cada 5 niños.",
  "about.stat.count": "Pueblo Food Map incluye actualmente {count} de los recursos de alimentos gratuitos y de bajo costo que pueden ayudar.",
  "about.faq.heading": "Preguntas frecuentes",
  "about.faq.q1": "¿Es gratis usar Pueblo Food Map?",
  "about.faq.a1": "Sí, es completamente gratis y no necesitas crear una cuenta ni iniciar sesión. Es un proyecto comunitario, no un negocio.",
  "about.faq.q2": "¿Necesito identificación, comprobante de ingresos o compartir mi estatus migratorio para recibir alimentos?",
  "about.faq.a2": "Depende del lugar. Muchas despensas y comedores atienden a cualquier persona que llegue, sin necesidad de identificación ni comprobante de ingresos; algunos solo piden datos básicos, como cuántas personas viven en tu hogar. Cuando un lugar tiene enlace a Plentiful, puedes ver qué llevar antes de ir, y siempre puedes llamar antes para preguntar.",
  "about.faq.q3": "¿El mapa muestra qué lugares aceptan SNAP o WIC?",
  "about.faq.a3": "Sí. Los lugares que aceptan SNAP o WIC muestran una etiqueta, y puedes filtrar el mapa para ver solo esos. Marcamos SNAP/WIC donde lo hemos confirmado, principalmente en supermercados y mercados.",
  "about.faq.q4": "¿Qué hago si un lugar tiene información incorrecta, desactualizada o ya cerró?",
  "about.faq.a4": "Por favor avísanos. Cada lugar tiene la opción 'Reportar un problema', y también puedes sugerir uno que falte. Revisamos cada reporte y actualizamos el mapa a medida que confirmamos los cambios.",
  "about.faq.q5": "¿Qué tan actualizada está la información?",
  "about.faq.a5": "Cada lugar muestra una fecha de 'última verificación' para que sepas qué tan reciente es. Los horarios pueden cambiar, sobre todo en días festivos, así que para algo urgente conviene llamar antes cuando hay un número de teléfono.",
  "about.faq.q6": "¿Cómo obtengo indicaciones para llegar?",
  "about.faq.a6": "Abre cualquier lugar y elige Caminar, Autobús o Manejar. Las indicaciones a pie se muestran en el mapa; las de autobús y automóvil se abren en Google Maps.",

  // 404 Not Found page (#288)
  "notfound.title": "Página no encontrada",
  "notfound.documentTitle": "Página no encontrada",
  "notfound.body": "La página que buscas no existe o se ha movido.",
  "notfound.backToMap": "Volver al mapa",

  // Resources page (/resources) — Kyle, 2026-09-16
  "nav.resourcesPage": "Programas de ayuda alimentaria",
  "resources.heading": "Programas de ayuda alimentaria",
  "resources.intro": "Estos programas pueden ayudarte a pagar el mercado o conseguir comida gratis. Preguntar no cuesta nada. ¿No sabes por dónde empezar? Llama a la Línea de Recursos Alimentarios: te dirán para qué programas podrías calificar.",
  "resources.goodFor": "Para qué sirve",
  "resources.how": "Cómo obtenerlo",
  "resources.checked": "Datos verificados con cada programa en septiembre de 2026. Los horarios y requisitos pueden cambiar; si puedes, llama antes de ir.",
  "resources.action.website": "Sitio web",
  "resources.action.call": "Llamar al {number}",
  "resources.action.text": "Enviar mensaje al {number}",
  "resources.211.name": "2-1-1 Colorado",
  "resources.211.what": "Una línea de ayuda gratuita que te conecta con servicios locales de salud y servicios humanos, incluida la comida.",
  "resources.211.goodFor": "Encontrar despensas de alimentos, comidas comunitarias, comidas a domicilio y fórmula o comida para bebé cerca de ti.",
  "resources.211.how": "Marca 2-1-1 o (866) 760-6489, o envía tu código postal por mensaje de texto al 898-211. También puedes buscar o chatear en su sitio web.",
  "resources.snap.name": "SNAP (cupones de alimentos)",
  "resources.snap.what": "Dinero para comprar comida cada mes, cargado en una tarjeta EBT que funciona como una tarjeta de débito.",
  "resources.snap.goodFor": "Comprar comida en la mayoría de los supermercados y en algunas tiendas en línea. Con Double Up Food Bucks, tus dólares de SNAP rinden más en frutas y verduras.",
  "resources.snap.how": "Solicítalo en línea con Colorado PEAK o en una oficina de Servicios Humanos del Condado de Pueblo: 405 W. 9th St., 320 W. 10th St. o 2641 E. 4th St. (7:30 a. m.–5 p. m.). Calificar depende del tamaño de tu hogar y de tus ingresos. Es posible que necesites una entrevista corta por teléfono o en persona. La Línea de Recursos Alimentarios puede ayudarte a solicitarlo por teléfono.",
  "resources.snap.apply": "Solicitar en PEAK",
  "resources.wic.name": "WIC",
  "resources.wic.what": "Comida saludable, consejos de nutrición y apoyo para la lactancia (incluidos extractores de leche) para mujeres embarazadas, mamás recientes, bebés y niños menores de 5 años.",
  "resources.wic.goodFor": "Familias con niños pequeños. Papás, abuelos, padres de crianza y otras personas a cargo pueden obtener WIC para un niño menor de 5 años. No necesitas ser ciudadano de EE. UU.",
  "resources.wic.how": "Si recibes Medicaid, SNAP o TANF, ya cumples con el requisito de ingresos. Llama a la clínica de WIC de Pueblo (101 W. 9th St.; lunes a jueves de 8 a. m. a 5 p. m., viernes de 8 a. m. a 4:30 p. m.) o llena el formulario de inscripción en línea y te contactarán en un plazo de 10 días.",
  "resources.wic.signup": "Inscribirse en línea",
  "resources.doubleup.name": "Double Up Food Bucks",
  "resources.doubleup.what": "Una compensación en frutas y verduras frescas para quienes usan SNAP.",
  "resources.doubleup.goodFor": "Llevarte el doble de frutas y verduras. Cuando usas tu tarjeta EBT en una tienda o mercado de agricultores participante, Double Up iguala lo que gastas, dólar por dólar, hasta $20 al día.",
  "resources.doubleup.how": "Si tienes una tarjeta EBT de Colorado, ya estás inscrito: no hay que solicitar nada. Solo usa tu tarjeta en un lugar participante.",
  "resources.doubleup.find": "Buscar un lugar",
  "resources.hotline.name": "Línea de Recursos Alimentarios",
  "resources.hotline.what": "Una línea telefónica gratuita y confidencial de Hunger Free Colorado.",
  "resources.hotline.goodFor": "Orientarte. Revisan para qué programas podrías calificar, te ayudan a solicitar SNAP por teléfono y te conectan con despensas de alimentos, comidas gratuitas y WIC. Ayudan a todas las personas, sin importar su situación migratoria.",
  "resources.hotline.how": "Llama al 855-855-4626, de lunes a jueves de 8:30 a. m. a 4:30 p. m. o los viernes de 8 a. m. a mediodía. Hay ayuda en más de 150 idiomas, incluido el español.",
  "resources.everydayeats.name": "Everyday Eats (60 años o más)",
  "resources.everydayeats.what": "Una caja gratuita con 22 a 25 alimentos básicos cada mes del Condado de Pueblo, como leche, queso, cereal, arroz o pasta, y frutas, verduras y proteína enlatadas.",
  "resources.everydayeats.goodFor": "Adultos de 60 años o más con ingresos limitados. Los hogares de cualquier edad que reciben SNAP, Medicaid, SSI y algunos otros programas también pueden obtener comida de emergencia (llamada TEFAP) de la misma manera.",
  "resources.everydayeats.how": "Envía FOOD por mensaje de texto al 1-877-644-3663. Recibirás un enlace a un formulario corto de inscripción. Hay que renovar cada 6 meses, y si no recoges tu caja 3 meses seguidos pierdes tu lugar.",

  // Blessing box card (rendered in-map, BottomSheet/DesktopVenueWindow, slice 1)
  "box.mostNeeded": "Lo que más se necesita",
  "box.status.unknown": "Desconocido", // [CHECK]
  "box.status.unknown.detail": "sin visitas recientes", // [CHECK]
  "box.cardLoading": "Cargando…", // [CHECK]
  "box.redirectLink": "Ver esta caja en el mapa", // [CHECK]

  // Check-ins and live status (slice 2)
  "box.status.stocked": "Surtida", // [CHECK]
  "box.status.low": "Quedan pocas cosas", // [CHECK]
  "box.status.empty": "Vacía", // [CHECK]
  "box.status.out_of_service": "Fuera de servicio", // [CHECK]
  "box.lastFilled": "surtida {time}", // [CHECK]
  "box.lastFilled.never": "Aún no se ha marcado como surtida", // [CHECK]
  "box.checkin.heading": "Por favor, actualiza esta caja", // [CHECK]
  "box.checkin.filled": "La surtí", // [CHECK]
  "box.checkin.took": "Usé esta caja", // [CHECK]
  "box.checkin.low": "Quedan pocas cosas", // [CHECK]
  "box.checkin.empty": "Está vacía", // [CHECK]
  "box.checkin.problem": "Reportar un problema", // [CHECK]
  "box.checkin.noteLabel": "Agrega una nota breve (opcional)", // [CHECK]
  "box.checkin.notePlaceholder.filled": "ej. La llené con sopa enlatada", // [CHECK]
  "box.checkin.notePlaceholder.problem": "ej. La puerta está rota", // [CHECK]
  "box.checkin.submit": "Enviar", // [CHECK]
  "box.checkin.submitting": "Enviando…", // [CHECK]
  "box.checkin.cancel": "Cancelar", // [CHECK]
  "box.checkin.success.filled": "¡Gracias por surtirla!", // [CHECK]
  "box.checkin.success.took": "Gracias — ¡disfrútalo!", // [CHECK]
  "box.checkin.success.low": "Gracias por avisarnos.", // [CHECK]
  "box.checkin.success.empty": "Gracias por avisarnos.", // [CHECK]
  "box.checkin.success.problem": "Gracias — ya avisamos al administrador.", // [CHECK]
  "box.checkin.error": "Eso no se pudo enviar. Por favor intenta de nuevo.", // [CHECK]
  "box.checkin.error.rateLimitVisitor": "Demasiadas visitas desde este dispositivo por ahora. Por favor intenta más tarde.", // [CHECK]
  "box.checkin.error.rateLimitBox": "Esta caja está recibiendo un número inusual de visitas en este momento. Por favor intenta más tarde.", // [CHECK]
  "box.checkin.turnstileFallbackPrompt": "Toca el recuadro de abajo para confirmar que eres una persona.", // [CHECK]

  "box.needs.heading": "¿Qué te ayudaría la próxima vez?", // [CHECK]
  "box.needs.sub": "Toca las que quieras. Esto le dice a quienes donan qué traer.", // [CHECK]
  "box.needs.otherLabel": "¿Algo más? (opcional)", // [CHECK]
  "box.needs.send": "Enviar", // [CHECK]
  "box.needs.skip": "Omitir", // [CHECK]
  "box.needs.success": "Recibido — ¡gracias!", // [CHECK]
  "box.needs.canned_food": "Comida enlatada", // [CHECK]
  "box.needs.fresh_food": "Comida fresca", // [CHECK]
  "box.needs.bread": "Pan", // [CHECK]
  "box.needs.baby_items": "Artículos para bebé", // [CHECK]
  "box.needs.diapers": "Pañales", // [CHECK]
  "box.needs.hygiene": "Artículos de higiene", // [CHECK]
  "box.needs.pet_food": "Comida para mascotas", // [CHECK]
  "box.needs.drinks": "Bebidas", // [CHECK]
  "box.needs.warm_clothing": "Ropa de abrigo", // [CHECK]
  "box.mostNeeded.fromVisitors": "Lo más necesitado · según quienes usan esta caja", // [CHECK]

  "box.photo.addButton": "Agregar una foto", // [CHECK]
  "box.photo.attachLabel": "Agregar una foto (opcional)", // [CHECK]
  "box.photo.chooseLabel": "Elige una foto", // [CHECK]
  "box.photo.disclosure": "Las fotos se revisan antes de mostrarse públicamente. Por favor no incluyas rostros ni placas.", // [CHECK]
  "box.photo.processing": "Preparando la foto…", // [CHECK]
  "box.photo.processError": "No se pudo procesar esa foto. Por favor intenta con otra.", // [CHECK]
  "box.photo.unsupportedFormat": "Ese formato de foto no es compatible. Por favor intenta con un JPEG o PNG.", // [CHECK]
  "box.photo.previewAlt": "Vista previa de la foto seleccionada", // [CHECK]
  "box.photo.remove": "Quitar", // [CHECK]
  "box.photo.send": "Enviar", // [CHECK]
  "box.photo.sending": "Enviando…", // [CHECK]
  "box.photo.success": "¡Gracias! Tu foto fue enviada para revisión.", // [CHECK]
  "box.photo.error": "Eso no se pudo enviar. Por favor intenta de nuevo.", // [CHECK]

  "box.photo.caption": "Foto · {time}", // [CHECK]
  "box.photo.altText": "Foto de {name}, compartida {time}", // [CHECK]
  "box.photo.viewFullSize": "Ver foto en tamaño completo", // [CHECK]
  "box.photo.viewFullSizeAt": "Ver foto en tamaño completo · {time}", // [CHECK]
  "box.photo.report": "Reportar esta foto", // [CHECK]
  "box.photo.reporting": "Reportando…", // [CHECK]
  "box.photo.reportConfirm": "¿Ocultar esta foto y enviarla para revisión?", // [CHECK]
  "box.photo.reportThanks": "Gracias — esta foto se ha ocultado en espera de revisión.", // [CHECK]
  "box.photo.reportError": "Eso no se pudo enviar. Por favor intenta de nuevo.", // [CHECK]

  "box.history.link": "Historial", // [CHECK]

  "box.stats.perBoxHeading": "Números de esta caja", // [CHECK]
  "box.stats.networkHeading": "Números de la red", // [CHECK]
  "box.stats.boxCount": "Cajas de bendición", // [CHECK]
  "box.stats.sponsorCount": "Patrocinadores", // [CHECK]
  "box.stats.avgSponsorsPerBox": "Prom. de patrocinadores por caja", // [CHECK]
  "box.stats.period": "Periodo", // [CHECK]
  "box.stats.period.7d": "Últimos 7 días", // [CHECK]
  "box.stats.period.30d": "Últimos 30 días", // [CHECK]
  "box.stats.period.90d": "Últimos 90 días", // [CHECK]
  "box.stats.period.all": "Todo el tiempo", // [CHECK]
  "box.stats.fills": "Surtidos", // [CHECK]
  "box.stats.uses": "Usos (“Usé esta caja”)", // [CHECK]
  "box.stats.emptyReports": "Avisos de vacío", // [CHECK]
  "box.stats.lowReports": "Avisos de poco surtido", // [CHECK]
  "box.stats.totalCheckins": "Total de visitas registradas", // [CHECK]
  "box.stats.approvedPhotos": "Fotos compartidas", // [CHECK]
  "box.stats.avgHeading": "Tiempos típicos", // [CHECK]
  "box.stats.avg.emptyToFill": "De vacío al siguiente surtido", // [CHECK]
  "box.stats.avg.fillToFill": "De un surtido al siguiente", // [CHECK]
  "box.stats.avg.fillToEmpty": "De surtido al siguiente vacío", // [CHECK]
  "box.stats.noData": "—", // [CHECK]
  "box.stats.duration.hours": "{value} horas", // [CHECK]
  "box.stats.duration.days": "{value} días", // [CHECK]
  "box.stats.honestyNote": "Estos números cuentan las visitas registradas, no cada visita real — por eso “usos” se ve más bajo que el tráfico real, a propósito.", // [CHECK]
  "box.stats.neverFilled": "Nunca surtida", // [CHECK]
  "box.stats.needLoveHeading": "Cajas que necesitan atención", // [CHECK]
  "box.stats.needLove.longestSinceFill": "Más tiempo sin surtirse", // [CHECK]
  "box.stats.needLove.mostEmptyReports": "Más avisos de vacío", // [CHECK]
  "box.stats.needLove.slowestRefill": "Las más lentas en volver a surtirse", // [CHECK]
  "box.stats.needLove.empty": "Todavía no hay suficiente historial.", // [CHECK]
  "box.stats.needLove.emptyReportCount": "{count} avisos de vacío", // [CHECK]
  "box.stats.milestonesHeading": "Logros de la comunidad", // [CHECK]
  "box.stats.milestone.fills": "Pueblo ha surtido sus cajas de bendiciones {threshold}+ veces", // [CHECK]
  "box.stats.milestone.uses": "Los vecinos han usado las cajas de bendiciones de Pueblo {threshold}+ veces", // [CHECK]

  "box.alerts.emailDisclosure": "Guardamos tu correo solo para enviarte estos mensajes. Cada correo de alerta trae un enlace para dejar de recibirlos.", // [CHECK]
  "box.adopt.linkLabel": "Solicitar ser patrocinador de esta caja", // [CHECK]
  "box.adopt.displayNameLabel": "Tu nombre (se muestra públicamente, por ejemplo el de un grupo o familia)", // [CHECK]
  "box.adopt.displayNamePlaceholder": "ej. La Familia Martínez", // [CHECK]
  "box.adopt.emailLabel": "Tu correo (privado)", // [CHECK]
  "box.adopt.noteLabel": "Nota para el administrador (opcional, privada)", // [CHECK]
  "box.adopt.submit": "Enviar solicitud", // [CHECK]
  "box.adopt.submitting": "Enviando…", // [CHECK]
  "box.adopt.cancel": "Cancelar", // [CHECK]
  "box.adopt.success": "Revisa tu correo para confirmar.", // [CHECK]
  "box.alerts.linkLabel": "Avísame cuando necesite surtido", // [CHECK]
  "box.alerts.emailLabel": "Tu correo", // [CHECK]
  "box.alerts.submit": "Suscribirme", // [CHECK]
  "box.alerts.submitting": "Enviando…", // [CHECK]
  "box.alerts.cancel": "Cancelar", // [CHECK]
  "box.alerts.success": "Revisa tu correo para confirmar.", // [CHECK]
  "box.form.error.generic": "Eso no se pudo enviar. Por favor intenta de nuevo.", // [CHECK]
  "box.form.error.rateLimit": "Demasiados intentos por ahora. Por favor intenta más tarde.", // [CHECK]

  "box.sponsor.needsSponsor": "Esta caja necesita un patrocinador.", // [CHECK]
  "box.sponsor.sponsoredByPrefix": "Patrocinada por ", // [CHECK]
  "box.sponsor.and": "y", // [CHECK]
  "box.sponsor.moreCount": "+{count} más", // [CHECK]
  "box.sponsor.wantToHelp": "¿Quieres ayudar también? ", // [CHECK]

  "alerts.confirm.heading": "Confirma tu correo", // [CHECK]
  "alerts.confirm.body": "Toca el botón de abajo para confirmar que quieres recibir estos correos.", // [CHECK]
  "alerts.confirm.button": "Confirmar", // [CHECK]
  "alerts.confirm.confirming": "Confirmando…", // [CHECK]
  "alerts.confirm.success": "¡Confirmado! Recibirás los correos descritos.", // [CHECK]
  "alerts.confirm.invalid": "Este enlace de confirmación ya no es válido.", // [CHECK]
  "alerts.confirm.error": "Algo salió mal. Por favor intenta de nuevo.", // [CHECK]
  "alerts.stop.heading": "Correos detenidos", // [CHECK]
  "alerts.stop.stopping": "Deteniendo…", // [CHECK]
  "alerts.stop.body": "Ya no recibirás más correos sobre esto.", // [CHECK]
  "alerts.stop.invalid": "Este enlace ya no es válido.", // [CHECK]
  "alerts.stop.noscriptButton": "Detener estos correos", // [CHECK]
  "alerts.stop.undoButton": "Fue un error — vuelve a activar los correos", // [CHECK]
  "alerts.stop.undoing": "Reactivando…", // [CHECK]
  "alerts.stop.undone": "Vuelves a estar en la lista.", // [CHECK]
  "alerts.stop.undoError": "Eso no se pudo enviar. Por favor intenta de nuevo.", // [CHECK]
  "email.adoptConfirm.subject": "Confirma tu solicitud para patrocinar {box}", // [CHECK]
  "email.adoptConfirm.line1": "Gracias por solicitar patrocinar {box}. Confirma tu correo para terminar tu solicitud.", // [CHECK]
  "email.adoptConfirm.line2": "Un administrador revisará tu solicitud una vez que confirmes.", // [CHECK]
  "email.adoptConfirm.cta": "Confirma tu correo: {url}", // [CHECK]
  "email.adoptConfirm.disclaimer": "Si tú no pediste esto, puedes ignorar este correo. No te escribiremos de nuevo a menos que alguien confirme.", // [CHECK]

  // Activity log (/boxes/activity, slice 3) and nav entry
  "nav.boxActivity": "Actividad de las cajas de bendiciones", // [CHECK]
  "activity.heading": "Actividad de las cajas de bendiciones", // [CHECK]
  "activity.documentTitle": "Actividad de las cajas de bendiciones", // [CHECK]
  "activity.intro": "Cada surtido, aviso de poco, aviso de vacío y cambio de caja en toda la red, del más reciente al más antiguo.", // [CHECK]
  "activity.empty": "Todavía no hay actividad que mostrar.", // [CHECK]
  "activity.prevPage": "Anterior", // [CHECK]
  "activity.nextPage": "Siguiente", // [CHECK]
  "activity.loading": "Cargando…", // [CHECK]
  "activity.resultCount": "{count} resultados", // [CHECK]
  "activity.filters.box": "Caja", // [CHECK]
  "activity.filters.boxAll": "Todas las cajas", // [CHECK]
  "activity.filters.kind": "Tipo", // [CHECK]
  "activity.filters.kindAll": "Todos los tipos", // [CHECK]
  "activity.filters.from": "Desde", // [CHECK]
  "activity.filters.to": "Hasta", // [CHECK]
  "activity.filters.clear": "Quitar filtros", // [CHECK]
  "activity.recentEmpty": "Todavía no hay actividad en esta caja.", // [CHECK]
  "activity.thisBox": "Esta caja", // [CHECK]
  "activity.line.filled": "{name} fue surtida", // [CHECK]
  "activity.line.took": "Alguien usó {name}", // [CHECK]
  "activity.line.low": "{name} tiene poco", // [CHECK]
  "activity.line.empty": "{name} está vacía", // [CHECK]
  "activity.line.added": "{name} se agregó como una nueva caja de bendiciones", // [CHECK]
  "activity.line.moved": "{name} se cambió de lugar", // [CHECK]
  "activity.line.renamed": "{name} cambió de nombre", // [CHECK]
  "activity.line.paused": "{name} se pausó", // [CHECK]
  "activity.line.removed": "{name} se eliminó", // [CHECK]
  "activity.line.photo_added": "Se agregó una nueva foto", // [CHECK]
  "activity.line.sponsor_added": "{name} se convirtió en patrocinador(a)", // [CHECK]
  "activity.kind.filled": "Surtida", // [CHECK]
  "activity.kind.took": "Se usó la caja", // [CHECK]
  "activity.kind.low": "Con poco", // [CHECK]
  "activity.kind.empty": "Vacía", // [CHECK]
  "activity.kind.added": "Caja agregada", // [CHECK]
  "activity.kind.moved": "Caja cambiada de lugar", // [CHECK]
  "activity.kind.renamed": "Caja con nombre cambiado", // [CHECK]
  "activity.kind.paused": "Caja pausada", // [CHECK]
  "activity.kind.removed": "Caja eliminada", // [CHECK]

  // Answer-first venue summary (SEO/AEO plan Phase 2, #704) — see the EN
  // dictionary's own comment above this block. Gendered articles are baked
  // into each "what" phrase (una despensa/un comedor/etc.) so
  // summary.mainSentence stays one template for every category.
  "summary.what.pantry": "una despensa de alimentos gratuita", // [CHECK]
  "summary.what.meal_site": "un comedor comunitario gratuito", // [CHECK]
  "summary.what.garden": "un huerto comunitario gratuito", // [CHECK]
  "summary.what.edible_landscape": "un paisaje comestible gratuito", // [CHECK]
  "summary.what.grocery": "un supermercado", // [CHECK]
  "summary.what.convenience": "una tienda de conveniencia", // [CHECK]
  "summary.what.farm": "una granja y mercado", // [CHECK]
  "summary.mainSentence": "{name} es {what} en {address}.", // [CHECK]
  "summary.mainSentenceNoAddress": "{name} es {what} en {city}, CO.", // [CHECK]
  // Gender-neutral — "Horario" (the schedule) needs no article, so it works
  // for every category's "what" phrase regardless of gender (review fix:
  // "Está abierto" disagreed with some).
  "summary.hours": "Horario: {schedule}.", // [CHECK]
  "summary.day.mon": "los lunes", // [CHECK]
  "summary.day.tue": "los martes", // [CHECK]
  "summary.day.wed": "los miércoles", // [CHECK]
  "summary.day.thu": "los jueves", // [CHECK]
  "summary.day.fri": "los viernes", // [CHECK]
  "summary.day.sat": "los sábados", // [CHECK]
  "summary.day.sun": "los domingos", // [CHECK]
  "summary.day.everyDay": "todos los días", // [CHECK]
  "summary.day.range": "de {start} a {end}", // [CHECK]
  "summary.day.full.mon": "lunes", // [CHECK]
  "summary.day.full.tue": "martes", // [CHECK]
  "summary.day.full.wed": "miércoles", // [CHECK]
  "summary.day.full.thu": "jueves", // [CHECK]
  "summary.day.full.fri": "viernes", // [CHECK]
  "summary.day.full.sat": "sábado", // [CHECK]
  "summary.day.full.sun": "domingo", // [CHECK]
  "summary.hours.open24EveryDay": "Abierto las 24 horas, todos los días", // [CHECK]
  "summary.hours.monthlyOrdinal": "el {ordinal} {weekdayFull} de cada mes", // [CHECK]
  "summary.hours.monthlyDate": "el día {day} de cada mes", // [CHECK]
  "summary.ordinal.last": "último", // [CHECK]
  "summary.snap": "Acepta SNAP/EBT.", // [CHECK]
  "summary.wic": "Acepta WIC.", // [CHECK]
  "summary.snapAndWic": "Acepta SNAP/EBT y WIC.", // [CHECK]
  "summary.lastVerified": "Última verificación: {month}.", // [CHECK]
  "summary.and": "y", // [CHECK]
  "summary.title.in": "en", // [CHECK]
  "summary.title.category.pantry": "Despensa", // [CHECK]
  "summary.title.category.grocery": "Supermercado", // [CHECK]
  "summary.title.category.convenience": "Tienda", // [CHECK]
  "summary.title.category.farm": "Puesto de granja", // [CHECK]
  "summary.title.category.garden": "Huerto", // [CHECK]
  "summary.title.category.edible_landscape": "Paisaje comestible", // [CHECK]
  "summary.title.category.meal_site": "Comedor", // [CHECK]
  "summary.cityFallback": "el Condado de Pueblo", // [CHECK]
  "detail.nearby": "Lugares cercanos", // [CHECK]
  "detail.nearby.away": "a {miles}", // [CHECK]
  "hours.open24": "Abierto las 24 horas", // [CHECK]
  "month.1": "enero", // [CHECK]
  "month.2": "febrero", // [CHECK]
  "month.3": "marzo", // [CHECK]
  "month.4": "abril", // [CHECK]
  "month.5": "mayo", // [CHECK]
  "month.6": "junio", // [CHECK]
  "month.7": "julio", // [CHECK]
  "month.8": "agosto", // [CHECK]
  "month.9": "septiembre", // [CHECK]
  "month.10": "octubre", // [CHECK]
  "month.11": "noviembre", // [CHECK]
  "month.12": "diciembre", // [CHECK]
  "footer.foodPantries": "Despensas de alimentos", // [CHECK]
  "footer.snapWic": "Lugares con SNAP y WIC", // [CHECK]
  "footer.gardens": "Huertos comunitarios", // [CHECK]
  "venues.browseTopics": "Explorar por tema", // [CHECK]
  "footer.boxes": "Lista de cajas de bendiciones", // [CHECK]
  "resources.faq.heading": "Preguntas frecuentes", // [CHECK]
  "resources.faq.q1": "¿Cómo solicito SNAP en el Condado de Pueblo?", // [CHECK]
  "resources.faq.a1": "Puedes solicitarlo en línea con Colorado PEAK o con la aplicación MyCOBenefits, o llenar una solicitud en papel y entregarla en la oficina de servicios humanos de tu condado. El condado decide quién califica según los ingresos, los recursos y el tamaño del hogar. La Línea de Recursos Alimentarios, al 855-855-4626, puede ayudarte a solicitarlo por teléfono.", // [CHECK]
  "resources.faq.q2": "¿Cómo solicito WIC?", // [CHECK]
  "resources.faq.a2": "Llama a tu clínica WIC local para hacer una cita, o llena el formulario de inscripción en línea en coloradowicsignup.com y un miembro del personal de WIC se comunicará contigo en un plazo de 10 días. Al hacer tu cita, la clínica puede decirte qué documentos llevar.", // [CHECK]
  "resources.faq.q3": "¿Qué debo llevar a una despensa de alimentos?", // [CHECK]
  "resources.faq.a3": "Depende de la despensa, porque cada una fija sus propios requisitos. Revisa la página del lugar en este mapa para ver el horario y los detalles, y llama antes si hay un teléfono. La Línea de Recursos Alimentarios, al 855-855-4626, también puede indicarte despensas cerca de ti.", // [CHECK]
  "resources.faq.q4": "¿Dónde puedo conseguir comida de emergencia hoy?", // [CHECK]
  "resources.faq.a4": "Marca el 2-1-1 o el (866) 760-6489, o envía tu código postal por mensaje de texto al 898-211, y pregunta por comida de emergencia cerca de ti. La Línea de Recursos Alimentarios, al 855-855-4626 (de lunes a jueves de 8:30 a.m. a 4:30 p.m., viernes de 8 a.m. a 12 p.m.), puede conectarte con despensas y comedores comunitarios gratuitos. También puedes ver las despensas de este mapa y confirmar sus horarios antes de ir.", // [CHECK]
};

export default es;
