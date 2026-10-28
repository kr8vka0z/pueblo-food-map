/**
 * Tiny i18n shim. t(key, locale, vars) reads the visitor's language, falling
 * back to English for a missing key (defensive; the parity tests keep every
 * key in both languages).
 *
 * WHY three files (#723): the browser used to download every string in both
 * languages on every page. Now:
 *   - this file holds the English strings client components use;
 *   - i18n.es.ts holds their Spanish twins, which the browser loads only for
 *     a Spanish visitor (SpanishMessages.tsx on the /es tree, loadSpanish()
 *     when an English-tree visitor switches);
 *   - i18n.server.ts holds strings only server code uses (email, page
 *     metadata, hub pages, JSON-LD), in both languages.
 * On the server (and in tests) t() sees all of them synchronously, so a
 * server-rendered /es page is always fully Spanish. In the browser build the
 * server-only block below is dropped, imports and all.
 * Which keys are client keys is checked by src/__tests__/i18n.test.ts, which
 * walks the "use client" import graph (src/__tests__/helpers/clientI18nKeys.ts).
 */

/// <reference types="vite/client" />

export type Locale = "en" | "es";

const enClient: Record<string, string> = {
  // App
  "app.name": "Pueblo Food Map",
  // Homepage <title> (#589) — the ONE page whose SSR title isn't run through
  // layout.tsx's "%s · Pueblo Food Map" template (it equals the layout
  // default verbatim), so this holds the FULL string per locale rather than
  // a short title + pageDocumentTitle() suffix like every other page.
  "app.documentTitle": "Pueblo Food Map — Food Resources in Pueblo County, CO",

  // Per-page <title>/<meta description> for /, /about, /resources and
  // /venues. Both trees read these keys (the EN page.tsx with "en", the /es
  // thin wrapper with "es", #689 PR 2), the same way the SEO hub pages do,
  // so the two languages can't drift apart and the ES side gets the same
  // native-speaker [CHECK] review as every other locale-facing string.
  "meta.home.title": "Pueblo Food Map — Food Resources in Pueblo County, CO",
  "meta.home.description":
    "Find free and low-cost food near you in Pueblo County, CO — pantries, community gardens, grocery stores, and meal sites, with SNAP/WIC info and directions.",

  // Search
  "search.placeholder": "Search",
  "search.aria": "Search places",

  // Category labels (full)
  "category.full.pantry": "Food Pantry",
  "category.full.grocery": "Grocery / Supermarket",
  "category.full.convenience": "Convenience Store",
  "category.full.farm": "Farm / Market",
  "category.full.garden": "Community Garden",
  "category.full.edible_landscape": "Edible Landscape",
  "category.full.meal_site": "Meal Site",
  "category.full.blessing_box": "Blessing Box",

  // Filters
  "filter.openNow": "Open now",
  "filter.snap": "Accepts SNAP",
  "filter.wic": "Accepts WIC",

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
  "sheet.sortedBy": "Sorted by distance",

  // Venue detail
  "detail.close": "Close",
  "detail.getDirections": "Get directions",
  // "View on the map" CTA on /venue/[id] — was a hardcoded English string
  // (pueblo-food-map#bilingual-static-pages) since that page never read locale.
  "detail.viewOnMap": "View on the map",
  "detail.hours": "HOURS",
  "detail.contact": "CONTACT",
  "detail.about": "ABOUT",
  "detail.sources": "SOURCES & DATA",
  "detail.acceptsSnap": "Accepts SNAP",
  "detail.acceptsWic": "Accepts WIC",
  "detail.plentifulLink": "See hours, eligibility & what to bring on Plentiful",
  "detail.today": "Today",
  "detail.showDetails": "Show details",
  "detail.hideDetails": "Hide details",
  "detail.venueDetailsPanel": "Place details panel",
  "detail.venueDetails": "place details",

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

  // Irregular (monthly-ordinal etc.) schedules (#400)
  "hours.irregular.next": "Next: {when}",
  "hours.irregular.monthlyOrdinal": "{ordinal} {weekday} of each month, {slots}",
  "hours.irregular.monthlyDate": "The {day} of each month, {slots}",
  "hours.irregular.heading": "Monthly",
  "hours.irregular.ordinal.1": "1st",
  "hours.irregular.ordinal.2": "2nd",
  "hours.irregular.ordinal.3": "3rd",
  "hours.irregular.ordinal.4": "4th",
  "hours.irregular.ordinal.5": "5th",
  "hours.irregular.ordinal.last": "Last",

  // Empty state (PR 3)
  "empty.title": "No places match your filters.",
  "empty.clear": "Clear filters",
  "empty.noMatches": "No matches for \"{query}\"",
  "empty.tryCategoryInstead": "Try a category instead:",
  "empty.showCategoryAria": "Show {label} places",

  // Sponsor credit (#69)

  // Operator attribution (#63)
  "operator.operated_by": "Operated by",

  // Splash page (#68, #100)
  "splash.purpose": "A free, community-built map of food resources across Pueblo County.",
  "splash.cta.primary": "Find food near me",
  "splash.microcopy": "We only use your location to show food nearby. Nothing is saved.",
  // Guided tour triggers (#159). The tour's own step copy lives in
  // src/lib/guidedTour.ts (lazy-loaded with the tour, see its header).
  "splash.tour": "Take a tour",

  // Location help card (#739; replaces the #68 denied banner). Body = a
  // reason-specific lead sentence + locationCard.tapPin. "See all places as a
  // list" reuses viewSuggestion.seeAsList; close reuses detail.close.
  "locationCard.denied.title": "Location is off",
  "locationCard.denied.body": "No problem, you can still find food.",
  "locationCard.denied.hint": "To use your location next time, turn it on in your browser or phone settings.",
  "locationCard.failed.title": "We couldn't find you",
  "locationCard.failed.body.timeout": "Your phone took too long to find where you are. This happens a lot indoors.",
  "locationCard.failed.body.unavailable": "Your phone couldn't work out where you are right now.",
  "locationCard.tapPin": "Tap any pin on the map to see hours and directions.",
  "locationCard.retry": "Try again",

  // Wordmark (#61)
  "wordmark.ariaLabel": "Pueblo Food Map — reset map view",

  // Search typeahead (#67)
  "typeahead.matchCount": "{count} places match",
  "typeahead.moreMatches": "+{count} more matches",

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
  // Desktop side panel (#682) — link back to the Saved list from a venue card
  // opened by clicking a saved place, so the user doesn't lose their spot.
  "panel.backToSaved": "← Saved",

  // Hamburger menu (#71, #96, #99, #109)
  "menu.open": "Open menu",
  "menu.close": "Close menu",
  "menu.title": "Pueblo Food Map",
  "menu.suggest": "Suggest a place",
  "menu.sponsoredBy": "Sponsored by",
  // Donate card (#736). Never "sponsor" here: on this site that word means
  // adopting a blessing box. No tax claim; PFP's own page covers that.
  "menu.donate": "Donate",
  "menu.donateSub": "Supports this map and Pueblo Food Project's other work",
  // Agency credit (StyxCredit.tsx) — followed by the linked name "The Styx Group".
  "credit.builtBy": "Designed, built and managed by",
  "menu.showWelcome": "Show welcome screen",
  "menu.tour": "Learn how to use this map",
  "menu.language": "Language / Idioma",
  // #689 PR 2, design decision 2 / Kyle's 2026-09-28 decision 2: shown in the
  // Menu, below the toggle, ONLY when a visitor is on the EN tree (`/`) with
  // an `es` locale cookie — offers the fully-Spanish /es tree (Spanish
  // <title>, hreflang, JSON-LD) without ever auto-navigating there. Same
  // text in both dicts on purpose: it's inherently Spanish-facing UI (only
  // ever rendered for an ES-locale visitor), not a translatable EN string.
  "menu.verEnEspanol": "Ver en español →",

  // Map/List entry point (#514) — top of the Menu, for anyone who never taps
  // search. Reads the OPPOSITE of the current view (the destination, same
  // convention as viewSuggestion.* above). Hidden entirely while the map
  // can't mount (#165) rather than shown disabled — see HamburgerMenu.tsx.
  "menu.listView": "List view",
  "menu.mapView": "Map view",

  // Suggest form (#71)
  "suggest.title": "Suggest a place",
  "suggest.subtitle": "Know a food resource we're missing? Tell us about it.",
  // <title> for /suggest (#589) — matches page.tsx's metadata title exactly
  // ("Suggest a Place"); kept distinct from suggest.title (the on-page h1,
  // "Suggest a place") since the two strings differ only in casing and a
  // shared key would force one to drift to match the other.
  "suggest.documentTitle": "Suggest a Place",
  "suggest.venueName.label": "Place name",
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
  "suggest.success.body": "Your suggestion has been submitted. We review all suggestions and will add verified places to the map.",
  "suggest.error.title": "Something went wrong",
  "suggest.error.body": "Your suggestion couldn't be sent. Please try again, or email us directly at suggestions@pueblofoodmap.com.",
  "suggest.error.retry": "Try again",
  "suggest.validation.nameRequired": "Please enter a place name.",
  "suggest.validation.addressRequired": "Please enter an address.",
  "suggest.validation.categoryRequired": "Please select a category.",
  "suggest.validation.emailRequired": "Please enter your email address.",
  "suggest.validation.emailInvalid": "Please enter a valid email address.",
  "suggest.error.rateLimit": "Too many submissions from this address. Please try again in an hour.",

  // Hamburger menu — feedback item (#116)
  "menu.feedback": "Send us feedback",

  // Feedback form (#116)
  "feedback.title": "Send us feedback",
  // <title> for /feedback (#589) — matches page.tsx's metadata title
  // exactly ("Send Feedback"); distinct from feedback.title, the on-page h1.
  "feedback.documentTitle": "Send Feedback",
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
  "report.button": "Report an issue with this place",
  "report.title": "Report an issue",
  "report.subtitle": "Help us keep this information accurate.",
  "report.venueLabel": "Place",
  "report.issueType.label": "What's wrong?",
  "report.issueType.placeholder": "Select an issue type",
  "report.issueType.location": "Location is wrong (wrong address or pin position)",
  "report.issueType.hours": "Hours are wrong or out of date",
  "report.issueType.contact": "Contact info (phone / email / URL) is wrong",
  "report.issueType.closed": "Place has closed permanently",
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

  // Special-event map pins (#758). {time} is a Pueblo-time clock like "2 PM".
  "events.pin.today": "Today",
  "events.pin.nowUntil": "NOW, until {time}",
  "events.pin.ariaLive": "{name}, special event, happening now, until {time}",
  "events.pin.ariaUpcoming": "{name}, special event, {day} {time}",

  // Special-event card (#759). {n} is a whole number; "one" is the n === 1 form.
  "events.card.startsIn.min.one": "Starts in {n} min",
  "events.card.startsIn.min.other": "Starts in {n} min",
  "events.card.startsIn.hour.one": "Starts in {n} hour",
  "events.card.startsIn.hour.other": "Starts in {n} hours",
  "events.card.startsIn.day.one": "Starts in {n} day",
  "events.card.startsIn.day.other": "Starts in {n} days",
  "events.card.endsIn.min.one": "{n} min",
  "events.card.endsIn.min.other": "{n} min",
  "events.card.endsIn.hour.one": "{n} hour",
  "events.card.endsIn.hour.other": "{n} hours",
  "events.card.endsIn.day.one": "{n} day",
  "events.card.endsIn.day.other": "{n} days",
  "events.card.liveEndsIn": "Happening now, ends in {remaining}",
  "events.card.startsOn": "Starts {date}",
  "events.card.ended": "This event has ended",
  "events.card.cancelled": "Cancelled",
  "events.card.hostedBy": "Hosted by {host}",
  "events.card.when": "When",
  "events.card.where": "Where",
  "events.card.about": "About",
  "events.card.bring": "What to bring",
  "events.card.directions": "Get directions",
  "events.card.directionsAria": "Get directions to {name} (opens in a new tab)",
  "events.card.share": "Share",
  "events.card.shareCopied": "Link copied",
  "events.card.shareManual": "Sharing isn't available here. Copy this link:",
  "events.card.calendar": "Add to calendar",
  "events.card.moreInfo": "More information",
  "events.card.seeOpenNow": "See places open now",
  "events.card.endedHelp": "Looking for food today? See what is open right now.",
  "events.card.cancelledNoNote": "This event will not take place.",
  "events.card.closeAria": "Close event details",
  "events.here.now": "Event here now",
  "events.here.today": "Event here today",
  "events.here.day": "Event here {day}",

  // "Happening today" strip, Events filter and list (#761). {time} is a Pueblo-time
  // clock like "2 PM" (strip.today: a range like "2 PM – 4 PM").
  "events.strip.liveUntil": "Happening now, until {time}",
  "events.strip.today": "Today {time}",
  "events.strip.more": "and {count} more",
  "events.strip.moreAria": "and {count} more, show the events list",
  "events.strip.dismissAria": "Hide {name} for today",
  "events.list.heading": "Events",
  "events.list.empty": "No events coming up",
  "events.filter.label": "Events",
  "events.filter.showResults.one": "Show {count} event",
  "events.filter.showResults.other": "Show {count} events",
  "events.list.emptyAction": "Show places again",

  // External links (#162)
  "menu.opensInNewTab": "(opens in new tab)",

  // Map loading fallback — shown while dynamic import resolves (#i18n-leaks)
  "map.loading": "Loading map…",

  // Map unavailable fallback — shown when WebGL/Mapbox cannot initialize (#165)
  "map.unavailableTitle": "Map unavailable",
  "map.unavailableBody": "The interactive map can't load on this device, so we're showing the list instead.",

  // Offline fallback — the page opened with no connection, so Mapbox can't load (#130)
  "map.offlineTitle": "Map needs a connection",
  "map.offlineBody": "The list still works.",

  // LanguageToggle group aria-label (#i18n-leaks)
  "lang.toggle.label": "Language selection",

  // SuggestForm SNAP/WIC fieldset legend — WCAG 1.3.1 (#i18n-leaks)
  "suggest.benefits.legend": "Accepted benefits",

  // Privacy disclosure (#160 1.7) — shown near email fields on all 3 forms
  // and on the /privacy page. One sentence that fits below an email input.
  "privacy.emailDisclosure": "Your email is used only to follow up on your submission. It is never sold or shared.",
  "privacy.linkLabel": "Privacy",
  "privacy.heading": "Privacy",
  // Rewrite (slice 6, Blessing Boxes adopt-a-box + alerts): the old, single
  // un-headed "privacy.body" paragraph is REPLACED by "What we collect"
  // below (privacy.collect.*), plus two new headed sections — one paragraph
  // per i18n key, per the task's own instruction ("not overloading
  // privacy.body"). privacy.analytics (below) was unchanged wording at the
  // time this comment was written; it was rewritten again for #485 (PostHog
  // added alongside Cloudflare Web Analytics — see that key's own comment).
  "privacy.collect.heading": "What we collect",
  "privacy.collect.body": "Pueblo Food Map collects the information you type into our forms (place reports, suggestions, and feedback). We use it to review what you sent and, if you gave an email address, to write back. Your IP address is checked to block spam when you send a form, and is never saved with what you sent. Sign-ins to the site's admin area, used by the Pueblo Food Map team, are logged with the time, device and IP address, for security.",
  "privacy.checkins.heading": "Blessing box check-ins",
  "privacy.checkins.body": "Checking in at a blessing box is anonymous. We do not ask for your name or email, and we do not save your IP address. A photo you add is reviewed before it shows, and location details hidden inside the photo file are removed.",
  // New paragraph (#594) — the per-browser check-in rate-limit ID
  // (src/lib/checkinClientToken.ts) was never disclosed on this page.
  "privacy.checkins.body2": "Each check-in also uses a random ID your browser saves, so we can tell repeat check-ins apart without asking for your name or email. It isn't tied to who you are, and clearing your browser's site data starts a new one.",
  "privacy.alerts.heading": "Email alerts and sponsoring a box",
  "privacy.alerts.body1": "We keep your email address only if you ask for it: when you sign up for emails about a blessing box, or when you apply to sponsor one. If you host a box, Pueblo Food Map staff may add your email, with your OK, so you hear when your box is empty or has a problem. We use these addresses only to send those emails. We never sell them, share them, or show them on the site.",
  "privacy.alerts.body2": "If you sponsor a box, the name you give us (for example, a group or family name) is shown on that box's card. Your email is not.",
  "privacy.alerts.body3": "Every alert email has a stop link. One click stops the emails, with no login. To have your email address deleted completely, write to issues@pueblofoodmap.com.",
  "privacy.alerts.body4": "Our emails are delivered by a mail service called Resend, which handles your address only to deliver them.",
  // New section (#594, security review finding #4) — states the 90-day
  // retention period the daily cron (src/lib/emailRetention.ts) enforces.
  "privacy.retention.heading": "How long we keep it",
  "privacy.retention.body": "We remove old email addresses from our records automatically: 90 days after a place suggestion or report is submitted, a box-sponsorship application is turned down, or an alert subscription is stopped. This doesn't affect the copy already sent to our own inbox when you submitted a form, or an internal log admins use to track moderation decisions. An active alert subscription's email stays until you stop it.",
  // New section (#594) — names the third parties the existing copy above
  // described without naming (Turnstile) or didn't mention at all (Mapbox).
  "privacy.other.heading": "Other services we use",
  "privacy.other.body": "We use Mapbox to show the map. Loading it shares your IP address with Mapbox, and if you get walking directions, your location too. We use Cloudflare Turnstile on our forms and box check-ins to block spam; it checks some information about your device and browser.",
  // Rewritten (#485, PostHog analytics core): PostHog joins Cloudflare Web
  // Analytics (which stays on as an independent visit count — AGENTS.md
  // "Observability"). PostHog's memory-only persistence (analytics.ts) and
  // "Discard client IP data" project setting keep two of this page's
  // promises (no cookies/nothing stored, IP discarded); this paragraph is
  // rewritten to also disclose the new
  // named taps/search tracking (#485 comment, 2026-09-26) truthfully.
  // Session replay (screen-recording of how a page was used) was turned
  // back ON (Kyle, 2026-09-26, reversing the issue's original "replay OFF")
  // after seeing the #681 admin dashboard mockup — this paragraph discloses
  // it, and that everything typed is hidden from it (analytics.ts's
  // session_recording.maskAllInputs).
  "privacy.analytics": "We use PostHog and Cloudflare Web Analytics to see how people use the map: which pages are viewed, taps on the map and its filters, the words people search for (only searches used often are ever looked at, never a single search — this helps us find places we're missing), and a recording of on-screen activity to help us improve the site. Anything you type is always hidden from that recording. Neither service sets a cookie or stores anything on your device, and your exact IP address is thrown away before it's used for anything. We never see what you type into a form, your exact location, or who you are.",

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
  // Turn-by-turn step list (#134 enhancement). showSteps/hideSteps (the
  // in-card Show/Hide toggle) retired 2026-09-20 (#555) — WalkStepper
  // replaced the toggle+full-list with the one-turn-at-a-time stepper below.
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
  // Step-through stepper (#555) — "Step N of M" counter, the muted
  // distance/arrival line, the "Then: <next>" peek, Back/Next aria-labels,
  // and the "All turns" disclosure that reuses WalkStepsList.
  "directions.stepCounter": "Step {current} of {total}",
  "directions.stepIn": "In {distance}",
  "directions.stepArrived": "You have arrived",
  "directions.stepThen": "Then: {instruction}",
  "directions.stepBack": "Previous turn",
  "directions.stepNext": "Next turn",
  "directions.allTurns": "All turns",
  "directions.fewerTurns": "Fewer turns",
  // Google Maps walk handoff (#134 enhancement)
  "directions.openInGoogleMaps": "Open in Google Maps",
  "directions.openInGoogleMapsAria": "Open walking directions to {name} in Google Maps (opens in new tab)",

  // About page (#155) — DRAFT copy pending final text from Kyle / Pueblo Food Project
  "about.heading": "About Pueblo Food Map",
  // <title> for /about (#589) — matches page.tsx's metadata title exactly
  // ("About"); distinct from about.heading, the longer on-page h1.
  "about.documentTitle": "About",
  "about.mission.heading": "Our mission",
  "about.mission.body": "Pueblo Food Map puts every free and low-cost food resource in Pueblo County on one mobile-friendly map — so anyone, in any neighborhood, can find what they need in minutes.",
  "about.vision.heading": "Our vision",
  "about.vision.body": "A Pueblo County where no one goes hungry because they couldn't find the resources already available in their community.",
  "about.origin.heading": "How it started",
  "about.origin.body": "Finding food assistance in Pueblo meant juggling separate tools — the Pueblo Food Project site, Plentiful, FoodFinder, Pueblo Transit, and 211. Pueblo Food Map consolidates those sources into a single, bilingual map that works on any smartphone, no app install required.",
  "about.howWeSource.heading": "How places are added",
  "about.howWeSource.body": "Place data comes from Pueblo Food Project, OpenStreetMap, Plentiful's public directory, and USDA benefit data. All listings are reviewed before going live. If you know of a resource we're missing, please suggest it.",
  "about.contact.body": "Questions or partnership ideas? Email",
  "about.suggest.heading": "Know something we're missing?",
  "about.suggest.body": "If you know of a food pantry, community garden, or other resource that isn't on the map yet, let us know.",
  "about.suggest.cta": "Suggest a place",

  // Nav and footer shared strings (#155)
  "nav.about": "About this map",
  "footer.backToMap": "Back to map",
  "footer.about": "About",
  "footer.privacy": "Privacy",
  "footer.suggest": "Suggest a place",
  // SEO/AEO plan Phase 0: the footer is how crawlers reach /venues (and from
  // there every venue page) — before this, no page's server HTML linked it.
  "footer.venues": "All places",
  "footer.resources": "Food help programs",
  // Venue-page breadcrumb (SEO/AEO plan Phase 0): "Map › All places › {name}".
  "breadcrumb.label": "Breadcrumb",
  "breadcrumb.map": "Map",

  // Venues directory (#PR4)
  "nav.venuesList": "Browse all places",
  "venues.heading": "All food resources",
  // <title> for /venues (#589) — matches page.tsx's metadata title exactly
  // ("All Food Resources"); distinct from venues.heading, the on-page h1.
  "venues.documentTitle": "All Food Resources",
  "venues.intro": "Every pantry, grocery store, community garden, farm, and meal site on the map — grouped by type, with addresses and hours.",
  "venues.noHours": "Hours not listed",

  // Map-wide data freshness (board review finding #2) — surfaced in ListView
  // and /about so users can judge how current the whole map is, not just one
  // venue's own last_verified date.
  "freshness.updated": "Map data updated {date}",

  // OSM attribution (#133 4.5) — ODbL credit for pages that show OSM-derived
  // venue data without Mapbox's own attribution control (src/lib/osmAttribution.ts).
  "osm.attribution": "Place data includes © OpenStreetMap contributors",

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
  // <title> for the 404 page (#589) — matches not-found.tsx's metadata
  // title exactly ("Page Not Found"); distinct from notfound.title, the
  // on-page h1, which uses sentence case instead.
  "notfound.documentTitle": "Page Not Found",
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
  "box.needs.drinks": "Drinks",
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

  // "box.recentCheckin.heading"/"box.recentCheckin.none" deleted (card
  // redesign, 2026-09-19) — the standalone "Most recent check-in" line is
  // gone; the status pill now carries recency (box.lastFilled above), and
  // the full timeline still lives at /box/<id>/history via the link below.
  // "History" link on the card -> /box/<id>/history (map-first rework)
  "box.history.link": "History",
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
  "box.adopt.linkLabel": "Apply to sponsor this box",
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
  "email.adoptConfirm.subject": "Confirm your application to sponsor {box}",
  "email.adoptConfirm.line1": "Thanks for applying to sponsor {box}. Please confirm your email to finish your application.",
  "email.adoptConfirm.line2": "An admin will review your application once you've confirmed.",
  "email.adoptConfirm.cta": "Confirm your email: {url}",
  // 2026-09-18 security review, item 7: an "if you didn't ask for this"
  // line on every confirm email — someone else could have typed this
  // address in by mistake (or on purpose), and this line tells them
  // exactly what happens if they do nothing (nothing).
  "email.adoptConfirm.disclaimer": "If you didn't ask for this, you can ignore this email. We won't write again unless someone confirms.",

  // Activity log (/boxes/activity, slice 3) and nav entry
  "nav.boxActivity": "Blessing box activity",
  "activity.heading": "Blessing box activity",
  // <title> for /boxes/activity (#589) — matches page.tsx's metadata title
  // exactly ("Blessing Box Activity"); distinct from activity.heading, the
  // on-page h1, which uses sentence case instead.
  "activity.documentTitle": "Blessing Box Activity",
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

  // Answer-first venue summary (SEO/AEO plan Phase 2, #704) — assembled by
  // src/lib/venueSummary.ts from verified fields only. "what" phrases carry
  // "free" ONLY for the 4 free categories (venueSummary.ts's FREE_CATEGORIES)
  // — the single source of truth the truth-rule tests check.
  "summary.what.pantry": "a free food pantry",
  "summary.what.meal_site": "a free meal site",
  "summary.what.garden": "a free community garden",
  "summary.what.edible_landscape": "a free edible landscape",
  "summary.what.grocery": "a grocery store",
  "summary.what.convenience": "a convenience store",
  "summary.what.farm": "a farm and market",
  "summary.mainSentence": "{name} is {what} at {address}.",
  // Used instead of summary.mainSentence when the street address is either
  // the OSM placeholder (PLACEHOLDER_ADDRESS, venueSummary.ts) or
  // deliberately omitted (VenueContent's on-page paragraph — the address is
  // already shown just above it in the header).
  "summary.mainSentenceNoAddress": "{name} is {what} in {city}, CO.",
  // Gender-neutral hours prefix (review fix — "Está abierto" disagreed with
  // some "what" phrases' Spanish gender; "Horario" needs no agreement).
  // Used for BOTH weekly and monthly/irregular schedules, joined into one
  // sentence — see venueSummary.ts buildHoursSentence.
  "summary.hours": "Hours: {schedule}.",
  // Weekly day-group phrases (venueSummary.ts formatWeeklyGroup) — distinct
  // from the short "day.mon" abbreviations (HoursList's table) and from
  // "summary.day.full.*" below (the singular form a range wraps).
  "summary.day.mon": "Mondays",
  "summary.day.tue": "Tuesdays",
  "summary.day.wed": "Wednesdays",
  "summary.day.thu": "Thursdays",
  "summary.day.fri": "Fridays",
  "summary.day.sat": "Saturdays",
  "summary.day.sun": "Sundays",
  "summary.day.everyDay": "every day",
  "summary.day.range": "{start} to {end}",
  "summary.day.full.mon": "Monday",
  "summary.day.full.tue": "Tuesday",
  "summary.day.full.wed": "Wednesday",
  "summary.day.full.thu": "Thursday",
  "summary.day.full.fri": "Friday",
  "summary.day.full.sat": "Saturday",
  "summary.day.full.sun": "Sunday",
  // A group that's literally every day of the week AND every day is the
  // same 24-hour slot gets this fixed phrase instead of the general
  // "{dayPhrase}, {timesLabel}" template — "Open 24 hours, every day" reads
  // like a person would say it; "every day, Open 24 hours" doesn't.
  "summary.hours.open24EveryDay": "Open 24 hours, every day",
  // Monthly (irregular) schedule prose — summary-only, distinct from
  // hours.ts's own hours.irregular.monthlyOrdinal/monthlyDate keys (shared
  // with the page's separate Hours section, which also renders the admin
  // `note` field this summary sentence deliberately never reads).
  "summary.hours.monthlyOrdinal": "the {ordinal} {weekdayFull} of each month",
  "summary.hours.monthlyDate": "the {day} of each month",
  // Lowercase mid-sentence "last" (see hours.irregular.ordinal.last for the
  // capitalized UI-label version this is deliberately NOT reused from).
  "summary.ordinal.last": "last",
  "summary.snap": "It accepts SNAP/EBT.",
  "summary.wic": "It accepts WIC.",
  "summary.snapAndWic": "It accepts SNAP/EBT and WIC.",
  "summary.lastVerified": "Last verified {month}.",
  "summary.and": "and",
  "summary.title.in": "in",
  // Short, natural NOUN phrases for the title's 2nd (shortened) rung —
  // distinct from the filter-chip labels ("category.*"), which read oddly
  // stripped of their chip context ("Corner Store – Convenience in...").
  "summary.title.category.pantry": "Pantry",
  "summary.title.category.grocery": "Grocery Store",
  "summary.title.category.convenience": "Store",
  "summary.title.category.farm": "Farm Stand",
  "summary.title.category.garden": "Garden",
  "summary.title.category.edible_landscape": "Edible Landscape",
  "summary.title.category.meal_site": "Meal Site",
  // Title/summary fallback when a venue's address has no parseable city
  // (issue #704 Decisions: "if the city can't be parsed, use 'Pueblo
  // County'").
  "summary.cityFallback": "Pueblo County",
  // VenueContent's Nearby section heading.
  "detail.nearby": "Nearby",
  // Nearby list's per-item distance suffix — deliberately NOT
  // distance.fromYou ("from you"), which reads as distance from the
  // visitor; a Nearby entry's distance is from THIS venue, not the visitor.
  "detail.nearby.away": "{miles} away",
  // Localizes formatSlot()'s (hours.ts) English-only "Open 24 hours"
  // literal for the summary sentence only — see venueSummary.ts's own
  // localizedSlot() comment for why hours.ts itself stays English there.
  "hours.open24": "Open 24 hours",
  "month.1": "January",
  "month.2": "February",
  "month.3": "March",
  "month.4": "April",
  "month.5": "May",
  "month.6": "June",
  "month.7": "July",
  "month.8": "August",
  "month.9": "September",
  "month.10": "October",
  "month.11": "November",
  "month.12": "December",
  // Short link labels: footer, /venues "Browse by topic" list.
  "footer.foodPantries": "Food pantries",
  "footer.snapWic": "SNAP and WIC stores",
  "footer.gardens": "Community gardens",
  "venues.browseTopics": "Browse by topic",
  // "list" on purpose: bare "Blessing boxes" is also the box.stats.boxCount label, and the footer renders on that page (exact-text test queries collide).
  "footer.boxes": "Blessing box list",
  // /resources FAQ (#709). Sources and fetch dates: src/lib/resourcesFaq.ts.
  "resources.faq.heading": "Common questions",
  "resources.faq.q1": "How do I apply for SNAP in Pueblo County?",
  "resources.faq.a1": "You can apply online with Colorado PEAK or the MyCOBenefits app, or fill out a paper application and return it to your county human services office. The county decides who qualifies, based on income, resources and household size. The Food Resource Hotline at 855-855-4626 can help you apply by phone.",
  "resources.faq.q2": "How do I apply for WIC?",
  "resources.faq.a2": "Call your local WIC clinic to make an appointment, or fill out the online sign-up form at coloradowicsignup.com and a WIC staff member will contact you within 10 days. When you make your appointment, the clinic can tell you which documents to bring.",
  "resources.faq.q3": "What should I bring to a food pantry?",
  "resources.faq.a3": "It depends on the pantry, because each one sets its own requirements. Check the place's page on this map for hours and details, and call ahead if a phone number is listed. The Food Resource Hotline at 855-855-4626 can also point you to pantries near you.",
  "resources.faq.q4": "Where can I get emergency food today?",
  "resources.faq.a4": "Dial 2-1-1 or (866) 760-6489, or text your ZIP code to 898-211, and ask about emergency food near you. The Food Resource Hotline at 855-855-4626 (Monday to Thursday 8:30 a.m. to 4:30 p.m., Friday 8 a.m. to noon) can connect you with food pantries and free meal sites. You can also look at the food pantries on this map and check their hours before you go.",
};

// Spanish that English pages show too, through a literal t(key, "es"): the
// splash's second button and the menu's link to the /es pages. Kept in every
// bundle so they never fall back to English before i18n.es.ts loads (a
// fallback there also broke hydration). i18n.test.ts checks the list.
export const ES_ON_EVERY_PAGE: Record<string, string> = {
  "splash.cta.primary": "Encuentra comida cerca de mí",
  "menu.verEnEspanol": "Ver en español →",
};

let en: Record<string, string> = enClient;
// Browser: null until Spanish is loaded (see the file header).
let es: Record<string, string> | null = null;

// The condition is replaced at build time: true in the server builds (RSC
// and SSR) and in vitest, false in the browser build, where the whole block,
// imports included, is dropped. Imported here rather than at the top: a
// top-level import, even unused, made the bundler put the Spanish strings
// in the chunk every page loads.
if (import.meta.env.SSR || import.meta.env.MODE === "test") {
  const [{ default: esClient }, { serverEn, serverEs }] = await Promise.all([
    import("@/lib/i18n.es"),
    import("@/lib/i18n.server"),
  ]);
  en = { ...enClient, ...serverEn };
  es = { ...ES_ON_EVERY_PAGE, ...esClient, ...serverEs };
}

/** True once t() can answer in Spanish. */
export function hasSpanish(): boolean {
  return es !== null;
}

/** Registers the Spanish client strings (SpanishMessages.tsx, loadSpanish()). */
export function setSpanish(dict: Record<string, string>): void {
  es ??= { ...ES_ON_EVERY_PAGE, ...dict };
}

/** Loads the Spanish strings in the browser; resolves at once if already there. */
export async function loadSpanish(): Promise<void> {
  if (es) return;
  setSpanish((await import("@/lib/i18n.es")).default);
}

/** Test-only: forget the Spanish strings, as a fresh English-tree page has. */
export function _unloadSpanishForTest(): void {
  es = null;
}


/** Substitute simple {key} placeholders. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function t(
  key: string,
  locale: Locale = "en",
  vars?: Record<string, string>,
): string {
  const dict = locale === "es" ? (es ?? ES_ON_EVERY_PAGE) : en;
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
 * Exposed for test parity checks only, not runtime UI: every key (client and
 * server) in each language. Key sets and placeholders must stay aligned
 * between en and es when adding copy.
 */
export const I18N_DICTIONARIES = { en, es: es ?? {} } as const;
