/**
 * Strings only server code uses (#723): outbound email, page metadata, hub
 * pages, JSON-LD and the event page. Kept out of the browser: i18n.ts merges
 * them into t() on the server only. A key that a client component starts
 * using must move to i18n.ts / i18n.es.ts (src/__tests__/i18n.test.ts fails
 * until it does).
 */

export const serverEn: Record<string, string> = {
  // WebSite JSON-LD description (#689 PR 2, src/lib/venueSchema.ts
  // buildWebSiteJsonLd) — machine-readable, not visible body copy, but still
  // real text search/AI answer engines can quote, so it goes through t()
  // like every other locale-facing string.
  "jsonld.website.description":
    "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores.",
  "meta.about.title": "About",
  "meta.about.description":
    "About Pueblo Food Map — our mission to connect Pueblo County residents with free and low-cost food resources, and how venue data is sourced.",
  "meta.resources.title": "Food help programs",
  "meta.resources.description":
    "How to get SNAP, WIC, Double Up Food Bucks, 2-1-1 Colorado, the Food Resource Hotline and senior food boxes in Pueblo County, CO — what each is for and how to sign up.",
  "meta.venues.title": "All Food Resources",
  "meta.venues.description":
    "Browse every food resource on the Pueblo Food Map — food pantries, grocery stores, community gardens, farms, and meal sites across Pueblo County, CO, with addresses and hours.",

  // Event page (#762, /event/<id>). {abbr} is the Pueblo zone abbreviation (MST/MDT).
  "events.page.statusUpcoming": "Coming up",
  "events.page.statusLive": "Happening now",
  "events.page.timeZoneNote": "{abbr}, Pueblo time",
  "events.page.openOnMap": "Open on the map",
  "events.page.findFood": "Find food on the map",
  "events.page.otherLanguage": "Ver en español",
  "events.page.metaCancelled": "Cancelled.",
  "events.page.metaWhen": "{day}, {time} {abbr}, at {address}.",
  "events.page.metaCancelledTitle": "Cancelled: {name}",
  "box.status": "Status",

  // Outbound email copy (slice 6) — rendered via composeEmail
  // (src/lib/emailSend.ts), which builds ONE message in the recipient's own
  // `lang` (see migrations/0011_alert_email_lang.sql) — every key here,
  // subject included, still needs both an EN and an ES entry so the SAME
  // dictionary/parity test covers whichever language actually gets sent.
  "email.alert.empty.subject": "{box} is empty",
  "email.alert.empty.line1": "{box} was just marked empty.",
  "email.alert.low.subject": "{box} is running low",
  "email.alert.low.line1": "{box} was just marked as running low.",
  "email.alert.problem.subject": "A problem was reported at {box}",
  "email.alert.problem.line1": "A problem was just reported at {box}.",
  // Filled alert (slice 6 follow-up) — the only alert every subscriber role
  // (host/adopter/giver) gets, and the only one NOT gated by the 6h cooldown
  // (boxAlerts.ts's own header, "FILLED IS A SEPARATE CAP").
  "email.alert.filled.subject": "Good news: {box} was just filled",
  "email.alert.filled.line1": "Someone just reported filling {box}.",
  "email.alert.filled.line2": "Thanks for keeping an eye on it. You'll hear from us again when it needs filling.",
  "email.alert.line2": "See the box's page for details: {url}",
  "email.stopLine": "Don't want these emails anymore? Stop them any time, no login needed: {stopUrl}",
  "email.adoptApproved.subject": "You're approved to sponsor {box}",
  "email.adoptApproved.line1": "Good news — your application to sponsor {box} as \"{displayName}\" has been approved.",
  "email.adoptApproved.line2": "Your name will now show on the box's card, and you'll get an email if it's reported empty or has a problem.",
  "email.alertConfirm.subject": "Confirm your alerts for {box}",
  "email.alertConfirm.line1": "Please confirm you'd like email alerts for {box}.",
  "email.alertConfirm.line2": "We'll email you if it's reported empty or running low.",
  "email.alertConfirm.cta": "Confirm your email: {url}",
  "email.alertConfirm.disclaimer": "If you didn't ask for this, you can ignore this email. We won't write again unless someone confirms.",
  "email.hostWelcome.subject": "You're now getting alerts for {box}",
  "email.hostWelcome.line1": "You've been added as a host contact for {box}.",
  "email.hostWelcome.line2": "You'll get an email if it's reported empty or has a problem.",


  // ─── SEO hub pages (#709): /food-pantries, /snap-wic-stores, /community-gardens ───
  // Titles get " · Pueblo Food Map" appended by the layout template.
  "meta.foodPantries.title": "Food Pantries in Pueblo, CO",
  "meta.foodPantries.description":
    "Every food pantry on the Pueblo Food Map in Pueblo County, CO, with addresses, hours in plain words where we have them, and how food pantries work.",
  "meta.snapWic.title": "SNAP and WIC Stores in Pueblo, CO",
  "meta.snapWic.description":
    "Places in Pueblo County, CO that accept SNAP/EBT or WIC, such as grocery stores and markets, with addresses.",
  "meta.gardens.title": "Community Gardens in Pueblo, CO",
  "meta.gardens.description":
    "Community gardens and edible landscapes in Pueblo County, CO, with addresses and hours where we have them.",
  // Shared by the hub lists.
  "hubs.hoursMissing": "Hours not listed. Check before you go.",
  "hubs.pantries.heading": "Food pantries in Pueblo County",
  "hubs.pantries.introFree": "There are {count} free food pantries on the map in Pueblo County, CO. Each one is listed below with its address, and hours where we have them.",
  "hubs.pantries.introPlain": "There are {count} food pantries on the map in Pueblo County, CO. Each one is listed below with its address, and hours where we have them.",
  "hubs.pantries.faq.heading": "How food pantries work",
  "hubs.pantries.faq.q1": "What is a food pantry?",
  "hubs.pantries.faq.a1": "A food pantry gives groceries to people who need them, usually at no cost. Many are run by churches, community groups and nonprofits.",
  "hubs.pantries.faq.q2": "Do I need to call or sign up first?",
  "hubs.pantries.faq.a2": "It depends on the pantry. Some are open on set days and hours, and some ask you to call first. Check the hours listed here, and call ahead if a phone number is on the place's page.",
  "hubs.pantries.faq.q3": "How often can I go?",
  "hubs.pantries.faq.a3": "Each pantry sets its own limits. Ask what they are when you call or visit.",
  "hubs.pantries.faq.q4": "What if the hours are missing or a pantry is closed?",
  "hubs.pantries.faq.a4": "Hours can change, and some places have not shared theirs. Call ahead, or call 2-1-1 or the Food Resource Hotline at 855-855-4626 and ask about pantries open today.",
  "hubs.snapWic.heading": "Places that accept SNAP and WIC",
  "hubs.snapWic.intro": "{snap} places on the map accept SNAP/EBT and {wic} accept WIC. Each one is listed below with its address.",
  "hubs.snapWic.badgeSnap": "Accepts SNAP/EBT",
  "hubs.snapWic.badgeWic": "Accepts WIC",
  "hubs.snapWic.note": "What a place accepts can change. Check with the place before you go.",
  "hubs.snapWic.apply": "Want to apply for SNAP or WIC?",
  // /blessing-boxes (#709 PR B). Deliberately no "free" wording: blessing_box is not in FREE_CATEGORIES.
  "meta.boxes.title": "Blessing Boxes in Pueblo, CO",
  "meta.boxes.description":
    "Community blessing boxes in Pueblo County, CO: small boxes where neighbors leave and take food and basics. Names and addresses, with a link to each on the map.",
  "hubs.boxes.heading": "Blessing boxes in Pueblo County",
  "hubs.boxes.intro": "There are {count} blessing boxes on the map in Pueblo County, CO. Each one links to its card on the map.",
  "hubs.boxes.introOne": "There is 1 blessing box on the map in Pueblo County, CO. It links to its card on the map.",
  "hubs.boxes.what": "A blessing box is a small community box where neighbors leave and take food and basics. Open the map to see a box's current details.",
  "hubs.boxes.empty": "There are no blessing boxes listed right now.",
  "hubs.boxes.degraded": "We couldn't load the list of blessing boxes right now. Open the map to see them.",
  "hubs.boxes.openMap": "Open the map",
  "hubs.gardens.heading": "Community gardens and edible landscapes in Pueblo County",
  "hubs.gardens.section.garden": "Community gardens",
  "hubs.gardens.section.edible_landscape": "Edible landscapes",
  "hubs.gardens.introFree": "There are {count} free community gardens and edible landscapes on the map in Pueblo County, CO. Each one is listed below with its address and hours where we have them.",
  "hubs.gardens.introPlain": "There are {count} community gardens and edible landscapes on the map in Pueblo County, CO. Each one is listed below with its address and hours where we have them.",
};

export const serverEs: Record<string, string> = {
  "jsonld.website.description":
    "Un mapa comunitario de recursos alimentarios en el condado de Pueblo, Colorado — huertos comunitarios, paisajes comestibles, despensas de alimentos y supermercados.", // [CHECK]
  "meta.about.title": "Acerca de",
  "meta.about.description":
    "Acerca de Pueblo Food Map — nuestra misión de conectar a los residentes del Condado de Pueblo con recursos de alimentos gratuitos y de bajo costo, y cómo se obtienen los datos de los lugares.", // [CHECK]
  "meta.resources.title": "Programas de ayuda alimentaria",
  "meta.resources.description":
    "Cómo obtener SNAP, WIC, Double Up Food Bucks, 2-1-1 Colorado, la Línea de Ayuda Alimentaria y cajas de alimentos para personas mayores en el Condado de Pueblo, CO — para qué sirve cada uno y cómo inscribirse.", // [CHECK]
  "meta.venues.title": "Todos los recursos alimentarios",
  "meta.venues.description":
    "Explora todos los recursos alimentarios en Pueblo Food Map — despensas de alimentos, supermercados, huertos comunitarios, granjas y comedores comunitarios en todo el Condado de Pueblo, CO, con direcciones y horarios.", // [CHECK]

  // Event page (#762)
  "events.page.statusUpcoming": "Próximamente", // [CHECK]
  "events.page.statusLive": "En curso", // [CHECK]
  "events.page.timeZoneNote": "{abbr}, hora de Pueblo", // [CHECK]
  "events.page.openOnMap": "Abrir en el mapa", // [CHECK]
  "events.page.findFood": "Encontrar comida en el mapa", // [CHECK]
  "events.page.otherLanguage": "View in English", // [CHECK]
  "events.page.metaCancelled": "Cancelado.", // [CHECK]
  "events.page.metaWhen": "{day}, {time} {abbr}, en {address}.", // [CHECK]
  "events.page.metaCancelledTitle": "Cancelado: {name}", // [CHECK]
  "box.status": "Estado",

  "email.alert.empty.subject": "{box} está vacía", // [CHECK]
  "email.alert.empty.line1": "{box} se acaba de marcar como vacía.", // [CHECK]
  "email.alert.low.subject": "{box} tiene poco surtido", // [CHECK]
  "email.alert.low.line1": "{box} se acaba de marcar con poco surtido.", // [CHECK]
  "email.alert.problem.subject": "Se reportó un problema en {box}", // [CHECK]
  "email.alert.problem.line1": "Se acaba de reportar un problema en {box}.", // [CHECK]
  "email.alert.filled.subject": "Buenas noticias: {box} se acaba de llenar", // [CHECK]
  "email.alert.filled.line1": "Alguien acaba de reportar que llenó {box}.", // [CHECK]
  "email.alert.filled.line2": "Gracias por estar pendiente. Te avisaremos de nuevo cuando necesite llenarse otra vez.", // [CHECK]
  "email.alert.line2": "Consulta la página de la caja para más detalles: {url}", // [CHECK]
  "email.stopLine": "¿Ya no quieres estos correos? Detenlos cuando quieras, sin iniciar sesión: {stopUrl}", // [CHECK]
  "email.adoptApproved.subject": "Fuiste aprobado para patrocinar {box}", // [CHECK]
  "email.adoptApproved.line1": "Buenas noticias — tu solicitud para patrocinar {box} como \"{displayName}\" fue aprobada.", // [CHECK]
  "email.adoptApproved.line2": "Tu nombre ahora aparecerá en la tarjeta de la caja, y recibirás un correo si se reporta vacía o con un problema.", // [CHECK]
  "email.alertConfirm.subject": "Confirma tus alertas para {box}", // [CHECK]
  "email.alertConfirm.line1": "Confirma que quieres recibir alertas por correo de {box}.", // [CHECK]
  "email.alertConfirm.line2": "Te avisaremos por correo si se reporta vacía o con poco surtido.", // [CHECK]
  "email.alertConfirm.cta": "Confirma tu correo: {url}", // [CHECK]
  "email.alertConfirm.disclaimer": "Si tú no pediste esto, puedes ignorar este correo. No te escribiremos de nuevo a menos que alguien confirme.", // [CHECK]
  "email.hostWelcome.subject": "Ahora recibirás alertas de {box}", // [CHECK]
  "email.hostWelcome.line1": "Se te agregó como contacto anfitrión de {box}.", // [CHECK]
  "email.hostWelcome.line2": "Recibirás un correo si se reporta vacía o con un problema.", // [CHECK]

  // ─── SEO hub pages (#709) ───
  "meta.foodPantries.title": "Despensas de alimentos en Pueblo, CO", // [CHECK]
  "meta.foodPantries.description":
    "Todas las despensas de alimentos en Pueblo Food Map, en el Condado de Pueblo, CO, con direcciones, horarios en palabras sencillas cuando los tenemos, y cómo funcionan las despensas.", // [CHECK]
  "meta.snapWic.title": "Lugares que aceptan SNAP y WIC en Pueblo, CO", // [CHECK]
  "meta.snapWic.description":
    "Lugares en el Condado de Pueblo, CO que aceptan SNAP/EBT o WIC, como supermercados y mercados, con direcciones.", // [CHECK]
  "meta.gardens.title": "Huertos comunitarios en Pueblo, CO", // [CHECK]
  "meta.gardens.description":
    "Huertos comunitarios y paisajes comestibles en el Condado de Pueblo, CO, con direcciones y horarios cuando los tenemos.", // [CHECK]
  "hubs.hoursMissing": "Horario no disponible. Confirma antes de ir.", // [CHECK]
  "hubs.pantries.heading": "Despensas de alimentos en el Condado de Pueblo", // [CHECK]
  "hubs.pantries.introFree": "Hay {count} despensas de alimentos gratuitas en el mapa del Condado de Pueblo, CO. Cada una aparece abajo con su dirección, y su horario cuando lo tenemos.", // [CHECK]
  "hubs.pantries.introPlain": "Hay {count} despensas de alimentos en el mapa del Condado de Pueblo, CO. Cada una aparece abajo con su dirección, y su horario cuando lo tenemos.", // [CHECK]
  "hubs.pantries.faq.heading": "Cómo funcionan las despensas de alimentos", // [CHECK]
  "hubs.pantries.faq.q1": "¿Qué es una despensa de alimentos?", // [CHECK]
  "hubs.pantries.faq.a1": "Una despensa de alimentos entrega comida a las personas que la necesitan, normalmente sin costo. Muchas son operadas por iglesias, grupos comunitarios y organizaciones sin fines de lucro.", // [CHECK]
  "hubs.pantries.faq.q2": "¿Necesito llamar o inscribirme primero?", // [CHECK]
  "hubs.pantries.faq.a2": "Depende de la despensa. Algunas abren en días y horarios fijos, y otras piden que llames primero. Revisa el horario que aparece aquí y llama antes si la página del lugar tiene un teléfono.", // [CHECK]
  "hubs.pantries.faq.q3": "¿Cada cuánto puedo ir?", // [CHECK]
  "hubs.pantries.faq.a3": "Cada despensa fija sus propios límites. Pregunta cuáles son cuando llames o vayas.", // [CHECK]
  "hubs.pantries.faq.q4": "¿Qué hago si falta el horario o la despensa está cerrada?", // [CHECK]
  "hubs.pantries.faq.a4": "Los horarios pueden cambiar, y algunos lugares no han compartido el suyo. Llama antes, o llama al 2-1-1 o a la Línea de Recursos Alimentarios al 855-855-4626 y pregunta por las despensas abiertas hoy.", // [CHECK]
  "hubs.snapWic.heading": "Lugares que aceptan SNAP y WIC", // [CHECK]
  "hubs.snapWic.intro": "{snap} lugares en el mapa aceptan SNAP/EBT y {wic} aceptan WIC. Cada uno aparece abajo con su dirección.", // [CHECK]
  "hubs.snapWic.badgeSnap": "Acepta SNAP/EBT", // [CHECK]
  "hubs.snapWic.badgeWic": "Acepta WIC", // [CHECK]
  "hubs.snapWic.note": "Lo que acepta un lugar puede cambiar. Confirma con el lugar antes de ir.", // [CHECK]
  "hubs.snapWic.apply": "¿Quieres solicitar SNAP o WIC?", // [CHECK]
  "meta.boxes.title": "Cajas de bendiciones en Pueblo, CO", // [CHECK]
  "meta.boxes.description":
    "Cajas de bendiciones comunitarias en el Condado de Pueblo, CO: cajas pequeñas donde los vecinos dejan y toman comida y artículos básicos. Nombres y direcciones, con un enlace a cada una en el mapa.", // [CHECK]
  "hubs.boxes.heading": "Cajas de bendiciones en el Condado de Pueblo", // [CHECK]
  "hubs.boxes.intro": "Hay {count} cajas de bendiciones en el mapa del Condado de Pueblo, CO. Cada una enlaza a su tarjeta en el mapa.", // [CHECK]
  "hubs.boxes.introOne": "Hay 1 caja de bendiciones en el mapa del Condado de Pueblo, CO. Enlaza a su tarjeta en el mapa.", // [CHECK]
  "hubs.boxes.what": "Una caja de bendiciones es una caja comunitaria pequeña donde los vecinos dejan y toman comida y artículos básicos. Abre el mapa para ver los detalles actuales de cada caja.", // [CHECK]
  "hubs.boxes.empty": "Por ahora no hay cajas de bendiciones en la lista.", // [CHECK]
  "hubs.boxes.degraded": "No pudimos cargar la lista de cajas de bendiciones en este momento. Abre el mapa para verlas.", // [CHECK]
  "hubs.boxes.openMap": "Abrir el mapa", // [CHECK]
  "hubs.gardens.heading": "Huertos comunitarios y paisajes comestibles en el Condado de Pueblo", // [CHECK]
  "hubs.gardens.section.garden": "Huertos comunitarios", // [CHECK]
  "hubs.gardens.section.edible_landscape": "Paisajes comestibles", // [CHECK]
  "hubs.gardens.introFree": "Hay {count} huertos comunitarios y paisajes comestibles gratuitos en el mapa del Condado de Pueblo, CO. Cada uno aparece abajo con su dirección y horario cuando los tenemos.", // [CHECK]
  "hubs.gardens.introPlain": "Hay {count} huertos comunitarios y paisajes comestibles en el mapa del Condado de Pueblo, CO. Cada uno aparece abajo con su dirección y horario cuando los tenemos.", // [CHECK]
};
