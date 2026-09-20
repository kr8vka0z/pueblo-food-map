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
  "search.placeholder": "Search",
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
  "category.blessing_box": "Blessing Box",

  // Category labels (full)
  "category.full.pantry": "Food Pantry",
  "category.full.grocery": "Grocery / Supermarket",
  "category.full.convenience": "Convenience Store",
  "category.full.farm": "Farm / Market",
  "category.full.garden": "Community Garden",
  "category.full.edible_landscape": "Edible Landscape",
  "category.full.meal_site": "Meal Site",
  "category.full.blessing_box": "Blessing Box",

  // Category rail section headers
  "rail.categories": "Categories",
  "rail.filters": "Filters",

  // Filters
  "filter.openNow": "Open now",
  "filter.snap": "Accepts SNAP",
  "filter.wic": "Accepts WIC",
  "filter.walkingDistance": "Walking distance",

  // Filters button + side panel (#513) — Favorites filter removed (Saved in
  // the bottom bar covers it); the single-category dropdown became this
  // multi-select panel.
  "filters.button.label": "Filters",
  "filters.button.labelActive": "Filters, {count} on",
  "filters.panel.title": "Filters",
  "filters.panel.close": "Close filters",
  "filters.panel.showOnly": "Show only",
  "filters.panel.kindOfPlace": "Kind of place",
  "filters.panel.clearAll": "Clear all",
  "filters.panel.showResults": "Show {count} places",

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
  // "View on the map" CTA on /venue/[id] — was a hardcoded English string
  // (pueblo-food-map#bilingual-static-pages) since that page never read locale.
  "detail.viewOnMap": "View on the map",
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
  "badge.hoursUnknown": "Hours unknown — call ahead",
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
  "splash.cat.blessing_box": "Blessing box",

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
  "locate.outsideCounty": "Your location is outside Pueblo County",

  // Bottom navigation bar (docs/bottom-nav-spec.md §11)
  "nav.nearMe": "Near me",
  "nav.saved": "Saved",
  // Boxes (#516) — one-tap shortcut to the blessing-box category filter.
  // Sits between Saved and Help so it's under the thumb (Kyle, 2026-09-19).
  "nav.boxes": "Boxes",
  // Renamed from "Resources" (#516, Kyle 2026-09-19) — the page itself keeps
  // its own title ("Food help programs", nav.resourcesPage below); only the
  // bar's short word changes. Kyle accepts some visitors may read "Help" as
  // "how to use the site" for now; a tutorial is planned separately.
  "nav.resources": "Help",
  "nav.menu": "Menu",
  "nav.aria": "Main",
  // PageNav's top "Back to map" bar (review item 7c) — distinct from BottomNav's
  // "Main" landmark so a screen reader doesn't announce two navs both named "Main".
  "nav.pageAria": "Page",

  // Saved places (#132)
  "menu.saved.heading": "Saved places",
  "menu.saved.emptyTitle": "No saved places yet",
  "menu.saved.emptyBody": "Tap the star on any place to save it. It will show up here.",

  // Hamburger menu (#71, #96, #99, #109)
  "menu.open": "Open menu",
  "menu.close": "Close menu",
  "menu.title": "Pueblo Food Map",
  "menu.suggest": "Suggest a venue",
  "menu.sponsoredBy": "Sponsored by",
  "menu.showWelcome": "Show welcome screen",
  "menu.language": "Language / Idioma",
  // Map/List entry point (#514) — top of the Menu, for anyone who never taps
  // search. Reads the OPPOSITE of the current view (the destination, same
  // convention as viewSuggestion.* above). Hidden entirely while the map
  // can't mount (#165) rather than shown disabled — see HamburgerMenu.tsx.
  "menu.listView": "List view",
  "menu.mapView": "Map view",

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
  "suggest.category.blessing_box": "Blessing Box",
  "suggest.hours.label": "Hours (optional)",
  "suggest.hours.placeholder": "e.g. Mon–Fri 9am–5pm",
  "suggest.contact.label": "Contact info (optional)",
  "suggest.contact.placeholder": "Phone, email, or website URL",
  "suggest.snap.label": "Accepts SNAP",
  "suggest.wic.label": "Accepts WIC",
  "suggest.notes.label": "Additional notes (optional)",
  "suggest.notes.placeholder": "Anything else we should know?",
  "suggest.submitterEmail.label": "Your email",
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
  "suggest.validation.emailRequired": "Please enter your email address.",
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

  // View switch — search-bar suggestion row + Menu line (#514). Replaces the
  // old in-bar ViewToggle (#129/#191, removed): switching map/list now goes
  // through one line under an empty, focused search bar, a "See all N
  // matches as a list" row under a typed one, or a Menu item — never a
  // standing control in the bar itself.
  "viewSuggestion.seeAsList": "See all places as a list",
  "viewSuggestion.backToMap": "Back to the map",
  "viewSuggestion.placesCount": "{count} places",
  "viewSuggestion.seeMatchesAsList": "See all {count} matches as a list",

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
  "marker.category.blessing_box": "Blessing box",

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
  // Rewrite (slice 6, Blessing Boxes adopt-a-box + alerts): the old, single
  // un-headed "privacy.body" paragraph is REPLACED by "What we collect"
  // below (privacy.collect.*), plus two new headed sections — one paragraph
  // per i18n key, per the task's own instruction ("not overloading
  // privacy.body"). privacy.analytics (below) is unchanged wording, kept
  // last, per the task's own "keep the analytics paragraph unchanged."
  "privacy.collect.heading": "What we collect",
  "privacy.collect.body": "Pueblo Food Map collects the information you type into our forms (place reports, suggestions, and feedback). We use it to review what you sent and, if you gave an email address, to write back. Your IP address is checked to block spam when you send a form, and is never saved with what you sent.",
  "privacy.checkins.heading": "Blessing box check-ins",
  "privacy.checkins.body": "Checking in at a blessing box is anonymous. We do not ask for your name or email, and we do not save your IP address. A photo you add is reviewed before it shows, and location details hidden inside the photo file are removed.",
  "privacy.alerts.heading": "Email alerts and adopting a box",
  "privacy.alerts.body1": "We keep your email address only if you ask for it: when you sign up for emails about a blessing box, or when you apply to adopt one. If you host a box, Pueblo Food Map staff may add your email, with your OK, so you hear when your box is empty or has a problem. We use these addresses only to send those emails. We never sell them, share them, or show them on the site.",
  "privacy.alerts.body2": "If you adopt a box, the name you give us (for example, a group or family name) is shown on that box's card. Your email is not.",
  "privacy.alerts.body3": "Every alert email has a stop link. One click stops the emails, with no login. To have your email address deleted completely, write to issues@pueblofoodmap.com.",
  "privacy.alerts.body4": "Our emails are delivered by a mail service called Resend, which handles your address only to deliver them.",
  "privacy.analytics": "We use Cloudflare Web Analytics to count visits and measure how quickly pages load. It sets no cookies and stores nothing on your device, it does not identify you by your IP address or your browser, and it does not follow you to other websites. It records things like which page was viewed, the site you arrived from, your browser and device type, your country, and how long the page took to load. We use no advertising pixels and no other analytics service.",

  // Directions (#134) — Walk / Bus / Drive buttons on venue detail cards
  "directions.walk": "Walk",
  "directions.bus": "Bus",
  "directions.drive": "Drive",
  "directions.walkAriaLabel": "Walking directions to {name} (opens on map)",
  "directions.busAriaLabel": "Bus directions to {name} (opens in new tab)",
  "directions.driveAriaLabel": "Drive directions to {name} (opens in new tab)",
  // Box card fix pass (2026-09-19, item 4) — the address link has no preset
  // travel mode (walk/bus/drive all left to Google Maps), so its aria text
  // is deliberately mode-neutral, unlike the three labels above.
  "directions.boxAriaLabel": "Directions to {name} (opens in new tab)",
  "directions.routeDistance": "{distance} walk",
  "directions.routeDuration": "{duration}",
  "directions.clearRoute": "Clear walking route",
  // Route strip (#509) — "Show card" restores the full card BottomSheet
  // shrinks to a strip while a walking route is active.
  "directions.showCard": "Show card",
  // Walk-without-location hint (#207) — shown when Walk requests geolocation
  // (userLocation was null) and the browser denies it or it's unavailable.
  "directions.locationHint": "Share your location to see walking directions.",
  // Turn-by-turn step list (#134 enhancement)
  "directions.showSteps": "Show steps",
  "directions.hideSteps": "Hide steps",
  // #539: RouteStrip's own "Steps" button (opens the steps SHEET, no
  // show/hide toggle state) is a separate control from the in-card
  // showSteps/hideSteps TOGGLE above (DirectionButtons.tsx) — Kyle approved
  // shortening the strip's label only; the in-card toggle still needs its
  // two-state "Show steps"/"Hide steps" wording, so it keeps its own key.
  "directions.steps": "Steps",
  "directions.stepsListLabel": "Turn-by-turn directions",
  // #537 — the route strip's Steps control only renders when a route has
  // steps; shown in its place (never silently hidden) when it genuinely
  // doesn't, so the strip reads as complete rather than broken.
  "directions.noStepsForRoute": "No turn-by-turn steps for this route",
  // Per-step distance suffixes — used when formatting short distances in the step list.
  // "ft" for sub-528 ft steps (sub-0.1 mi), otherwise the decimal miles value.
  "directions.stepFt": "{distance} ft",
  "directions.stepMi": "{distance} mi",
  // Google Maps walk handoff (#134 enhancement)
  "directions.openInGoogleMaps": "Open in Google Maps",
  "directions.openInGoogleMapsAria": "Open walking directions to {name} in Google Maps (opens in new tab)",

  // About page (#155) — DRAFT copy pending final text from Kyle / Pueblo Food Project
  "about.heading": "About Pueblo Food Map",
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

  // Venues directory (#PR4)
  "nav.venuesList": "Browse all venues",
  "venues.heading": "All food resources",
  "venues.intro": "Every pantry, grocery store, community garden, farm, and meal site on the map — grouped by type, with addresses and hours.",
  "venues.noHours": "Hours not listed",

  // Map-wide data freshness (board review finding #2) — surfaced in ListView
  // and /about so users can judge how current the whole map is, not just one
  // venue's own last_verified date.
  "freshness.updated": "Map data updated {date}",

  // About page FAQ + stats (#PR4)
  "about.stat.insecurity": "According to Feeding America's Map the Meal Gap (2023 data), about 1 in 6 Pueblo County residents — roughly 16.5% — faces food insecurity, including nearly 1 in 5 children.",
  "about.stat.count": "Pueblo Food Map currently maps {count} of the free and low-cost food resources that can help.",
  "about.faq.heading": "Frequently asked questions",
  "about.faq.q1": "Is Pueblo Food Map free to use?",
  "about.faq.a1": "Yes — completely free, with no account or sign-in. It's a community project, not a business.",
  "about.faq.q2": "Do I need ID, proof of income, or to share my immigration status to get food?",
  "about.faq.a2": "It depends on the location. Many pantries and meal sites serve anyone who comes — no ID or proof of income required; some ask only for basic details like household size. When a listing links to Plentiful, you can check what to bring before you go — and it's always okay to call ahead and ask.",
  "about.faq.q3": "Does the map show which places accept SNAP or WIC?",
  "about.faq.a3": "Yes. Places that accept SNAP or WIC show a badge, and you can filter the map to show only those. We mark SNAP/WIC where we've confirmed it, mainly for grocery stores and markets.",
  "about.faq.q4": "What if a listing is wrong, out of date, or a place has closed?",
  "about.faq.a4": "Please tell us. Every place has a 'Report an issue' option, and you can suggest one we're missing. We review every report and update the map as we confirm changes.",
  "about.faq.q5": "How current is the information?",
  "about.faq.a5": "Each place shows a 'last verified' date so you can judge how recent it is. Hours can still change — especially around holidays — so for anything time-sensitive, call ahead when a phone number is listed.",
  "about.faq.q6": "How do I get directions?",
  "about.faq.a6": "Open any place and choose Walk, Bus, or Drive. Walking directions show right on the map; bus and driving directions open in Google Maps.",

  // 404 Not Found page (#288)
  "notfound.title": "Page not found",
  "notfound.body": "The page you are looking for doesn't exist or has been moved.",
  "notfound.backToMap": "Back to map",

  // Resources page (/resources) — Kyle, 2026-09-16
  "nav.resourcesPage": "Food help programs",
  "resources.heading": "Food help programs",
  "resources.intro": "These programs can help you pay for groceries or get free food. Asking costs nothing. Not sure where to start? Call the Food Resource Hotline — they can tell you what you may qualify for.",
  "resources.goodFor": "What it's good for",
  "resources.how": "How to get it",
  "resources.checked": "Details checked with each program in September 2026. Hours and rules can change — call ahead if you can.",
  "resources.action.website": "Website",
  "resources.action.call": "Call {number}",
  "resources.action.text": "Text {number}",
  "resources.211.name": "2-1-1 Colorado",
  "resources.211.what": "A free helpline that connects you with local health and human services, including food.",
  "resources.211.goodFor": "Finding food pantries, community meals, home-delivered meals, and baby formula or baby food near you.",
  "resources.211.how": "Dial 2-1-1 or (866) 760-6489, or text your ZIP code to 898-211. You can also search or chat on their website.",
  "resources.snap.name": "SNAP (food stamps)",
  "resources.snap.what": "Money for groceries every month, loaded onto an EBT card that works like a debit card.",
  "resources.snap.goodFor": "Buying food at most grocery stores and some online stores. With Double Up Food Bucks, SNAP dollars go further on fruits and vegetables.",
  "resources.snap.how": "Apply online with Colorado PEAK, or at a Pueblo County Human Services office: 405 W. 9th St., 320 W. 10th St., or 2641 E. 4th St. (7:30 a.m.–5 p.m.). Whether you qualify depends on your household size and income. You may need a short interview by phone or in person. The Food Resource Hotline can help you apply by phone.",
  "resources.snap.apply": "Apply on PEAK",
  "resources.wic.name": "WIC",
  "resources.wic.what": "Healthy food, nutrition advice, and breastfeeding support (including pumps) for pregnant women, new moms, babies, and children under 5.",
  "resources.wic.goodFor": "Families with young children. Dads, grandparents, foster parents and other caregivers can get WIC for a child under 5. You don't need to be a U.S. citizen.",
  "resources.wic.how": "If you get Medicaid, SNAP or TANF, you already meet the income rule. Call the Pueblo WIC clinic (101 W. 9th St.; Monday–Thursday 8 a.m.–5 p.m., Friday 8 a.m.–4:30 p.m.), or fill out the online sign-up form and they'll contact you within 10 days.",
  "resources.wic.signup": "Sign up online",
  "resources.doubleup.name": "Double Up Food Bucks",
  "resources.doubleup.what": "A match on fresh fruits and vegetables for people who use SNAP.",
  "resources.doubleup.goodFor": "Getting twice the produce. When you use your EBT card at a participating store or farmers market, Double Up matches what you spend, dollar for dollar, up to $20 a day.",
  "resources.doubleup.how": "If you have a Colorado EBT card, you're already in — there's nothing to apply for. Just use your card at a participating location.",
  "resources.doubleup.find": "Find a location",
  "resources.hotline.name": "Food Resource Hotline",
  "resources.hotline.what": "A free, confidential phone line run by Hunger Free Colorado.",
  "resources.hotline.goodFor": "Getting pointed in the right direction. They check which programs you may qualify for, help you apply for SNAP over the phone, and connect you with food pantries, free meals and WIC. They help everyone, no matter their immigration status.",
  "resources.hotline.how": "Call 855-855-4626, Monday–Thursday 8:30 a.m.–4:30 p.m. or Friday 8 a.m.–noon. Help is available in more than 150 languages, including Spanish.",
  "resources.everydayeats.name": "Everyday Eats (60 and older)",
  "resources.everydayeats.what": "A free box of 22–25 basic foods every month from Pueblo County — things like milk, cheese, cereal, rice or pasta, and canned fruits, vegetables and protein.",
  "resources.everydayeats.goodFor": "Adults 60 and older with limited income. Households of any age on SNAP, Medicaid, SSI and some other programs can also get emergency food (called TEFAP) the same way.",
  "resources.everydayeats.how": "Text FOOD to 1-877-644-3663. You'll get a link to a short sign-up form. You'll renew every 6 months, and if you miss your box 3 months in a row you lose your spot.",

  // Blessing box card (rendered in-map, BottomSheet/DesktopVenueWindow, slice 1)
  // "box.host" deleted (card redesign, 2026-09-19) — the public host NAME
  // and "Host" heading are gone from the card entirely (display only; the
  // admin surface and host email alerts are untouched).
  "box.mostNeeded": "Most needed",
  "box.status": "Status",
  // Card redesign (2026-09-19): shortened for the status pill — the pill's
  // own second segment now carries "no recent check-ins" separately (see
  // box.status.unknown.detail below) rather than one long combined sentence.
  "box.status.unknown": "Unknown",
  "box.status.unknown.detail": "no recent check-ins",
  // Card is opening on the map (client redirect from /box/<id>) or the
  // full box record hasn't loaded into the card yet — both share this line.
  "box.cardLoading": "Loading…",
  // No-JS fallback (fix, PR review 2026-09-18): the redirect above needs a
  // client effect to run, so a JS-disabled visitor is never sent anywhere —
  // this is the plain link that gets them there by hand.
  "box.redirectLink": "View this box on the map",

  // Check-ins and live status (slice 2)
  "box.status.stocked": "Stocked",
  "box.status.low": "Running low",
  "box.status.empty": "Empty",
  "box.status.out_of_service": "Out of service",
  // Card redesign (2026-09-19): repurposed as the status pill's second
  // segment ("· filled {time}") — the pill itself supplies the "· " and the
  // leading "Last " no longer reads naturally there. Not used anywhere else
  // (grepped before changing — see this file's own header for the rule).
  "box.lastFilled": "filled {time}",
  "box.lastFilled.never": "Not marked filled yet",
  // #510: shortened to fit one line on a phone (was "How does the box look
  // right now?" — wrapped to two lines at 375px). "Update" covers every
  // button under the heading (filled/low/empty/took/photo); "check in" was
  // internal wording never meant for the visitor-facing card.
  "box.checkin.heading": "Please update this box",
  "box.checkin.filled": "I filled it",
  "box.checkin.took": "I used this box",
  "box.checkin.low": "Running low",
  "box.checkin.empty": "It's empty",
  "box.checkin.problem": "Report a problem",
  "box.checkin.noteLabel": "Add a short note (optional)",
  "box.checkin.notePlaceholder.filled": "e.g. Topped it off with canned soup",
  "box.checkin.notePlaceholder.problem": "e.g. Door is broken",
  "box.checkin.submit": "Send",
  "box.checkin.submitting": "Sending…",
  "box.checkin.cancel": "Cancel",
  "box.checkin.success.filled": "Thanks for filling it!",
  "box.checkin.success.took": "Thanks — enjoy!",
  "box.checkin.success.low": "Thanks for the heads up.",
  "box.checkin.success.empty": "Thanks for letting us know.",
  "box.checkin.success.problem": "Thanks — we've let the admin know.",
  "box.checkin.error": "That didn't go through. Please try again.",
  // Split 2026-09-17 (review correction) from one shared "rateLimit" key —
  // a single message misdirected blame between "this device is over its
  // own cap" and "this box is busy right now." See the checkins route's
  // own header for the two distinct error codes these key off.
  "box.checkin.error.rateLimitVisitor": "Too many check-ins from this device right now. Please try again later.",
  "box.checkin.error.rateLimitBox": "This box is getting an unusual number of check-ins right now. Please try again later.",
  // Shown while the fallback (visible) Turnstile widget is on screen,
  // waiting for the visitor to tap it — replaces the old red error text for
  // this case (BoxCheckinPanel.tsx, "Fallback to a visible checkbox").
  "box.checkin.turnstileFallbackPrompt": "Tap the box below to confirm you're a person.",

  // "What would help you next time?" ask (migration 0012, mockup v3 Part 2)
  // — shown IN PLACE of the check-in buttons right after a 'took' check-in
  // succeeds. Nine fixed choices below (box.needs.<key>) mirror
  // NEED_KEYS in src/lib/blessingBoxes.ts exactly — that array is the
  // single source of truth for the vocabulary; these are only the display
  // labels.
  "box.needs.heading": "What would help you next time?",
  "box.needs.sub": "Tap any. This tells givers what to bring.",
  "box.needs.otherLabel": "Something else? (optional)",
  "box.needs.send": "Send",
  "box.needs.skip": "Skip",
  "box.needs.success": "Got it — thank you.",
  "box.needs.canned_food": "Canned food",
  "box.needs.fresh_food": "Fresh food",
  "box.needs.bread": "Bread",
  "box.needs.baby_items": "Baby items",
  "box.needs.diapers": "Diapers",
  "box.needs.hygiene": "Hygiene items",
  "box.needs.pet_food": "Pet food",
  "box.needs.drinks": "Water / drinks",
  "box.needs.warm_clothing": "Warm clothing",
  // The self-filling "Most needed" label (BoxCardBody.tsx) when no admin
  // most_needed text is set — distinguishes visitor-sourced data from the
  // admin-typed line above it (box.mostNeeded), which keeps its own label.
  "box.mostNeeded.fromVisitors": "Most needed · from people who use this box",

  // Slice 5 photo-upload UI (BoxCheckinPanel.tsx / imageResize.ts). The
  // disclosure line is shown under every picker, standalone and
  // note-attached alike — moderation + "no faces or plates" in one short
  // sentence, per the task's own spec.
  "box.photo.addButton": "Add a photo",
  "box.photo.attachLabel": "Add a photo (optional)",
  "box.photo.chooseLabel": "Choose a photo",
  "box.photo.disclosure": "Photos are reviewed before they're shown publicly. Please don't include faces or license plates.",
  "box.photo.processing": "Preparing photo…",
  "box.photo.processError": "Couldn't process that photo. Please try a different one.",
  "box.photo.unsupportedFormat": "That photo format isn't supported. Please try a JPEG or PNG.",
  "box.photo.previewAlt": "Preview of the photo you selected",
  "box.photo.remove": "Remove",
  "box.photo.send": "Send",
  "box.photo.sending": "Sending…",
  "box.photo.success": "Thanks! Your photo has been submitted for review.",
  "box.photo.error": "That didn't go through. Please try again.",

  // Photo DISPLAY (card slot + history grid) and "Report this photo"
  // (ReportPhotoButton.tsx) — separate from the upload-picker keys above.
  "box.photo.heading": "Photo",
  // Card redesign (2026-09-19): repurposed as the small caption chip on the
  // photo's bottom-right corner ("Photo · {time}") — was "Shared {time}" as
  // a caption line below the image, a layout this key's only caller no
  // longer has.
  "box.photo.caption": "Photo · {time}",
  "box.photo.altText": "Photo of {name}, shared {time}",
  // #508: the card photo becomes a button that opens PhotoViewer full-screen.
  "box.photo.viewFullSize": "View photo full size",
  // #511 review nit: BoxActivityList's per-entry thumbnail button needs a
  // label that varies per row (the generic viewFullSize text above is
  // identical for every photo entry in the log, so multiple photos are
  // indistinguishable to a screen reader) — {time} makes each one unique.
  "box.photo.viewFullSizeAt": "View photo full size · {time}",
  "box.photo.report": "Report this photo",
  "box.photo.reporting": "Reporting…",
  "box.photo.reportConfirm": "Hide this photo and send it for review?",
  "box.photo.reportThanks": "Thanks — this photo has been hidden pending review.",
  "box.photo.reportError": "That didn't go through. Please try again.",
  "box.photo.morePhotos": "Show more photos",
  "box.photo.none": "No photos yet",
  "box.photo.galleryHeading": "Photos",

  // "box.recentCheckin.heading"/"box.recentCheckin.none" deleted (card
  // redesign, 2026-09-19) — the standalone "Most recent check-in" line is
  // gone; the status pill now carries recency (box.lastFilled above), and
  // the full timeline still lives at /box/<id>/history via the link below.
  // "History" link on the card -> /box/<id>/history (map-first rework)
  "box.history.link": "History",
  "box.history.subheading": "Full history for this box",
  // /box/<id>/history page (map-first rework scope addition, 2026-09-18) —
  // reuses BoxActivityList/useBoxActivity filtered to one box, so it needs
  // no new heading/empty-state keys of its own. "box.history.back" (its own
  // "Back to the map" link) was deleted 2026-09-18: PageNav's chrome-level
  // link already covers it (backHref, see PageNav.tsx's own header) — two
  // "back to map" links on one page was the bug being fixed.

  // Numbers (slice 7) — BoxNumbersPanel.tsx is shared by BOTH the per-box
  // section (/box/<id>/history) and the network-wide section
  // (/boxes/activity), so these keys carry no per-box/network split of their
  // own; only the two heading keys below name which context they're in.
  "box.stats.perBoxHeading": "Numbers for this box",
  "box.stats.networkHeading": "Network numbers",
  // Current ("right now") network counts, issue #512 — independent of the
  // period picker below, unlike every other box.stats.* key on this page.
  "box.stats.boxCount": "Blessing boxes",
  "box.stats.sponsorCount": "Sponsors",
  "box.stats.avgSponsorsPerBox": "Avg. sponsors per box",
  "box.stats.period": "Time period",
  "box.stats.period.7d": "Last 7 days",
  "box.stats.period.30d": "Last 30 days",
  "box.stats.period.90d": "Last 90 days",
  "box.stats.period.all": "All time",
  "box.stats.fills": "Fills",
  "box.stats.uses": "Uses (“I used this box”)",
  "box.stats.emptyReports": "Empty reports",
  "box.stats.lowReports": "Low reports",
  "box.stats.totalCheckins": "Total check-ins",
  // Reworded from "Approved photos" (issue #512, Kyle) — "approved" reads
  // like a moderation-status label; "shared" is what the photo actually is
  // to the person who submitted it.
  "box.stats.approvedPhotos": "Shared photos",
  "box.stats.avgHeading": "Typical timing",
  "box.stats.avg.emptyToFill": "Empty to next fill",
  "box.stats.avg.fillToFill": "Fill to next fill",
  "box.stats.avg.fillToEmpty": "Fill to next empty",
  // No pair of that type has happened yet for the selected box(es) — never a
  // 0, see boxStats.ts's own computePairAverages header for why.
  "box.stats.noData": "—",
  "box.stats.duration.hours": "{value} hours",
  "box.stats.duration.days": "{value} days",
  "box.stats.honestyNote": "These numbers count check-ins, not every visit — so “uses” reads lower than real foot traffic, on purpose.",
  "box.stats.neverFilled": "Never filled",
  "box.stats.needLoveHeading": "Boxes that need love",
  "box.stats.needLove.longestSinceFill": "Longest since last fill",
  "box.stats.needLove.mostEmptyReports": "Most empty reports",
  "box.stats.needLove.slowestRefill": "Slowest to refill",
  "box.stats.needLove.empty": "Not enough history yet.",
  "box.stats.needLove.emptyReportCount": "{count} empty reports",
  "box.stats.milestonesHeading": "Milestones",
  "box.stats.milestone.fills": "Pueblo has filled its blessing boxes {threshold}+ times",
  "box.stats.milestone.uses": "Neighbors have used Pueblo's blessing boxes {threshold}+ times",

  // Adopt-a-box + email alerts (slice 6). Both card forms use their OWN
  // disclosure string, not privacy.emailDisclosure: that one says the email
  // is "used only to follow up on your submission", which is false here —
  // these two forms KEEP the address and send recurring mail to it, and the
  // privacy page Kyle signed off says so.
  "box.alerts.emailDisclosure": "We keep your email only to send these emails. Every alert email has a stop link.",
  // Reworded (Blessing Boxes slice 6 follow-up) from "Adopt this box" —
  // adoption is an APPLICATION an admin approves, not something that
  // happens the moment this form is submitted; the old wording implied
  // instant adoption. Also the form's own <h3> heading (AdoptBoxForm.tsx
  // reuses this same key for both the collapsed link and the expanded
  // heading), so both read consistently.
  "box.adopt.linkLabel": "Apply to adopt this box",
  "box.adopt.displayNameLabel": "Your name (shown publicly, e.g. a group or family name)",
  "box.adopt.displayNamePlaceholder": "e.g. The Martinez Family",
  "box.adopt.emailLabel": "Your email (kept private)",
  "box.adopt.noteLabel": "Note for the admin (optional, private)",
  "box.adopt.submit": "Send application",
  "box.adopt.submitting": "Sending…",
  "box.adopt.cancel": "Cancel",
  "box.adopt.success": "Check your email to confirm.",
  "box.alerts.linkLabel": "Email me when it needs filling",
  "box.alerts.emailLabel": "Your email",
  "box.alerts.submit": "Sign me up",
  "box.alerts.submitting": "Sending…",
  "box.alerts.cancel": "Cancel",
  "box.alerts.success": "Check your email to confirm.",
  // Shared between both forms above — same "one generic message per class
  // of failure" convention as box.checkin.error, but not scope-split like
  // that one: the adopt/alert forms don't need per-scope wording, only "try
  // again" vs. "try again later."
  "box.form.error.generic": "That didn't go through. Please try again.",
  "box.form.error.rateLimit": "Too many attempts right now. Please try again later.",

  // Sponsor band (card redesign, 2026-09-19) — replaces the old flat
  // "Cared for by {names}" line AND the collapsed "Apply to adopt this box"
  // link that used to sit lower on the card; both now live in one band
  // right under the photo. Names render as bold JSX <b> per adopter (not
  // interpolated into one string), so "Sponsored by" is a plain prefix key.
  "box.sponsor.needsSponsor": "This box needs a sponsor.",
  "box.sponsor.sponsoredByPrefix": "Sponsored by ",
  "box.sponsor.and": "and",
  "box.sponsor.moreCount": "+{count} more",
  "box.sponsor.wantToHelp": "Want to help too? ",

  // /alerts/confirm and /alerts/stop — the shared double-opt-in confirm and
  // one-click-unsubscribe pages (slice 6). Both carry `robots: noindex` and
  // a `Referrer-Policy: no-referrer` (tokens live in the URL) — see
  // next.config.ts and each page's own metadata export.
  "alerts.confirm.heading": "Confirm your email",
  "alerts.confirm.body": "Click the button below to confirm you'd like these emails.",
  "alerts.confirm.button": "Confirm",
  "alerts.confirm.confirming": "Confirming…",
  "alerts.confirm.success": "You're confirmed! You'll get emails as described.",
  "alerts.confirm.invalid": "This confirmation link is no longer valid.",
  "alerts.confirm.error": "Something went wrong. Please try again.",
  "alerts.stop.heading": "Emails stopped",
  "alerts.stop.stopping": "Stopping…",
  "alerts.stop.body": "You won't get any more emails about this.",
  "alerts.stop.invalid": "This link is no longer valid.",
  "alerts.stop.noscriptButton": "Stop these emails",
  "alerts.stop.undoButton": "That was a mistake — turn emails back on",
  "alerts.stop.undoing": "Turning back on…",
  "alerts.stop.undone": "You're back on the list.",
  "alerts.stop.undoError": "That didn't go through. Please try again.",

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
  "email.adoptConfirm.subject": "Confirm your application to adopt {box}",
  "email.adoptConfirm.line1": "Thanks for applying to adopt {box}. Please confirm your email to finish your application.",
  "email.adoptConfirm.line2": "An admin will review your application once you've confirmed.",
  "email.adoptConfirm.cta": "Confirm your email: {url}",
  // 2026-09-18 security review, item 7: an "if you didn't ask for this"
  // line on every confirm email — someone else could have typed this
  // address in by mistake (or on purpose), and this line tells them
  // exactly what happens if they do nothing (nothing).
  "email.adoptConfirm.disclaimer": "If you didn't ask for this, you can ignore this email. We won't write again unless someone confirms.",
  "email.adoptApproved.subject": "You're approved to adopt {box}",
  "email.adoptApproved.line1": "Good news — your application to adopt {box} as \"{displayName}\" has been approved.",
  "email.adoptApproved.line2": "Your name will now show on the box's card, and you'll get an email if it's reported empty or has a problem.",
  "email.alertConfirm.subject": "Confirm your alerts for {box}",
  "email.alertConfirm.line1": "Please confirm you'd like email alerts for {box}.",
  "email.alertConfirm.line2": "We'll email you if it's reported empty or running low.",
  "email.alertConfirm.cta": "Confirm your email: {url}",
  "email.alertConfirm.disclaimer": "If you didn't ask for this, you can ignore this email. We won't write again unless someone confirms.",
  "email.hostWelcome.subject": "You're now getting alerts for {box}",
  "email.hostWelcome.line1": "You've been added as a host contact for {box}.",
  "email.hostWelcome.line2": "You'll get an email if it's reported empty or has a problem.",

  // Activity log (/boxes/activity, slice 3) and nav entry
  "nav.boxActivity": "Blessing box activity",
  "activity.heading": "Blessing box activity",
  "activity.intro": "Every fill, low report, empty report, and box change across the network, newest first.",
  "activity.empty": "No activity to show yet.",
  "activity.prevPage": "Previous",
  "activity.nextPage": "Next",
  "activity.loading": "Loading…",
  "activity.resultCount": "{count} results",
  "activity.filters.box": "Box",
  "activity.filters.boxAll": "All boxes",
  "activity.filters.kind": "Kind",
  "activity.filters.kindAll": "All kinds",
  "activity.filters.from": "From",
  "activity.filters.to": "To",
  "activity.filters.clear": "Clear filters",
  // activity.recentEmpty: BoxHistoryContent's per-box empty state
  // (/box/<id>/history). activity.recentHeading and activity.viewFull
  // (the old BoxContent per-box "Recent activity" section header + "See
  // full activity" link) were removed with it (map-first rework scope
  // addition, 2026-09-18) — the card shows one line, not a list, and
  // "History" (box.history.link, above) replaces "See full activity".
  "activity.recentEmpty": "No activity at this box yet.",
  "activity.thisBox": "This box",
  // Line templates — {name} is the box's own name (already reads
  // "Blessing Box - 216 W Routt" etc., so these deliberately don't repeat
  // "Box at" ahead of it, per the Discovery doc's own example lines).
  "activity.line.filled": "{name} was filled",
  "activity.line.took": "Someone used {name}",
  "activity.line.low": "{name} is running low",
  "activity.line.empty": "{name} is empty",
  "activity.line.added": "{name} was added as a new blessing box",
  "activity.line.moved": "{name} moved",
  "activity.line.renamed": "{name} was renamed",
  "activity.line.paused": "{name} was paused",
  "activity.line.removed": "{name} was removed",
  // #511 — per-box history log only (never the global feed's own vocabulary,
  // see boxActivity.ts's PerBoxActivityKind). photo_added: no {name} — it's
  // always rendered on the box's own history page, so naming the box again
  // would be noise (unlike the checkin/event lines above, which are shared
  // with the global feed and DO need the box's name). sponsor_added's
  // {name} is the SPONSOR's display name, not the box's — see
  // BoxActivityList.tsx's own header for why this one line gets a different
  // `name` value than every other line template here.
  "activity.line.photo_added": "A new photo was added",
  "activity.line.sponsor_added": "{name} became a sponsor",
  // Short noun labels for the kind filter's <option> text — distinct from
  // box.checkin.* above, which is first-person button copy ("I filled it")
  // that reads oddly as a filter option.
  "activity.kind.filled": "Filled",
  "activity.kind.took": "Used the box",
  "activity.kind.low": "Running low",
  "activity.kind.empty": "Empty",
  "activity.kind.added": "Box added",
  "activity.kind.moved": "Box moved",
  "activity.kind.renamed": "Box renamed",
  "activity.kind.paused": "Box paused",
  "activity.kind.removed": "Box removed",

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
  "search.placeholder": "Buscar",
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
  "category.blessing_box": "Caja de bendiciones", // [CHECK]

  // Category labels (full)
  "category.full.pantry": "Despensa de alimentos",
  "category.full.grocery": "Supermercado",
  "category.full.convenience": "Tienda de conveniencia",
  "category.full.farm": "Granja / Mercado",
  "category.full.garden": "Huerto comunitario",
  "category.full.edible_landscape": "Paisaje comestible", // [CHECK]
  "category.full.meal_site": "Comedor comunitario",
  "category.full.blessing_box": "Caja de bendiciones", // [CHECK]

  // Category rail section headers
  "rail.categories": "Categorías",
  "rail.filters": "Filtros",

  // Filters
  "filter.openNow": "Abierto ahora",
  "filter.snap": "Acepta SNAP",
  "filter.wic": "Acepta WIC",
  "filter.walkingDistance": "Distancia caminando",

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
  "detail.viewOnMap": "Ver en el mapa",
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

  // Empty state (PR 3)
  "empty.title": "Ningún lugar coincide con tus filtros.",
  "empty.clear": "Borrar filtros",
  "empty.noMatches": "Sin resultados para \"{query}\"",
  "empty.tryCategoryInstead": "Prueba una categoría:",
  "empty.showCategoryAria": "Mostrar lugares de {label}",

  // Sponsor credit (#69)

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
  "splash.cat.blessing_box": "Caja de bendiciones", // [CHECK]

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

  // Hamburger menu (#71, #96, #99, #109)
  "menu.open": "Abrir menú",
  "menu.close": "Cerrar menú",
  "menu.title": "Pueblo Food Map",
  "menu.suggest": "Sugerir un lugar",
  "menu.sponsoredBy": "Patrocinado por",
  "menu.showWelcome": "Mostrar pantalla de bienvenida",
  "menu.language": "Language / Idioma",
  "menu.listView": "Vista de lista",
  "menu.mapView": "Vista de mapa",

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
  "privacy.collect.heading": "Qué recopilamos", // [CHECK]
  "privacy.collect.body": "Pueblo Food Map recopila la información que escribes en nuestros formularios (reportes de lugares, sugerencias y comentarios). La usamos para revisar lo que enviaste y, si diste un correo electrónico, para responderte. Tu dirección IP se revisa para bloquear spam cuando envías un formulario, y nunca se guarda junto con lo que enviaste.", // [CHECK]
  "privacy.checkins.heading": "Registros en cajas de bendición", // [CHECK]
  "privacy.checkins.body": "Registrar tu visita a una caja de bendición es anónimo. No pedimos tu nombre ni tu correo, y no guardamos tu dirección IP. Una foto que agregues se revisa antes de publicarse, y los detalles de ubicación ocultos en el archivo de la foto se eliminan.", // [CHECK]
  "privacy.alerts.heading": "Alertas por correo y adopción de una caja", // [CHECK]
  "privacy.alerts.body1": "Guardamos tu correo electrónico solo si tú lo pides: cuando te suscribes a alertas de una caja de bendición, o cuando solicitas adoptar una. Si eres anfitrión de una caja, el personal de Pueblo Food Map puede agregar tu correo, con tu autorización, para avisarte cuando tu caja esté vacía o tenga un problema. Usamos estas direcciones solo para enviar esos correos. Nunca las vendemos, las compartimos, ni las mostramos en el sitio.", // [CHECK]
  "privacy.alerts.body2": "Si adoptas una caja, el nombre que nos das (por ejemplo, el de un grupo o una familia) se muestra en la tarjeta de esa caja. Tu correo no.", // [CHECK]
  "privacy.alerts.body3": "Cada correo de alerta tiene un enlace para detenerlo. Un clic detiene los correos, sin necesidad de iniciar sesión. Para que eliminemos tu correo por completo, escribe a issues@pueblofoodmap.com.", // [CHECK]
  "privacy.alerts.body4": "Nuestros correos se envían a través de un servicio de correo llamado Resend, que solo maneja tu dirección para entregarlos.", // [CHECK]
  "privacy.analytics": "Usamos Cloudflare Web Analytics para contar visitas y medir qué tan rápido cargan las páginas. No usa cookies ni guarda nada en tu dispositivo, no te identifica por tu dirección IP ni por tu navegador, y no te sigue a otros sitios web. Registra datos como qué página se vio, el sitio desde el que llegaste, tu tipo de navegador y dispositivo, tu país y cuánto tardó en cargar la página. No usamos píxeles de publicidad ni ningún otro servicio de análisis.",

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
  // Turn-by-turn step list (#134 enhancement)
  "directions.showSteps": "Ver indicaciones",
  "directions.hideSteps": "Ocultar indicaciones",
  // #539 — see the EN dictionary's comment: separate key from showSteps/hideSteps.
  "directions.steps": "Pasos", // [CHECK]
  "directions.stepsListLabel": "Indicaciones paso a paso",
  // #537
  "directions.noStepsForRoute": "No hay indicaciones paso a paso para esta ruta",
  // Per-step distance suffixes
  "directions.stepFt": "{distance} pies",
  "directions.stepMi": "{distance} mi",
  // Google Maps walk handoff (#134 enhancement)
  "directions.openInGoogleMaps": "Abrir en Google Maps",
  "directions.openInGoogleMapsAria": "Abrir indicaciones a pie a {name} en Google Maps (se abre en una pestaña nueva)",

  // About page (#155) — BORRADOR de texto pendiente aprobación de Kyle / Pueblo Food Project
  "about.heading": "Acerca de Pueblo Food Map",
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

  // Venues directory (#PR4)
  "nav.venuesList": "Ver todos los lugares",
  "venues.heading": "Todos los recursos alimentarios",
  "venues.intro": "Cada despensa, supermercado, huerto comunitario, granja y comedor del mapa — agrupados por tipo, con direcciones y horarios.",
  "venues.noHours": "Horario no disponible",

  // Map-wide data freshness (board review finding #2)
  "freshness.updated": "Datos del mapa actualizados el {date}",

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
  "box.status": "Estado",
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
  "box.needs.drinks": "Agua / bebidas", // [CHECK]
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

  "box.photo.heading": "Foto", // [CHECK]
  "box.photo.caption": "Foto · {time}", // [CHECK]
  "box.photo.altText": "Foto de {name}, compartida {time}", // [CHECK]
  "box.photo.viewFullSize": "Ver foto en tamaño completo", // [CHECK]
  "box.photo.viewFullSizeAt": "Ver foto en tamaño completo · {time}", // [CHECK]
  "box.photo.report": "Reportar esta foto", // [CHECK]
  "box.photo.reporting": "Reportando…", // [CHECK]
  "box.photo.reportConfirm": "¿Ocultar esta foto y enviarla para revisión?", // [CHECK]
  "box.photo.reportThanks": "Gracias — esta foto se ha ocultado en espera de revisión.", // [CHECK]
  "box.photo.reportError": "Eso no se pudo enviar. Por favor intenta de nuevo.", // [CHECK]
  "box.photo.morePhotos": "Mostrar más fotos", // [CHECK]
  "box.photo.none": "Aún no hay fotos", // [CHECK]
  "box.photo.galleryHeading": "Fotos", // [CHECK]

  "box.history.link": "Historial", // [CHECK]
  "box.history.subheading": "Historial completo de esta caja", // [CHECK]

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
  "box.adopt.linkLabel": "Solicitar adoptar esta caja", // [CHECK]
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
  "email.adoptConfirm.subject": "Confirma tu solicitud para adoptar {box}", // [CHECK]
  "email.adoptConfirm.line1": "Gracias por solicitar adoptar {box}. Confirma tu correo para terminar tu solicitud.", // [CHECK]
  "email.adoptConfirm.line2": "Un administrador revisará tu solicitud una vez que confirmes.", // [CHECK]
  "email.adoptConfirm.cta": "Confirma tu correo: {url}", // [CHECK]
  "email.adoptConfirm.disclaimer": "Si tú no pediste esto, puedes ignorar este correo. No te escribiremos de nuevo a menos que alguien confirme.", // [CHECK]
  "email.adoptApproved.subject": "Fuiste aprobado para adoptar {box}", // [CHECK]
  "email.adoptApproved.line1": "Buenas noticias — tu solicitud para adoptar {box} como \"{displayName}\" fue aprobada.", // [CHECK]
  "email.adoptApproved.line2": "Tu nombre ahora aparecerá en la tarjeta de la caja, y recibirás un correo si se reporta vacía o con un problema.", // [CHECK]
  "email.alertConfirm.subject": "Confirma tus alertas para {box}", // [CHECK]
  "email.alertConfirm.line1": "Confirma que quieres recibir alertas por correo de {box}.", // [CHECK]
  "email.alertConfirm.line2": "Te avisaremos por correo si se reporta vacía o con poco surtido.", // [CHECK]
  "email.alertConfirm.cta": "Confirma tu correo: {url}", // [CHECK]
  "email.alertConfirm.disclaimer": "Si tú no pediste esto, puedes ignorar este correo. No te escribiremos de nuevo a menos que alguien confirme.", // [CHECK]
  "email.hostWelcome.subject": "Ahora recibirás alertas de {box}", // [CHECK]
  "email.hostWelcome.line1": "Se te agregó como contacto anfitrión de {box}.", // [CHECK]
  "email.hostWelcome.line2": "Recibirás un correo si se reporta vacía o con un problema.", // [CHECK]

  // Activity log (/boxes/activity, slice 3) and nav entry
  "nav.boxActivity": "Actividad de las cajas de bendiciones", // [CHECK]
  "activity.heading": "Actividad de las cajas de bendiciones", // [CHECK]
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
 * Strict lang resolution for the adopt/alert/host-alert routes (Blessing
 * Boxes slice 6, single-language alert emails) — same "anything other than
 * the one literal alternate value falls back to the default" convention
 * boxTurnstile.ts's resolveBoxTurnstileKey uses for its own two-value enum.
 * A client-supplied value is never trusted past this: "ES", "es-MX",
 * missing, or garbage all resolve to "en" rather than throwing or leaking
 * into a CHECK-constrained D1 column as anything but exactly "en"/"es".
 */
export function resolveEmailLang(raw: unknown): Locale {
  return raw === "es" ? "es" : "en";
}

/**
 * Exposed for test parity checks only, not runtime UI.
 * Key sets and placeholders must stay aligned between en and es when adding copy.
 */
export const I18N_DICTIONARIES = { en, es } as const;
