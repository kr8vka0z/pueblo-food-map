// Design system: Patterns. Jobs that come up on many pages and use several components together, in the design
// skill's Pattern template: status tag; when it applies; the screens it covers; numbered steps or layout; the exact
// words (English, Spanish, where they show); one Don't. Built from the approved Components entries, which each
// pattern links to. Every message is copied from src/lib/i18n.ts, i18n.es.ts or the component that holds it; a
// live message that breaks a wording ruling is shown as it is and flagged. Made-up data only.
// CSS: mock.css block "patterns-brand" (classes pb-), plus the admin block's pa- classes for the on-page confirm.
import { dodont, dsSec, toc, type Page, type Status } from "../lib";

/** One row of the words table: the live words, their Spanish twin ("" for admin, English only), where they show,
 *  and an optional flag naming the wording ruling they break. */
type W = [en: string, es: string, where: string, flag?: string];
const flag = (f: string) => `<span class="pb-flag">Breaks a ruling: ${f}</span>`;
const words = (rows: W[]) => `<table class="pb-words"><thead><tr><th>Words</th><th>Where they show</th></tr></thead><tbody>${rows
  .map(([en, es, where, f]) => `<tr><td><b>“${en}”</b>${es ? `<span class="es">Spanish: “${es}”</span>` : ""}${f ? flag(f) : ""}</td><td>${where}</td></tr>`)
  .join("")}</tbody></table>`;

function pat(o: {
  id: string; name: string; status: Status; statusNote?: string; when: string; screens: string[]; steps: string[];
  words: W[]; wordsNote?: string; example?: string; dont: [string, string]; doIt: [string, string]; see: [string, string][];
}) {
  return dsSec({
    id: o.id, name: o.name, status: o.status, note: o.statusNote, purpose: o.when,
    body: `<h3>The screens it covers</h3><ul>${o.screens.map((s) => `<li>${s}</li>`).join("")}</ul>
  <h3>How it works</h3><ol class="frules">${o.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
  ${o.example ? `<h3>What it looks like</h3><div class="pex pb-ex">${o.example}</div>` : ""}
  <h3>The exact words</h3>${o.wordsNote ? `<p class="pb-wnote">${o.wordsNote}</p>` : ""}${words(o.words)}
  <h3>Do and don't</h3>${dodont(o.doIt, o.dont)}
  <h3>Built from</h3><ul class="pb-see">${o.see.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul>`,
  });
}

// Small flat pictures, in the site's own colors (mock.css "patterns-brand"). The map is a flat block, never tiles.
const back = `<div class="pb-pnav"><span>← Back to map</span></div>`;
const orange = (t: string) => `<span class="pb-or">${t}</span>`;
const sage = (t: string, cls = "") => `<span class="pb-sg${cls ? ` ${cls}` : ""}">${t}</span>`;
const outline = (t: string) => `<span class="pb-ol">${t}</span>`;
const field = (label: string, value = "", err = "") => `<div class="pb-f${err ? " err" : ""}"><span class="l">${label}</span><span class="b">${value}</span>${err ? `<span class="e">${err}</span>` : ""}</div>`;
const bar = `<div class="pb-bnav">${["Near me", "Saved", "Boxes", "Help", "Menu"].map((w) => `<span>${w}</span>`).join("")}</div>`;

// ── Page layout: public ─────────────────────────────────────────────────────────────────────────────────────
const publicLayout = pat({
  id: "public-layout", name: "Page layout: public pages", status: "built",
  when: "Every page the Menu opens is laid out the same way, so a visitor always knows the way back to the map.",
  screens: ["About this map, All places, Food help programs, Privacy", "The hub pages: Food pantries, Blessing boxes, Community gardens, SNAP and WIC stores", "The four forms: Suggest a place, Send us feedback, Report an issue, Share an event", "The same pages in Spanish, under /es"],
  steps: [
    "<b>Top bar:</b> one link, Back to map. Nothing else sits in it.",
    "<b>Title</b> in Fraunces. On a form page, one line under it says what the form is for (kept: the no-subtitle ruling is for the admin only).",
    "<b>One column</b> in the middle, 512 pixels wide at most, on the cream bone 50 paper. No sidebar, no pictures.",
    "<b>The content:</b> short sections with plain headings, lists of places, questions and answers.",
    "<b>Site footer</b> with the page links, then the same bottom bar as the map floating at the foot, so Saved and Menu open right over the page.",
  ],
  example: `<div class="pb-phone">${back}<div class="pb-pg"><b class="pb-h1">Suggest a place</b><p class="pb-lead">Know a food resource we're missing? Tell us about it.</p>${field("Place name *")}${field("Address *")}${sage("Submit suggestion", "w")}</div>${bar}</div>`,
  words: [
    ["Back to map", "Volver al mapa", "The top bar of every inside page (i18n.ts:661)"],
    ["Know a food resource we're missing? Tell us about it.", "¿Conoces un recurso alimentario que nos falta? Cuéntanos.", "The line under Suggest a place (i18n.ts:230)"],
    ["Compliments, bug reports, or feature ideas — we want to hear it.", "Felicitaciones, reportes de problemas o ideas — queremos escucharte.", "The line under Send us feedback (i18n.ts:285)", "long dash, in both languages"],
    ["Help us keep this information accurate.", "Ayúdanos a mantener esta información actualizada.", "The line under Report an issue (i18n.ts:336)"],
  ],
  doIt: [`<div class="pb-phone sm">${back}<div class="pb-pg"><b class="pb-h1">About this map</b><p class="pb-body">One column, one way back.</p></div></div>`, "One way back to the map, at the top."],
  dont: [`<div class="pb-phone sm"><div class="pb-pg"><span class="pb-hero">Picture</span><b class="pb-h1">About this map</b><div class="pb-two"><span></span><span></span></div></div></div>`, "A hero picture and two columns. Pictures cost slow phones data, and a second column fights the map for room."],
  see: [["Page top (PageNav)", "components-pages.html#page-top"], ["Site footer", "components-pages.html#site-footer"], ["Bottom bar", "components.html#bottom-nav"]],
});

// ── Page layout: admin ──────────────────────────────────────────────────────────────────────────────────────
const adminLayout = pat({
  id: "admin-layout", name: "Page layout: admin pages", status: "built",
  when: "Every admin page has the same top and the same order, so staff always know where to look.",
  screens: ["Dashboard, Blessing Boxes, Places, Events, and Activity for the owner", "Add a venue, Edit a place, Add event, Edit event", "Sign-in has its own one-box page"],
  steps: [
    "<b>Admin menu</b> across the top: Pueblo Food Map Admin, Signed in as, then the tabs (Dashboard, Blessing Boxes, Places, Events, and Activity for the owner) with a count on any tab that has work waiting, and Add place at the end.",
    "<b>Every page has a title</b> in Fraunces, 20 pixels: Places, Blessing Boxes, Events, Add event, Edit Eastside Community Pantry. Section titles are Fraunces 18, a small group heading Public Sans 14 semi-bold. <b>No line under the title</b> (owner's ruling).",
    "<b>One page body:</b> 16 pixels at the sides on a phone, 32 from 640 wide, 24 between parts. A form page is one 672-pixel column, title included.",
    "<b>Summary boxes</b> under the title, such as To review and Waiting to publish. A box with nothing in it is hidden, not shown empty.",
    "<b>The list or the form.</b>",
    "<b>The Publish bar</b> on Places and the Dashboard, when saved changes are waiting to go on the public map.",
  ],
  example: `<div class="pb-adm"><div class="pb-admtop"><b>Pueblo Food Map Admin</b><small>Signed in as dana@example.org</small><div class="tabs"><span class="on">Places <i>12</i></span><span>Events</span><span>Add place</span></div></div><div class="pb-admbody"><b class="pb-h2">Edit Eastside Community Pantry</b><div class="pb-box">Waiting to publish: 2 changes</div>${field("Name", "Eastside Community Pantry")}</div></div>`,
  wordsNote: "The admin is in English only.",
  words: [
    ["Pueblo Food Map Admin", "", "Top of every admin page, its one main heading (AdminNav.tsx)"],
    ["Signed in as dana@example.org", "", "Under it (the address is made up)"],
    ["Hi dana", "", "The Dashboard's title (admin/page.tsx; the name is made up)"],
    ["Places · Blessing Boxes · Events · Activity", "", "The other list pages' titles"],
    ["Edit Eastside Community Pantry", "", "A place's edit page title (venues/[id]/edit/page.tsx)"],
    ["Add a venue", "", "The new place page title (venues/new/page.tsx)"],
    ["This page didn't load", "", "When an admin page fails to load (admin/error.tsx)"],
  ],
  doIt: [`<div class="pb-adm"><div class="pb-admbody"><b class="pb-h2">Events</b><div class="pb-box">No events yet</div></div></div>`, "The title, then straight to the work."],
  dont: [`<div class="pb-adm"><div class="pb-admbody"><b class="pb-h2">Events</b><p class="pb-sub">View and manage all the events in the system.</p></div></div>`, "A line under the title that says nothing new (owner's ruling: no subtitle)."],
  see: [["Admin menu (AdminNav)", "components-admin.html#admin-nav"], ["Admin cards and boxes", "components-admin.html#admin-cards"], ["Publish bar", "components-admin.html#admin-publish"]],
});

// ── Forms ───────────────────────────────────────────────────────────────────────────────────────────────────
const savePair = (cancel: boolean) => `<div class="pb-save">${cancel ? outline("Cancel") : ""}${sage("Save changes", "w")}</div>`;
const forms = pat({
  id: "forms", name: "Forms", status: "built",
  statusNote: "Live as is. Cancel sits beside Save on every admin form (#926, owner's ruling: Cancel beside Save). The public forms are as they were.",
  when: "Any time someone types more than one thing: a visitor telling us about a place, or staff editing one.",
  screens: ["Public: Suggest a place, Send us feedback, Report an issue, Share an event", "Admin: Add a venue, a place's edit page, Add event, Edit event"],
  steps: [
    "<b>One box per thing, label above it.</b> A label says (optional) when it is; a required one carries a red star.",
    "<b>Public forms check when you press send.</b> Each problem shows under its box, and the keyboard moves to the first one so a screen reader hears it.",
    "<b>The send button says what it sends:</b> Submit suggestion, Send feedback, Submit report, Send for review. While the are-you-human check runs it reads Verifying…; while sending, Sending…. It can't be pressed twice.",
    "<b>Sent:</b> the form is replaced by Thank you! and a line saying what happens next, with Back to map.",
    "<b>Failed:</b> a red box at the top, everything typed stays, and Try again sits under the send button.",
    "<b>Admin:</b> Cancel beside Save on every form, a third of the row. It saves nothing and goes where Save would land: Places (or the To review list, when a place's form was opened from a review), or Events from the event form. While a save runs, Cancel is off.",
    "<b>Admin, someone else saved first:</b> the red box says so and offers Reload. Nothing typed is cleared until Reload is pressed.",
  ],
  example: `<div class="pb-two-ex"><div class="pb-pg card">${field("Place name *", "", "Please enter a place name.")}${field("Your email *", "you@example.com")}${sage("Sending…", "w dim")}</div><div class="pb-pg card">${field("Name", "Eastside Community Pantry")}${savePair(true)}<small class="pb-cap">Admin: Cancel beside Save</small></div></div>`,
  words: [
    ["Submit suggestion", "Enviar sugerencia", "Suggest a place, the send button (i18n.ts:261)"],
    ["Verifying…", "Verificando…", "Send button while the are-you-human check runs (i18n.ts:366)"],
    ["Sending…", "Enviando…", "Send button while it sends (i18n.ts:262)"],
    ["Thank you!", "¡Gracias!", "Replaces the form once it's sent (i18n.ts:265)"],
    ["Your suggestion has been submitted. We review all suggestions and will add verified places to the map.", "Tu sugerencia ha sido enviada. Revisamos todas las sugerencias y agregaremos los lugares verificados al mapa.", "Under Thank you! (i18n.ts:266)"],
    ["Your email is used only to follow up on your submission. It is never sold or shared.", "Tu correo solo se usa para darte seguimiento. Nunca lo vendemos ni compartimos.", "Under every email box (i18n.ts:549)"],
    ["Save changes", "", "Admin, a place's edit page (AddVenueForm.tsx); Add venue on a new one; Save draft and Publish on an event"],
    ["Saving…", "", "Admin save button while it saves"],
    ["Cancel", "", "Admin, beside the save buttons on every form"],
    ["Someone else changed this place since you opened it. Reload to see their changes.", "", "Admin, red box at the top, with Reload (api/admin/venues/[id]/route.ts:431)"],
  ],
  doIt: [`<div class="pb-pg card">${savePair(true)}</div>`, "Cancel beside Save, so leaving without saving is one plain tap."],
  dont: [`<div class="pb-pg card">${savePair(false)}</div>`, "Save on its own. The only way out is the browser's back button (made-up example)."],
  see: [["Public form fields and buttons", "components-pages.html#forms"], ["Admin form fields and the save button", "components-admin.html#admin-forms"]],
});

// ── Errors ──────────────────────────────────────────────────────────────────────────────────────────────────
const errors = pat({
  id: "errors", name: "Errors", status: "built",
  statusNote: "Shown as it is live. Some live words break a wording ruling (vague, or a long dash); they are flagged in the table and listed for the owner, not rewritten here.",
  when: "Something stopped the job: a box is filled in wrong, a send or save failed, the map can't load.",
  screens: ["Every public form and every admin form", "The map screen, when the map can't load", "Admin actions: publish, approve, archive, sign-in; an admin page that fails to load"],
  steps: [
    "<b>A box is wrong:</b> red edge, and a line under it saying what to put in. The keyboard moves to the first wrong box. On the admin the edge stays red while the box has focus, and after a refused save the page scrolls that box to the middle of the screen (both admin forms; sign-in and Add host too).",
    "<b>A send or save failed:</b> a red box at the top of the form says it wasn't sent and offers Try again. Public forms also give an email address to write to. What was typed stays.",
    "<b>Too many sends:</b> say how long to wait, an hour.",
    "<b>Something can't work on this phone:</b> fall back and say so, not as an error. When the map can't load, the list shows instead with a plain line.",
    "<b>Admin:</b> the red line says what did not happen (The place was not saved), then what to do. A problem with something typed, or a lookup that found nothing (No match found), is the small line under its box or button, like the field errors; an action on a card or list that failed is the larger red line. No admin message says Something went wrong. A page that fails to load shows the admin error page: nothing was changed, Try again, Go to the Dashboard.",
    "<b>Never a pop-up that fades</b> for a failure, and never a code.",
  ],
  example: `<div class="pb-pg card"><div class="pb-err"><b>Something went wrong</b><p>Your suggestion couldn't be sent. Please try again, or email us directly at suggestions@pueblofoodmap.com.</p></div>${field("Place name *", "Eastside Community Pantry")}${sage("Submit suggestion", "w")}${outline("Try again")}</div>`,
  words: [
    ["Please enter a place name.", "Por favor ingresa el nombre del lugar.", "Under an empty Place name (i18n.ts:270)"],
    ["Please enter a valid email address.", "Por favor ingresa un correo electrónico válido.", "Under an email box (i18n.ts:274)"],
    ["Something went wrong", "Algo salió mal", "Title of the red box on every public form (i18n.ts:267, also :303, :357, :504)", "vague: it says nothing the line under it doesn't"],
    ["Your suggestion couldn't be sent. Please try again, or email us directly at suggestions@pueblofoodmap.com.", "No se pudo enviar tu sugerencia. Por favor intenta de nuevo, o escríbenos directamente a suggestions@pueblofoodmap.com.", "Under it (i18n.ts:268)"],
    ["Too many submissions from this address. Please try again in an hour.", "Demasiados envíos desde esta dirección. Por favor intenta de nuevo en una hora.", "Too many sends (i18n.ts:275)"],
    ["Couldn't verify you're human — please retry.", "No pudimos verificar que eres humano. Por favor intenta de nuevo.", "Under the are-you-human check (i18n.ts:367)", "long dash, in English only"],
    ["Map unavailable", "Mapa no disponible", "Over the list when the map can't load (i18n.ts:534)"],
    ["The interactive map can't load on this device, so we're showing the list instead.", "El mapa interactivo no se puede cargar en este dispositivo, así que mostramos la lista.", "Under it (i18n.ts:535)"],
    ["Map needs a connection", "El mapa necesita conexión", "Offline, with The list still works. (i18n.ts:538)"],
    ["The place was not saved. Try again.", "", "Admin, a place's form (AddVenueForm.tsx)"],
    ["The place was not removed. Try again.", "", "Admin, in the Remove from map confirm (ArchiveVenueButton.tsx)"],
    ["Couldn't load events. Check your connection and try again.", "", "Admin, Events, with Retry (EventsList.tsx)"],
    ["Couldn't reach GitHub to publish. Nothing was changed. Try again in a moment.", "", "Admin, Publish failed before anything changed (PublishPanel.tsx)"],
    ["The publish didn't finish, so we can't tell whether the map changed. Reload the page to see what's still waiting, then try again.", "", "Admin, Publish failed with a server error or a lost connection (PublishPanel.tsx)"],
    ["The code was not sent. Try again.", "", "Admin sign-in (AdminLoginForm.tsx)"],
    ["The submission was not dismissed. Try again.", "", "Admin, an event the public sent in (EventSubmissionsList.tsx)"],
    ["Nothing was approved: more than 200 date-only proposals were selected. Narrow the filter and try again.", "", "Admin, Approve all date-only updates (ToReviewSummaryBox.tsx)"],
    ["Some updates may not have been approved. Refresh the page to see which, then try again.", "", "Admin, the same, failed partway (ToReviewSummaryBox.tsx)"],
    ["This page didn't load", "", "Admin, a page that failed to load (admin/error.tsx), then Nothing was changed. Try again, or go back to the Dashboard."],
  ],
  doIt: [`<div class="pb-pg card">${field("Your email *", "dana@example", "Please enter a valid email address.")}</div>`, "Under the box, say what to put in."],
  dont: [`<div class="pb-toast">Error 400</div>`, "A code in a pop-up that fades. Nobody can act on it (made-up example)."],
  see: [["Public form fields and buttons", "components-pages.html#forms"], ["Admin form fields", "components-admin.html#admin-forms"], ["On-page confirm", "components-admin.html#admin-confirm"]],
});

// ── Empty states ────────────────────────────────────────────────────────────────────────────────────────────
const empty = pat({
  id: "empty", name: "Empty states", status: "built",
  when: "A list has nothing in it, because nothing is there yet or because a search or a filter found nothing.",
  screens: ["Saved places, the list view, the search box, the events list", "Admin: Events, Places, Blessing Boxes, Activity, a box's check-ins and host emails, and the Dashboard charts"],
  steps: [
    "<b>Say what's missing</b> in a short line: No saved places yet.",
    "<b>Say how to fill it</b>, or give the one button that does: Tap the star on any place to save it.",
    "<b>After a search or a filter,</b> offer the way out: Clear filters, or a row of categories to try.",
    "A 28-pixel line icon in ink 400 above the words at most. No pictures.",
    "<b>Admin summary boxes</b> with nothing in them hide instead of showing empty.",
    "<b>Admin lists</b> show one shared empty box, lifted like the cards; after a filter, Clear filters sits in it. Activity is the exception: its filter form always holds the page's one Clear filters, so its empty box has only its line.",
  ],
  example: `<div class="pb-two-ex"><div class="pb-empty"><span class="pb-star" aria-hidden="true">☆</span><b>No saved places yet</b><p>Tap the star on any place to save it. It will show up here.</p></div><div class="pb-empty"><p>No places match your filters.</p>${outline("Clear filters")}</div></div>`,
  words: [
    ["No saved places yet", "Todavía no tienes lugares guardados", "Saved, empty (i18n.ts:191)"],
    ["Tap the star on any place to save it. It will show up here.", "Toca la estrella en cualquier lugar para guardarlo. Aparecerá aquí.", "Under it (i18n.ts:192)"],
    ["No places match your filters.", "Ningún lugar coincide con tus filtros.", "List view, nothing left (i18n.ts:135)"],
    ["Clear filters", "Borrar filtros", "The button under it; clears the search words too (i18n.ts:136)"],
    ["No matches for \"zzq\"", "Sin resultados para \"zzq\"", "Under the search box (i18n.ts:137; the search word is made up)"],
    ["Try a category instead:", "Prueba una categoría:", "Above the category row under it (i18n.ts:138)"],
    ["No events coming up", "No hay eventos próximos", "The events list, with Show places again (i18n.ts:442, :446)"],
    ["No events yet.", "", "Admin, Events, with Add a one-day giveaway, a turkey drive or a pop-up distribution. and Add event (EventsList.tsx)"],
    ["No places match your search or filters.", "", "Admin, Places after a filter, with Clear filters (VenueListView.tsx); No places yet. with none at all"],
    ["No boxes match these filters.", "", "Admin, Blessing Boxes after a filter, with Clear filters (AllBoxesTable.tsx)"],
    ["No activity matches these filters.", "", "Admin, Activity when a filter is set; Clear filters is in the filter form (ActivityLog.tsx)"],
    ["No activity yet.", "", "Admin, Activity with no filter set (ActivityLog.tsx)"],
    ["No visitor data yet for this period.", "", "Admin, a Dashboard chart (admin/page.tsx)"],
  ],
  doIt: [`<div class="pb-empty sm"><p>No places match your filters.</p>${outline("Clear filters")}</div>`, "Says why it's empty and gives the way out."],
  dont: [`<div class="pb-empty sm"><p>No results.</p></div>`, "Results of what? What now? (made-up example)"],
  see: [["Menu panel (Saved)", "components.html#menu-panel"], ["Search bar", "components.html#search-bar"], ["Lists and tables (admin)", "components-admin.html#admin-lists"]],
});

// ── Waiting and loading ─────────────────────────────────────────────────────────────────────────────────────
const waiting = pat({
  id: "waiting", name: "Waiting and loading", status: "built",
  when: "Anything that takes longer than a blink: the map loading, a form sending, the phone finding where you are.",
  screens: ["The map screen while the map loads, and Near me while it locates", "Every send and save button", "A box card while its details load; the Share an event address and flyer checks"],
  steps: [
    "<b>The map loading:</b> a plain bone 100 block where the map will be, with Loading map… gently pulsing (still for anyone who turns motion off).",
    "<b>A button that started something</b> fades, says what it's doing (Sending…, Saving…, Removing…) and can't be pressed twice. On the admin it keeps the keyboard on it while it works (marked off, not switched off), so nobody is dropped back to the top of the page.",
    "<b>Near me while locating:</b> its icon becomes a turning spinner, it can't be pressed again, and a hidden line tells screen readers Locating…. Its word stays Near me.",
    "<b>A spinner only inside the control that started the wait.</b> Never one over the whole map, and no grey placeholder shapes.",
    "Words end in a real ellipsis (…), never three dots.",
  ],
  example: `<div class="pb-two-ex"><div class="pb-mapload">Loading map…</div><div class="pb-pg card">${sage("Sending…", "w dim")}<div class="pb-nm"><span class="pb-spin" aria-hidden="true"></span>Near me</div></div></div>`,
  words: [
    ["Loading map…", "Cargando mapa…", "Where the map will be (i18n.ts:531)"],
    ["Locating…", "Localizando…", "Hidden line read out while Near me works (i18n.ts:169)"],
    ["Sending…", "Enviando…", "Every public send button while it sends (i18n.ts:262)"],
    ["Loading…", "Cargando…", "A box card while it loads (i18n.ts:768)"],
    ["Checking the address…", "Revisando la dirección…", "Share an event, the address box (i18n.ts:479)"],
    ["Adding your flyer…", "Agregando tu volante…", "Share an event, the flyer (i18n.ts:489)"],
    ["Saving…", "", "Admin save buttons (AddVenueForm.tsx, EventForm.tsx)"],
    ["Approving…", "", "Admin, Approve all date-only updates (ToReviewSummaryBox.tsx)"],
  ],
  doIt: [`<div class="pb-pg card">${sage("Sending…", "w dim")}</div>`, "The button says what it's doing and can't be pressed twice."],
  dont: [`<div class="pb-mapload big"><span class="pb-spin" aria-hidden="true"></span></div>`, "A spinner over the whole map, saying nothing (made-up example)."],
  see: [["Bottom bar (Near me)", "components.html#bottom-nav"], ["Public form fields and buttons", "components-pages.html#forms"], ["Phone card sheet", "components.html#card-shells"]],
});

// ── Confirming a risky action ───────────────────────────────────────────────────────────────────────────────
// The live on-page confirm (AdminConfirm; pages/03c-components-admin.ts, confirmBox), drawn with the admin block's
// own pa- classes so it can't drift from that entry.
const ruleConfirm = `<div class="pa" style="width:100%"><div class="pa-confirm" role="group" aria-labelledby="pb-cf1"><p class="t" id="pb-cf1">Remove Eastside Community Pantry from the map?</p>
  <p>It will stop appearing on the next publish. Its record is kept, not deleted, and this can be reviewed later.</p>
  <div class="two"><button type="button" class="pa-bs pa-ring">Cancel</button><button type="button" class="pa-bd pa-ring">Remove from map</button></div></div></div>`;
const confirm = pat({
  id: "confirm", name: "Confirming a risky action", status: "built",
  statusNote: "Live as is on the admin (#926): every risky admin action asks in a box on the page, Cancel first. The one browser pop-up left is on the public site, a box photo's report.",
  when: "The action changes what the public sees or can't be easily undone: taking a place off the map, publishing, hiding a photo.",
  screens: ["Admin, on the page: Remove from map, a change card's Archive this venue, Publish, Approve all date-only updates, Archive event, Remove this flyer", "Still the browser's pop-up (drift): on the public site, a box photo's report"],
  steps: [
    "The first tap <b>opens the confirm right where the button was</b>, on the page. Never the browser's pop-up.",
    "It <b>names the thing and says exactly what happens</b>, and what doesn't: it leaves the map; the record is kept.",
    "Two buttons, 48 tall: half the row each from 640 pixels wide, stacked full width on a phone. <b>Cancel comes first</b> (on top on a phone), so Enter on the first button never removes anything.",
    "The risky button <b>names the action</b>: Remove from map, not Yes or OK. Removals are red; Publish and Approve all are green.",
    "While it works it says what it's doing (Removing…) and can't be pressed twice, yet the keyboard stays on it. If it fails, the red line says what did not happen.",
    "In a Reject, Remove photo or Decline step too, <b>Cancel comes first</b> and the red Confirm second; in the Cancel event step, Keep event first, then the red Confirm cancel event, in a box with the confirm's look. The Reject, Remove photo and Decline steps are one shared part (AdminRejectStep). Escape closes any of these steps unless its request is running, and Cancel, Keep event or Escape clears what was typed.",
  ],
  example: ruleConfirm,
  words: [
    ["Remove Eastside Community Pantry from the map?", "", "Remove from map, a place's edit page (ArchiveVenueButton.tsx; the place is made up)"],
    ["It will stop appearing on the next publish. Its record is kept, not deleted, and this can be reviewed later.", "", "Under it; then Cancel and Remove from map"],
    ["It leaves the map right away. Its record is kept, not deleted, and this can be reviewed later.", "", "Under it instead, for a blessing box (boxes are live, no Publish)"],
    ["This place is removed from the map.", "", "In place of the button once it is off the map, with no Danger zone heading"],
    ["Archive Eastside Community Pantry?", "", "Archive this venue, a data change that removes a place (ProposalCard.tsx)"],
    ["It stops showing on the public map at the next publish. Its record is kept, not deleted.", "", "Under it; then Cancel and Archive this venue"],
    ["Publish 2 new places and 3 edited places to the public map?", "", "Publish (PublishPanel.tsx; the numbers are made up)"],
    ["1 place will be removed. This opens a change request on GitHub that merges on its own.", "", "Under it (the first sentence only when places are removed); then Cancel and Publish, green"],
    ["Approve all 12 date-only updates?", "", "Approve all on Places (ToReviewSummaryBox.tsx)"],
    ["These only update the last-verified date. Real changes are not included.", "", "Under it; then Cancel and Approve 12 updates, green"],
    ["Archive this event?", "", "Archive event, an event's edit page (EventForm.tsx)"],
    ["It leaves the map and the list of live events, and stays in the admin history.", "", "Under it; then Cancel and Archive event"],
    ["Remove this flyer?", "", "Remove, under an event's flyer (EventFlyerField.tsx)"],
    ["The event stays. Only the picture is removed.", "", "Under it; then Cancel and Remove flyer"],
    ["Cancel", "", "The safe button, always first"],
    ["Hide this photo and send it for review?", "¿Ocultar esta foto y enviarla para revisión?", "Drift, public: reporting a box photo, still the browser's pop-up (ReportPhotoButton.tsx)"],
  ],
  doIt: [ruleConfirm.replace("pb-cf1", "pb-cf2").replace("pb-cf1", "pb-cf2"), "Name the place, say what happens, safe button first."],
  dont: [`<div class="pa" style="width:100%"><div class="pa-confirm"><p class="t">Are you sure?</p><div class="two"><button type="button" class="pa-bd">Yes</button><button type="button" class="pa-bs">No</button></div></div></div>`, "Are you sure? Yes / No. Nobody knows what Yes does, and the risky button comes first (made-up example)."],
  see: [["On-page confirm (AdminConfirm)", "components-admin.html#admin-confirm"], ["Change cards", "components-admin.html#admin-change"], ["Publish bar", "components-admin.html#admin-publish"]],
});

// ── Picking several ─────────────────────────────────────────────────────────────────────────────────────────
const tick = (label: string, on: boolean) => `<span class="pb-tk${on ? " on" : ""}"><i aria-hidden="true">${on ? "✓" : ""}</i>${label}</span>`;
const picking = pat({
  id: "picking", name: "Picking several", status: "built",
  statusNote: "The site has one place where you pick several things: the Filters panel. No list on the public site or the admin lets you tick rows and act on them together.",
  when: "Narrowing the map to several kinds of place at once, or to what's open now and takes SNAP or WIC.",
  screens: ["The Filters panel, from the Filters button in the search bar (map and list views)", "Admin: none. Approve all date-only updates on Places is one button over a fixed set, not picking"],
  steps: [
    "Filters opens a panel from the left, over the dimmed map.",
    "<b>Each tick applies at once.</b> The map changes beside the panel; there is no Apply step.",
    "<b>The ticks stay</b> when the panel closes, and the Filters button counts them: Filters, 2 on.",
    "<b>The panel closes on the orange Show 24 places</b>, which says what you'll see. Kyle kept it where the picking ruling would say Done. The ×, Escape, a tap on the map and a swipe left also close it.",
    "<b>Clear all</b> at the top takes every tick off. It leaves the search words alone, on purpose.",
    "No pop-up after a change: the map itself is the confirmation.",
  ],
  example: `<div class="pb-fp"><div class="hd"><b>Filters</b><span>Clear all</span><span class="x" aria-hidden="true">×</span></div><small>Show only</small>${tick("Open now", true)}${tick("Accepts SNAP", false)}<small>Kind of place</small>${tick("Food Pantry", true)}${tick("Meal Site", false)}${orange("Show 24 places")}</div>`,
  words: [
    ["Filters", "Filtros", "The button in the search bar and the panel title (i18n.ts:65)"],
    ["Filters, 2 on", "Filtros, 2 activos", "The button while filters are on (i18n.ts:66)"],
    ["Show only", "Mostrar solo", "Heading over Open now, Accepts SNAP, Accepts WIC (i18n.ts:69)"],
    ["Kind of place", "Tipo de lugar", "Heading over the categories (i18n.ts:70)"],
    ["Clear all", "Borrar todo", "Top of the panel (i18n.ts:71)"],
    ["Show 24 places", "Mostrar 24 lugares", "The orange button that closes it (i18n.ts:72)"],
    ["Show 3 events", "Mostrar 3 eventos", "The same button while Events is ticked (i18n.ts:445)"],
    ["Close filters", "Cerrar filtros", "The ×, for screen readers (i18n.ts:68)"],
  ],
  doIt: [`<div class="pb-fp sm">${tick("Food Pantry", true)}${orange("Show 24 places")}</div>`, "Ticks apply at once; the button says what you'll see."],
  dont: [`<div class="pb-fp sm">${tick("Food Pantry", true)}${sage("Apply", "w")}</div>`, "An Apply button that holds the ticks back. The map should change as you tick (made-up example)."],
  see: [["Filters panel (FilterPanel)", "components.html#filters-panel"], ["Search bar", "components.html#search-bar"]],
});

// ── Search and filter ───────────────────────────────────────────────────────────────────────────────────────
const search = pat({
  id: "search-filter", name: "Search and filter", status: "built",
  statusNote: "Shown as it is live. The kit's default puts the whole view in the address, so a link brings it back. This site doesn't (see step 5); there is no ruling on it, so it's listed, not changed.",
  when: "Finding a place by name or narrowing the map, from the bar at the top of the map and the list.",
  screens: ["The map screen and the list view"],
  steps: [
    "<b>One search bar</b> at the top: the words box, then Filters at its right end. There is no Search button.",
    "<b>Matches show under the box as you type</b>, with a count. The row under them shows every match as a list.",
    "<b>Filters</b> narrow by kind of place, open now, SNAP and WIC (the Picking several pattern above).",
    "<b>Map or list:</b> a row under the search box (See all places as a list, Back to the map) and a line at the top of the Menu. Kept as is.",
    "<b>The view is not in the address.</b> Search words, filters and map or list are lost on a refresh and can't be shared. What a link can carry: one place (<code>?venue=</code>), one event (<code>?event=</code>, kept in step as you pick events), and Near me, Boxes and the tour from the inside pages, which are taken out of the address once used.",
    "<b>Two different clears:</b> Clear filters, in an empty list, clears the filters and the search words. Clear all, in the Filters panel, clears the filters only.",
  ],
  example: `<div class="pb-srch"><span class="f">Filters</span><span class="q">pantry</span></div><div class="pb-pop"><small>3 places match</small><span>Eastside Community Pantry</span><span>Mesa Street Food Shelf</span><b>See all 3 matches as a list</b></div>`,
  words: [
    ["Search", "Buscar", "Grey words in the empty box (i18n.ts:44)"],
    ["Search places", "Buscar lugares", "The box's name for screen readers (i18n.ts:45)"],
    ["3 places match", "3 lugares coinciden", "Over the matches as you type (i18n.ts:165)"],
    ["See all 3 matches as a list", "Ver los 3 resultados en una lista", "Under the matches (i18n.ts:331)"],
    ["See all places as a list", "Ver todos los lugares en una lista", "Under the empty, tapped-in box (i18n.ts:328)"],
    ["Back to the map", "Volver al mapa", "The same row in the list view (i18n.ts:329)"],
  ],
  doIt: [`<div class="pb-srch"><span class="f">Filters</span><span class="q">pantry</span></div>`, "Type and the matches show. Nothing to press."],
  dont: [`<div class="pb-srch"><span class="q">pantry</span><span class="go">Go</span></div>`, "A Go button to press before anything happens (made-up example)."],
  see: [["Search bar (SearchBar)", "components.html#search-bar"], ["Filters panel", "components.html#filters-panel"], ["Map / list switch", "components.html#view-switch"]],
});

// ── Finding food near me ────────────────────────────────────────────────────────────────────────────────────
const locCard = (title: string, body: string, retry: boolean) => `<div class="pb-loc"><b>${title}</b><p>${body} Tap any pin on the map to see hours and directions.</p>${retry ? orange("Try again") : ""}${outline("See all places as a list")}${retry ? "" : `<small>To use your location next time, turn it on in your browser or phone settings.</small>`}</div>`;
const nearMe = pat({
  id: "near-me", name: "Finding food near me", status: "built",
  when: "The first thing most visitors do: see the food closest to where they are standing.",
  screens: ["The welcome screen (first visit)", "The map, after the phone answers", "Near me in the bottom bar, any time after"],
  steps: [
    "<b>Welcome screen:</b> Find food near me and Encuentra comida cerca de mí, one orange button per language. Tapping one also picks the site's language. Take a tour sits under them, then the line about location.",
    "<b>The phone asks</b> whether the site may use its location.",
    "<b>Yes:</b> the map moves to you.",
    "<b>No:</b> a card above the bottom bar says Location is off and points to what still works: tap a pin, or the list. No Try again, because the phone would say no again. It says where to turn location on next time.",
    "<b>The phone tried and couldn't</b> (it took too long, often indoors): the card says We couldn't find you, with Try again first.",
    "<b>Outside Pueblo County:</b> a small clay note says so at the bottom of the map.",
    "<b>Near me</b> in the bottom bar does the same thing again, with its spinner while it works. Nothing about the location is saved.",
  ],
  example: `<div class="pb-two-ex"><div class="pb-splash">${orange("Find food near me")}${orange("Encuentra comida cerca de mí")}${outline("Take a tour")}<small>We only use your location to show food nearby. Nothing is saved.</small></div><div class="pb-mapblock">${locCard("We couldn't find you", "Your phone took too long to find where you are. This happens a lot indoors.", true)}</div></div>`,
  words: [
    ["Find food near me", "Encuentra comida cerca de mí", "The two orange buttons on the welcome screen (i18n.ts:146; the Spanish one at :1201)"],
    ["We only use your location to show food nearby. Nothing is saved.", "Solo usamos tu ubicación para mostrar alimentos cercanos. Nada se guarda.", "Under them (i18n.ts:147)"],
    ["Take a tour", "Ver cómo funciona", "Under the buttons (i18n.ts:150)"],
    ["Location is off", "Ubicación desactivada", "Card title, the phone said no (i18n.ts:155)"],
    ["No problem, you can still find food.", "No hay problema, aún puedes encontrar comida.", "Its first line (i18n.ts:156)"],
    ["To use your location next time, turn it on in your browser or phone settings.", "Para usar tu ubicación la próxima vez, actívala en la configuración del navegador o del teléfono.", "At its foot (i18n.ts:157)"],
    ["We couldn't find you", "No pudimos encontrarte", "Card title, the phone couldn't (i18n.ts:158)"],
    ["Your phone took too long to find where you are. This happens a lot indoors.", "Tu teléfono tardó demasiado en encontrar dónde estás. Esto pasa mucho bajo techo.", "Its first line when it timed out (i18n.ts:159)"],
    ["Your phone couldn't work out where you are right now.", "Tu teléfono no pudo saber dónde estás en este momento.", "Its first line otherwise (i18n.ts:160)"],
    ["Tap any pin on the map to see hours and directions.", "Toca cualquier punto del mapa para ver horarios y cómo llegar.", "Ends both cards (i18n.ts:161)"],
    ["Try again", "Intentar de nuevo", "Couldn't-find-you card only (i18n.ts:162)"],
    ["See all places as a list", "Ver todos los lugares en una lista", "Both cards (i18n.ts:328)"],
    ["Your location is outside Pueblo County", "Tu ubicación está fuera del condado de Pueblo", "Clay note at the bottom of the map (i18n.ts:170)"],
  ],
  doIt: [`<div class="pb-mapblock sm">${locCard("Location is off", "No problem, you can still find food.", false)}</div>`, "Say what happened kindly and what still works."],
  dont: [`<div class="pb-mapblock sm"><span class="pb-maplbl">The map, centered on downtown, and no word why</span></div>`, "Drop the visitor on the map with no explanation. Before the card, more than half of them left (LocationHelpCard.tsx header)."],
  see: [["Location help card and the splash's orange button", "components.html#location-help"], ["Bottom bar (Near me)", "components.html#bottom-nav"]],
});

// ── Getting directions ──────────────────────────────────────────────────────────────────────────────────────
const dirRow = `<div class="pb-dir">${sage("Walk")}${outline("Bus")}${outline("Drive")}</div>`;
const directions = pat({
  id: "directions", name: "Getting directions", status: "built",
  statusNote: "The steps are live as they are. The pointer tint on Bus, Drive and the steps sheet's × changes in the Components entry, not here.",
  when: "Someone has picked a place and wants to get there: on foot, by bus or by car.",
  screens: ["Every place card, on the map and on the place's own page", "The phone's route strip and steps sheet while walking", "A blessing box card (the address is the link) and an event card (one orange button)"],
  steps: [
    "<b>Walk, Bus, Drive</b> sit in one row on the place card, the same width each, 48 pixels tall.",
    "<b>Walk</b> draws the walking route right on our map. It needs the location; if the phone won't share it, a line says so under the row.",
    "<b>On a phone,</b> the card shrinks to a strip at the bottom so the route shows: the place name, the distance and time, Clear walking route, Steps and Show card.",
    "<b>Steps</b> shows one turn at a time with Previous turn and Next turn, a count, how far to the turn, what comes next, and All turns for the whole list. The turn words come from the map service, already in the visitor's language.",
    "<b>Open in Google Maps</b> under the turns, for the phone's own map app.",
    "<b>Bus and Drive</b> open Google Maps in a new tab, starting from where you are.",
    "<b>A blessing box</b> has no Walk, Bus, Drive row: its address is the link. <b>An event</b> has one orange Get directions button.",
  ],
  example: `<div class="pb-two-ex"><div class="pb-pg card"><b class="pb-name">Eastside Community Pantry</b>${dirRow}</div><div class="pb-strip"><b class="pb-name">Eastside Community Pantry</b><span class="d">0.6 mi walk · 13 min</span><div class="r"><span class="lk">Clear walking route</span>${sage("Steps")}<span class="lk">Show card</span></div></div></div>`,
  words: [
    ["Walk", "Caminar", "The route button (i18n.ts:594)"],
    ["Bus", "Autobús", "Opens Google Maps (i18n.ts:595)"],
    ["Drive", "Manejar", "Opens Google Maps (i18n.ts:596)"],
    ["Walking directions to Eastside Community Pantry (opens on map)", "Cómo llegar caminando a Eastside Community Pantry (se muestra en el mapa)", "Walk, for screen readers (i18n.ts:597)"],
    ["Share your location to see walking directions.", "Comparte tu ubicación para ver cómo llegar a pie.", "Under the row when location is off (i18n.ts:612)"],
    ["0.6 mi walk", "0.6 mi caminando", "The route's distance, then · 13 min (i18n.ts:604)"],
    ["Clear walking route", "Eliminar ruta a pie", "Walk while a route is on, and on the strip (i18n.ts:606)"],
    ["Steps", "Pasos", "On the strip (i18n.ts:616)"],
    ["Show card", "Mostrar tarjeta", "On the strip (i18n.ts:609)"],
    ["Step 2 of 7", "Paso 2 de 7", "Over the current turn (i18n.ts:629)"],
    ["In 280 ft", "En 280 pies", "How far to the turn (i18n.ts:630, :624)"],
    ["You have arrived", "Has llegado", "The last step (i18n.ts:631)"],
    ["Previous turn / Next turn", "Giro anterior / Siguiente giro", "The two arrows, for screen readers (i18n.ts:633-634)"],
    ["All turns", "Todos los giros", "Opens the whole list (i18n.ts:635)"],
    ["Open in Google Maps", "Abrir en Google Maps", "Under the turns (i18n.ts:638)"],
    ["Get directions", "Cómo llegar", "The event card's orange button (i18n.ts:411)"],
  ],
  doIt: [`<div class="pb-pg card">${dirRow}</div>`, "One word each, and Walk keeps you on our map."],
  dont: [`<div class="pb-strip"><div class="r"><span class="lk ul">Clear walking route</span><span class="lk ul">Steps</span><span class="lk ul">Show card</span></div></div>`, "Three underlined links in one row. On a real walk nobody found Steps (#537)."],
  see: [["Direction buttons and the route strip", "components.html#directions"], ["Place card", "components.html#venue-card"], ["Blessing box card", "components.html#box-card"], ["Event card", "components.html#event-card"]],
});

// ── English and Spanish ─────────────────────────────────────────────────────────────────────────────────────
const language = pat({
  id: "language", name: "English and Spanish", status: "built",
  when: "Always. Every word a visitor sees or hears has a Spanish twin.",
  screens: ["Every public page, the map and every card; the admin is English only"],
  steps: [
    "<b>Every visible word and every screen-reader name</b> lives in the language files (src/lib/i18n.ts, with the Spanish in i18n.es.ts), never typed into a component. A test checks both languages have every key.",
    "<b>The welcome screen</b> picks the language with one tap: Find food near me or Encuentra comida cerca de mí.",
    "<b>The Menu</b> has the switch on the Language / Idioma row: EN and ES, never flags.",
    "<b>The /es pages</b> are fully Spanish, page titles too, so search engines list them in Spanish. Someone on an English page who picked Spanish sees Ver en español → in the Menu; the site never moves them on its own.",
    "<b>Spanish says tú</b>, not usted: Toca la estrella.",
    "<b>Spanish runs longer.</b> Buttons and rows wrap or shorten cleanly at 320 pixels, never cut words off.",
    "<b>SNAP and WIC</b> stay as they are in Spanish: they are the programs' names.",
  ],
  wordsNote: "Key messages in both languages. Every other message on this page also lists its Spanish.",
  words: [
    ["Near me · Saved · Boxes · Help · Menu", "Cercanos · Guardados · Cajas · Ayuda · Menú", "The bottom bar (i18n.ts:173-183)"],
    ["Open now", "Abierto ahora", "A place card's hours line (i18n.ts:98)"],
    ["Hours unknown — call ahead", "Horario desconocido — llama antes", "A place card with no known hours (i18n.ts:102)", "long dash, in both languages"],
    ["Show 24 places", "Mostrar 24 lugares", "The Filters panel's orange button (i18n.ts:72)"],
    ["Get directions", "Cómo llegar", "Event card (i18n.ts:411)"],
    ["Link copied", "Enlace copiado", "After Share (i18n.ts:321)"],
    ["Something went wrong", "Algo salió mal", "A public form that failed to send (i18n.ts:267)", "vague"],
    ["Try again", "Intentar de nuevo", "Retry buttons (i18n.ts:162)"],
    ["Language / Idioma", "Language / Idioma", "The Menu row, the same in both on purpose (i18n.ts:212)"],
    ["Ver en español →", "Ver en español →", "The Menu, for an English-page visitor who picked Spanish (i18n.ts:219)"],
  ],
  doIt: [`<div class="pb-lang"><span class="on">EN</span><span>ES</span></div>`, "The two letters, the one you're reading filled."],
  dont: [`<div class="pb-lang"><span class="on">🇺🇸</span><span>🇲🇽</span></div>`, "Flags. A flag stands for a country, not a language (made-up example)."],
  see: [["Language switch (LanguageToggle)", "components-pages.html#language"], ["Menu panel", "components.html#menu-panel"]],
});

const parts = [publicLayout, adminLayout, forms, errors, empty, waiting, confirm, picking, search, nearMe, directions, language];
const items: [string, string][] = [
  ["#public-layout", "Public pages"], ["#admin-layout", "Admin pages"], ["#forms", "Forms"], ["#errors", "Errors"], ["#empty", "Empty states"],
  ["#waiting", "Waiting"], ["#confirm", "Confirming"], ["#picking", "Picking several"], ["#search-filter", "Search and filter"],
  ["#near-me", "Near me"], ["#directions", "Directions"], ["#language", "English and Spanish"], ["components.html", "Components →"],
];

export const pages: Page[] = [{
  slug: "patterns", route: "DESIGN.md → Patterns", title: "Design system: Patterns", area: "Design system", nav: "Patterns",
  blurb: "Jobs that repeat across the site, each with its exact words in English and Spanish: page layout, forms, errors, empty states, waiting, confirming, picking, search, finding food near me, directions, and the two languages.",
  changed: [
    "Twelve patterns, each in the same order: when it applies, the screens it covers, the steps, the exact words with their Spanish, one do and one don't, and the Components entries it is built from.",
    "Both patterns that were changing are now built on the admin (#926): Forms (Cancel beside Save on every admin form) and Confirming a risky action (every risky admin action asks on the page, Cancel first). The admin's error and empty words were rewritten in the same work.",
  ],
  kept: [
    "Every message is the live one, copied from the site. Where it breaks a wording rule (a vague Something went wrong, or a long dash) it is shown as it is with a red Breaks a ruling note, not rewritten.",
    "The Filters panel closes on Show 24 places, which you kept in place of Done.",
    "Public form pages keep the line under the title; the no-subtitle ruling is for the admin.",
  ],
  check: [
    "Search and filter: the map's view isn't in the address, so a link can't bring back a search or filters. Fine as is, or should it be?",
    "Confirming: the admin has no browser pop-up left; the public photo report still uses one. Should the on-page confirm reach it too?",
    "Errors: the flagged public messages. Rewrite them in a later round, or leave them?",
  ],
  html: `<div class="head"><h1>Patterns</h1></div>${toc(items)}${parts.join("")}`,
}];
