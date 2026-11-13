// Design system: Components, pages and forms. The second Components page: the parts of the inside pages (page top,
// footer, language switch, hub lists, questions and answers, the public forms, box numbers, the not-found page and
// the event page). Same entry layout as pages/03-components.ts, which Kyle approved. Replicas copy the real classes,
// words and sizes from src/ (CSS in mock.css, block "pages-forms"). All names, places and numbers are made up.
//
// WHY the sizes below are not plain Tailwind: src/app/globals.css @theme redefines five spacing steps, so in this
// repo 5 = 24px, 6 = 32px, 8 = 48px and 10 = 64px (px-5, py-8, h-10, space-y-5, mb-6 ...). Every other step is the
// default 4px times n (py-2.5 = 10, h-12 = 48, min-h-14 = 56, h-16 = 64). Checked by compiling those classes with
// the repo's own tailwindcss against that @theme.
import { contrast, dodont, entry, hex, ratio, sw, toc, type Page, type Token } from "../lib";


// Lucide shapes as the site ships them (lucide-react 1.65.0, ISC license; notice in icons.ts).
const ICONS: Record<string, string> = {
  nav: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>`,
  cal: `<path d="M16 18h6"/><path d="M16 2v3"/><path d="M19 15v6"/><path d="M21 11.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8.3"/><path d="M3 9h18"/><path d="M8 2v3"/>`,
};
const ic = (n: string, size: number) => `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[n]}</svg>`;
const PAPER = hex("color-bone-50");
const WHITE = "#FFFFFF";
const r = (fg: Token, bg: Token | "white", need: 4.5 | 3 = 4.5) => ratio(hex(fg), bg === "white" ? WHITE : hex(bg), need);
/** Swatch with its contrast ratio against the background it really sits on. need 4.5 for words, 3 for edges. */
const swr = (name: string, t: Token, use: string, bg: Token | "white" = "color-bone-50", need: 4.5 | 3 = 4.5, bgName = "bone 50") =>
  sw(name, t, `${use}. ${r(t, bg, need)} on ${bgName}${need === 3 ? " (edge)" : ""}.`);
const wide = (label: string, html: string) => `<figure class="dsd pfm-wide pg-wide"><div>${html}</div><figcaption>${label}</figcaption></figure>`;
const demo = (label: string, html: string) => `<figure class="dsd"><div>${html}</div><figcaption>${label}</figcaption></figure>`;
const q = (s: string) => s.replaceAll('"', "&quot;");
const sayMsg = (m: string) => ` data-say="${q(m)}"`;

// ── Page top: back to map + page header ──────────────────────────────────────────────────────────────────────
const backLink = (cls = "") => `<a class="pg-back${cls ? ` ${cls}` : ""}" href="#page-top"${sayMsg("Mockup: this would go back to the map.")}>← Back to map</a>`;
const pageNav = (cls = "") => `<nav class="pg-nav" aria-label="Page">${backLink(cls)}</nav>`;
const pageTop = (o: { title: string; small?: boolean; intro?: string; sub?: string; body?: string }) => `<div class="pfm pg-page">${pageNav()}
  <div class="pg-col"><h1 class="pg-h1${o.small ? " sm" : ""}">${o.title}</h1>${o.intro ? `<p class="pg-intro">${o.intro}</p>` : ""}${o.sub ? `<p class="pg-sub">${o.sub}</p>` : ""}${o.body ?? ""}</div></div>`;

const pageTopEntry = entry({
  id: "page-top", name: "Page top: back to map and page header (PageNav)", status: "built",
  statusNote: "Shown as it is live today. The bottom bar these pages also carry is on the main Components page.",
  purpose: "The top of every inside page the Menu opens (About, All places, Food help programs, the hub pages, Suggest, Feedback, Report). A thin bar with one way back to the map, then the page title in Fraunces, in one centred column 512 pixels wide at most. The same bottom bar as the map sits at the foot of these pages, so Menu and Saved open right over the page.",
  instead: [
    "It's the map itself: the map has no page top; its search bar and bottom bar do the job.",
    "It's an event page: it has its own top, a breadcrumb (Map › the event) with the other language beside it. See Event page below.",
    "It's the not-found page: it has no top bar and no bottom bar, only one card in the middle. See Not found page below.",
  ],
  versions:
    wide("Content page (About, All places, Food help programs, the hub pages): a 30-pixel title, then the intro in ink 700.", pageTop({ title: "Food pantries in Pueblo County", intro: "There are 12 free food pantries on the map in Pueblo County, CO. Each one is listed below with its address, and hours where we have them." })) +
    wide("Form page (Suggest, Feedback, Report, Share an event): a 24-pixel title, then one short line in ink 500, then the form.", pageTop({ title: "Suggest a place", small: true, sub: "Know a food resource we're missing? Tell us about it." })),
  states:
    demo("Back to map, resting: sage 600", `<div class="pfm pg-strip">${pageNav()}</div>`) +
    demo("Pointer over it: the words darken to sage 700. No fill. Point at any of these to see it.", `<div class="pfm pg-strip">${pageNav("is-hover")}</div>`) +
    demo("Reached by keyboard: a sage 500 ring around the link", `<div class="pfm pg-strip">${pageNav("is-focus")}</div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The page, the bar and the column") +
    sw("Bone 200", "color-bone-200", `The line under the bar. ${contrast(hex("color-bone-200"), PAPER).toFixed(1)} to 1, decoration only`) +
    swr("Sage 600", "color-sage-600", "Back to map at rest") +
    swr("Sage 700", "color-sage-700", "Back to map under the pointer") +
    swr("Sage 500", "color-sage-500", "Keyboard ring", "color-bone-50", 3) +
    swr("Ink 900", "color-ink-900", "The page title") +
    swr("Ink 700", "color-ink-700", "The intro on content pages") +
    swr("Ink 500", "color-ink-500", "The line under a form page's title"),
  sizes: "Bar 48 pixels tall, 16 pixels in from the sides, a 1-pixel line under it. Back to map is 14 pixels, medium weight, and fills the bar's 48-pixel height to tap. Column: 512 pixels wide at most, 16 pixels in from the sides, 48 above and below. Title in Fraunces, regular weight: 30 pixels (36 line) on content pages, 24 (32 line) on form pages. Intro 14 pixels with roomy line spacing, 8 pixels under the title; on form pages the line sits 4 pixels under the title with 32 pixels before the form. Blocks on content pages are 48 pixels apart.",
  wording: [
    "The bar says Back to map, with a left arrow before it. Spanish: Volver al mapa. It is the only link in the bar.",
    "The title names the page in sentence case: Food pantries in Pueblo County, Suggest a place. It matches the Menu item or footer link that led here.",
    "The intro says what is on the page and how many, in one or two plain sentences. Numbers are real counts, never rounded up.",
  ],
  everyone: [
    "Keyboard: Back to map is the first thing Tab reaches on the page.",
    "Screen reader: the bar is a navigation landmark called Page. The title is the page's only top-level heading.",
    "Touch: Back to map is 48 pixels tall. It sits on the left, the first thing a thumb or eye finds.",
  ],
  dd: dodont(
    [`<div class="pfm pg-strip" style="width:100%">${pageNav()}</div>`, "One way back, the same words on every page."],
    [`<div class="pfm pg-strip" style="width:100%"><nav class="pg-nav" aria-label="Don't example">${backLink()}<span style="flex:1"></span><a class="pg-back" href="#page-top">Back to the map →</a></nav></div>`, "Two links back to the map. Two on one page was a real bug (fixed 2026-09-18); the box history page now points the one link at the box's card instead."],
  ),
  code: [
    "src/components/PageNav.tsx (the bar; PAGE_NAV_CLEARANCE keeps the page's end clear of the bottom bar)",
    "The column and title: AboutContent.tsx, VenuesDirectoryContent.tsx, ResourcesContent.tsx, HubPages.tsx (HubShell), SuggestPageContent.tsx, FeedbackPageContent.tsx, ReportPageContent.tsx, ShareEventPageContent.tsx",
    "Known live issue: two title sizes for the same job, text-3xl on content pages (AboutContent.tsx:70) and text-2xl on form pages and the place page (SuggestPageContent.tsx:33, VenueContent.tsx:121)",
  ],
});

// ── Site footer ──────────────────────────────────────────────────────────────────────────────────────────────
const FOOT_LINKS = ["Back to map", "All places", "Food help programs", "Food pantries", "SNAP and WIC stores", "Community gardens", "Blessing box list", "About", "Privacy", "Suggest a place", "Roadmap", "Place data includes © OpenStreetMap contributors"];
const credit = (cls = "") => `<p class="pg-credit">Designed, built and managed by <a class="${cls}" href="#site-footer"${sayMsg("Mockup: this would open thestyxgroup.com in a new tab.")}>The Styx Group</a></p>`;
const footer = (links = FOOT_LINKS, cls: Record<number, string> = {}) => `<footer class="pfm pg-foot"><div>${links.map((l, i) => `<a class="l${cls[i] ? ` ${cls[i]}` : ""}" href="#site-footer"${sayMsg(`Mockup: this would open ${l.startsWith("Place data") ? "the OpenStreetMap copyright page in a new tab" : l}.`)}>${l}</a>`).join("")}${credit()}</div></footer>`;

const footerEntry = entry({
  id: "site-footer", name: "Site footer (SiteFooter, StyxCredit)", status: "built",
  statusNote: "Shown as it is live today.",
  purpose: "The quiet row of links at the foot of every inside page: back to the map, the place lists, the hub pages, About, Privacy, Suggest, the Roadmap, the OpenStreetMap credit, and the line saying who built the site. It is how search engines reach every place page, because the map's own links only exist once its code runs. The map has no footer; the same credit line sits at the bottom of its Menu instead.",
  instead: [
    "It's a main way around the site: it belongs in the Menu or the bottom bar. The footer is the backup path, not the first one.",
    "It's about one page only: put it in that page's column, not in the footer every page shares.",
  ],
  versions:
    wide("The footer on a phone. The links wrap onto as many rows as the screen needs; the credit always gets a line of its own. Tap any link.", footer()),
  states:
    demo("Resting: ink 400", `<div class="pfm pg-foot pg-one"><div><a class="l" href="#site-footer">About</a></div></div>`) +
    demo("Pointer over it: the words darken to ink 700. No fill.", `<div class="pfm pg-foot pg-one"><div><a class="l is-hover" href="#site-footer">About</a></div></div>`) +
    demo("Reached by keyboard: an underline only. There is no ring.", `<div class="pfm pg-foot pg-one"><div><a class="l is-focus" href="#site-footer">About</a></div></div>`) +
    demo("The credit: underlined at rest, ink 700 under the pointer, a sage 500 ring by keyboard", `<div class="pfm pg-foot pg-one"><div>${credit()}${credit("is-hover")}${credit("is-focus")}</div></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The footer, the same paper as the page") +
    sw("Bone 200", "color-bone-200", `The line along its top. ${contrast(hex("color-bone-200"), PAPER).toFixed(1)} to 1, decoration only`) +
    swr("Ink 400", "color-ink-400", "Every link and the credit line at rest, 12 pixels") +
    swr("Ink 700", "color-ink-700", "A link under the pointer") +
    swr("Sage 500", "color-sage-500", "Keyboard ring on the credit link only", "color-bone-50", 3),
  sizes: "One column 512 pixels wide at most, 16 pixels in from the sides, 8 above and below. Links are 12 pixels and each is at least 48 by 48 to tap (short words like About get their width from that floor), 16 pixels apart side by side and 8 between rows. The credit line is 12 pixels, full width, under the links. At 360 pixels wide the links take about five rows.",
  wording: [
    "Each link is the page's own name, short: All places, Food help programs, Blessing box list. Spanish: Todos los lugares, Programas de ayuda alimentaria, Lista de cajas de bendiciones.",
    "The credit reads Designed, built and managed by The Styx Group, word for word on every page and in the Menu. Spanish: Diseñado, creado y administrado por The Styx Group.",
    "The OpenStreetMap line is a license requirement: Place data includes © OpenStreetMap contributors. Never shorten it.",
  ],
  everyone: [
    "Keyboard: every link is reachable in reading order. A link shows an underline when Tab reaches it; the credit link shows a ring.",
    "Screen reader: it is the page's footer landmark. The OpenStreetMap and Styx links open a new tab.",
    "Touch: every link is at least 48 by 48 with 8 pixels between rows. The Styx link sits inside a sentence, so it keeps the sentence's size; that is allowed for a link inside a line of words.",
  ],
  dd: dodont(
    [`<div style="width:100%">${footer(["Back to map", "All places", "About", "Privacy"])}</div>`, "Short page names, each one a big tap area, wrapping as the screen needs."],
    [`<div style="width:100%"><footer class="pfm pg-foot pg-tight"><div>${["Back to map", "All places", "About", "Privacy"].map((l) => `<a class="l" href="#site-footer">${l}</a>`).join(" | ")}</div></footer></div>`, "Links squeezed onto one line with bars between them. Each is only as tall as its words, about 16 pixels, far too small to tap."],
  ),
  code: [
    "src/components/SiteFooter.tsx (LINK_CLASS)",
    "src/components/StyxCredit.tsx (also at the foot of the Menu, HamburgerMenuContent.tsx)",
  ],
});

// ── Language switch ──────────────────────────────────────────────────────────────────────────────────────────
const LANG_TAP = `const g=this.parentElement;g.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===this?'true':'false'))`;
const langToggle = (o: { on?: "en" | "es"; cls?: Partial<Record<"en" | "es", string>>; live?: boolean; label?: string } = {}) => {
  const on = o.on ?? "en";
  const seg = (l: "en" | "es") =>
    `<button type="button" class="pg-seg${o.cls?.[l] ? ` ${o.cls[l]}` : ""}" aria-pressed="${on === l}" aria-label="Language: ${l === "en" ? "English" : "Spanish"}"${o.live ? ` onclick="${q(LANG_TAP)}"${sayMsg(l === "en" ? "Mockup: the page would switch to English." : "Mockup: the page would switch to Spanish.")}` : ""}>${l.toUpperCase()}</button>`;
  return `<div class="pg-lang" role="group" aria-label="${o.label ?? "Language selection"}">${seg("en")}${seg("es")}</div>`;
};
const langRow = (toggle: string) => `<div class="pfm pg-langrow"><span>Language / Idioma</span>${toggle}</div>`;

const langEntry = entry({
  id: "language", name: "Language switch (LanguageToggle)", status: "changing",
  statusNote: "What changes: the brightening on hover goes. The other choice keeps darkening its words. Everything else is the switch as it is live today.",
  purpose: "Switches the site between English and Spanish. It is a small two-part pill: the language you are reading is filled in dark ink, the other is plain. It lives in the Menu, on the Language / Idioma row near the foot.",
  instead: [
    "It's a choice between two or three options inside a form or panel: use the slider (segmented radios) on the Foundations and admin pages.",
    "It's the event page: it shows one link in the top bar to the same event in the other language (Ver en español). See Event page below.",
  ],
  versions:
    wide("In the Menu, on its own row. Tap EN or ES.", langRow(langToggle({ live: true }))) +
    demo("Reading in Spanish: ES is filled", langToggle({ on: "es", label: "Language selection, Spanish on" })),
  states:
    demo("Resting: EN on, ES plain", langToggle({ label: "Resting" })) +
    demo("Pointer over ES: its words darken to ink 700. No fill and, in the redesign, no brightening. Point at ES in any of these.", langToggle({ cls: { es: "is-hover" }, label: "Pointer over ES" })) +
    demo("Reached by keyboard: a sage 500 ring inside the part", langToggle({ cls: { es: "is-focus" }, label: "Keyboard on ES" })) +
    demo("Keyboard on the filled part: the same ring, on ink 700", langToggle({ cls: { en: "is-focus" }, label: "Keyboard on EN" })),
  colors:
    sw("Bone 100", "color-bone-100", "The pill behind both parts") +
    sw("Bone 300", "color-bone-300", `The pill's edge. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1 on the Menu's bone 50, decoration only: the words carry it`) +
    sw("Ink 700", "color-ink-700", `The filled part. Bone 50 words on it ${ratio(PAPER, hex("color-ink-700"))}`) +
    swr("Ink 500", "color-ink-500", "The other part's words at rest", "color-bone-100", 4.5, "bone 100") +
    swr("Ink 700", "color-ink-700", "The other part's words under the pointer", "color-bone-100", 4.5, "bone 100") +
    sw("Sage 500", "color-sage-500", `Keyboard ring, drawn inside the part. ${r("color-sage-500", "color-bone-100", 3)} on bone 100, ${r("color-sage-500", "color-ink-700", 3)} on the ink 700 fill (edge)`),
  sizes: "28 pixels tall overall, fully round. Each part is 12 pixels in from its sides with 12-pixel bold capitals. Each part taps at 48 by 48: the tap area reaches 11 pixels above and below, and 10 pixels outward on the outer ends, so the two still meet in the middle. The Menu row is 20 pixels in from the sides and 12 above and below, with Language / Idioma in 14-pixel medium ink 700.",
  wording: [
    "EN and ES, capitals, never flags or country codes. Screen readers hear Language: English and Language: Spanish.",
    "The row label is in both languages, Language / Idioma, so someone who reads only one can find it.",
  ],
  everyone: [
    "Keyboard: Tab reaches each part; Enter or Space switches.",
    "Screen reader: a group called Language selection; the part you are reading says pressed. On a page that has a Spanish twin, the other language is a real link to that page, and says current when it is the one shown.",
    "Touch: each part taps at 48 by 48 though it looks 26 tall.",
    "Color is never the only sign: the part you are reading is filled and is announced as pressed.",
  ],
  dd: dodont(
    [langRow(langToggle({ label: "Do example" })), "EN and ES, with the row label in both languages."],
    [`<div class="pfm pg-langrow"><span>Language</span><div class="pg-lang" role="group" aria-label="Don't example"><button type="button" class="pg-seg" aria-pressed="true">US</button><button type="button" class="pg-seg" aria-pressed="false">MX</button></div></div>`, "Country codes and an English-only label. A country is not a language, and someone who reads only Spanish may not find the row."],
  ),
  code: [
    "src/components/LanguageToggle.tsx. Known live issue for the site fix: SEGMENT_CLASS adds PRESS_FEEDBACK from src/lib/interactionStyles.ts (LanguageToggle.tsx:61), the hover:brightness-105 that the redesign drops",
    "Placed in src/components/HamburgerMenuContent.tsx (the Language / Idioma row)",
  ],
});

// ── Hub page list rows ───────────────────────────────────────────────────────────────────────────────────────
type Row = { name: string; address?: string; lines?: string[]; ben?: string; label?: string };
const placeLink = (name: string, cls = "") => `<a class="pg-place${cls ? ` ${cls}` : ""}" href="#hub-rows"${sayMsg("Mockup: this would open the place's own page.")}>${name}</a>`;
const row = (x: Row, cls = "") => `<li>${placeLink(x.name, cls)}${x.address ? `<p class="pg-det">${x.address}</p>` : ""}${(x.lines ?? []).map((l) => `<p class="pg-det mt">${l}</p>`).join("")}${x.label ?? ""}${x.ben ? `<p class="pg-ben">${x.ben}</p>` : ""}</li>`;
const list = (rows: Row[], cls = "") => `<ul class="pg-list">${rows.map((x) => row(x, cls)).join("")}</ul>`;
/** The chosen category label (main Components page): category word in its color, then SNAP and WIC, middle dots. */
const labelLine = (cat: string, label: string, benefits: string[]) =>
  `<p class="pfm-lab pg-lab2"><span style="color:var(--color-cat-${cat})">${label}</span>${benefits.map((t) => `<span class="dot" aria-hidden="true">·</span><span class="sr">, </span><span class="ben">${t}</span>`).join("")}</p>`;
const PANTRIES: Row[] = [
  { name: "Eastside Community Pantry", address: "100 Example Ave, Pueblo, CO 81001", lines: ["Hours: Tuesday to Wednesday, 9am – 1pm; Thursdays, 2pm – 6pm."] },
  { name: "Mesa Street Food Shelf", address: "200 Sample St, Pueblo, CO 81003", lines: ["Hours not listed. Check before you go."] },
];
const SNAPWIC_LIVE: Row[] = [
  { name: "Northgate Grocery Market", address: "300 Example Blvd, Pueblo, CO 81004", lines: ["Grocery / Supermarket"], ben: "Accepts SNAP/EBT · Accepts WIC" },
  { name: "Corner Stop Market", address: "400 Sample Rd, Pueblo, CO 81005", lines: ["Convenience Store"], ben: "Accepts SNAP/EBT" },
];
const SNAPWIC_NEW: Row[] = [
  { name: "Northgate Grocery Market", address: "300 Example Blvd, Pueblo, CO 81004", label: labelLine("grocery", "Grocery / Supermarket", ["SNAP", "WIC"]) },
  { name: "Corner Stop Market", address: "400 Sample Rd, Pueblo, CO 81005", label: labelLine("convenience", "Convenience Store", ["SNAP"]) },
];
const listBox = (inner: string) => `<div class="pfm pg-page pg-pad">${inner}</div>`;

const hubEntry = entry({
  id: "hub-rows", name: "Hub page list rows (HubPages, VenuesDirectoryContent)", status: "changing",
  statusNote: "What changes, on the SNAP and WIC stores page only: the category and the SNAP and WIC words join on one line under the address, as the chosen category label (Grocery / Supermarket · SNAP · WIC). The other hub pages and All places stay as they are live today.",
  purpose: "A plain list of places, one under another: the name as a big green link to the place's own page, then its address, then one line of hours or what it takes. No pictures and no map, so it loads fast on an older phone. The four hub pages (Food pantries, SNAP and WIC stores, Community gardens, Blessing boxes) and All places use it. Blessing box names open the box's card on the map instead.",
  instead: [
    "It's on the map: use the place card, which has directions, hours and save.",
    "It's a short list of pages, not places (Browse by topic on All places): the same green link, with no lines under it.",
  ],
  versions:
    wide("Food pantries and Community gardens: name, address, then hours in a sentence, or the honest line when we have none.", listBox(list(PANTRIES))) +
    wide("SNAP and WIC stores, in the redesign: the category label under the address.", listBox(list(SNAPWIC_NEW))) +
    wide("SNAP and WIC stores, live today, for comparison: the category in grey, then what it accepts in bold on its own line.", listBox(list(SNAPWIC_LIVE))) +
    wide("Blessing boxes: the name opens the box on the map; a status line shows only when check-ins say something.", listBox(list([{ name: "Elm Street Blessing Box", address: "500 Example Ct, Pueblo, CO 81001", lines: ["Status: Running low"] }, { name: "Park Avenue Blessing Box", address: "600 Sample Way, Pueblo, CO 81003" }]))) +
    wide("All places: grouped under the category name, every day's hours on one line. The name link is only as tall as its words (see Lives in).", listBox(`<h2 class="pg-h2">Food Pantry</h2>${list([{ name: "Eastside Community Pantry", address: "100 Example Ave, Pueblo, CO 81001", lines: ["Tue 9am – 1pm · Wed 9am – 1pm · Thu 2pm – 6pm"] }], "short")}`)),
  states:
    demo("Name, resting: sage 600", listBox(list([{ name: "Eastside Community Pantry" }]))) +
    demo("Pointer over it: the words darken to sage 700. No fill.", listBox(list([{ name: "Eastside Community Pantry" }], "is-hover"))) +
    demo("Reached by keyboard: a sage 500 ring", listBox(list([{ name: "Eastside Community Pantry" }], "is-focus"))) +
    demo("No hours known: the line says so, never made-up hours", listBox(list([{ name: "Mesa Street Food Shelf", lines: ["Hours not listed. Check before you go."] }]))),
  colors:
    sw("Bone 50", "color-bone-50", "The page") +
    swr("Sage 600", "color-sage-600", "Place names at rest") +
    swr("Sage 700", "color-sage-700", "Place names under the pointer; SNAP and WIC in the redesigned label") +
    swr("Sage 500", "color-sage-500", "Keyboard ring", "color-bone-50", 3) +
    swr("Ink 500", "color-ink-500", "Address, hours, status, and today the category") +
    swr("Ink 700", "color-ink-700", "Section headings on All places and Community gardens; today the bold Accepts line") +
    swr("Ink 400", "color-ink-400", "The middle dots in the redesigned label") +
    sw("Category colors", "color-cat-grocery", `The category word in the redesigned label. Grocery ${r("color-cat-grocery", "color-bone-50")}, convenience ${r("color-cat-convenience", "color-bone-50")} on bone 50; every category passes (main Components page, Chosen: label under the name)`),
  sizes: "Rows are 16 pixels apart. Name: Public Sans 16, semi-bold, at least 48 pixels tall to tap (not on All places). Address and hours: 14 pixels, 2 pixels between lines. The redesigned label: 14 pixels, semi-bold, as on the place card. Section headings: 18 pixels, semi-bold, 8 above the list.",
  wording: [
    "Hours read as a sentence on the hub pages: Hours: Tuesday to Wednesday, 9am – 1pm; Thursdays, 2pm – 6pm. All places uses the short form, every day listed: Tue 9am – 1pm · Wed 9am – 1pm.",
    "With no hours, say so plainly: Hours not listed. Check before you go. Never guess hours.",
    "SNAP or WIC only when the place is confirmed to take it. Never write that a place does not.",
    "Blessing boxes never say free: a box is not on the free list.",
  ],
  everyone: [
    "Keyboard: names are reached in reading order, one Tab each; the lines under them are plain words.",
    "Screen reader: a real list, so it hears how many places there are. Each section on All places and Community gardens has its own heading. In the redesigned label the dots are hidden and a comma is read instead.",
    "Touch: on the hub pages each name is 48 pixels tall. On All places it is only as tall as its words (see Lives in).",
  ],
  dd: dodont(
    [listBox(list([PANTRIES[1]])), "When there are no hours, say so in words the visitor can act on."],
    [listBox(list([{ name: "Mesa Street Food Shelf", address: "200 Sample St, Pueblo, CO 81003", lines: ["Open daily"] }])), "A guess like Open daily. Someone walks there and finds it shut."],
  ),
  code: [
    "src/components/HubPages.tsx (PLACE_LINK_CLASS, DETAIL_CLASS, PlaceItem). Change: SnapWicHub's two lines (HubPages.tsx:170-171) become the one category label",
    "src/components/VenuesDirectoryContent.tsx",
    "Rules for which places show and in what order: src/lib/hubPages.ts",
    "Known live issue: on All places the name link has no min-h-12, so it taps at about 24 pixels tall (VenuesDirectoryContent.tsx:127-133); the hub pages' links are 48",
  ],
});

// ── Questions and answers ────────────────────────────────────────────────────────────────────────────────────
const QA: [string, string][] = [
  ["What is a food pantry?", "A food pantry gives groceries to people who need them, usually at no cost. Many are run by churches, community groups and nonprofits."],
  ["How often can I go?", "Each pantry sets its own limits. Ask what they are when you call or visit."],
];
const faq = (items = QA, heading = "How food pantries work") => `<section class="pfm pg-page pg-pad" aria-label="${q(heading)}"><h2 class="pg-h2 faq">${heading}</h2><div class="pg-qa">${items.map(([qq, a]) => `<div><h3 class="pg-q">${qq}</h3><p class="pg-a">${a}</p></div>`).join("")}</div></section>`;

const faqEntry = entry({
  id: "faq", name: "Questions and answers (FaqList, FaqSection)", status: "built",
  statusNote: "Shown as it is live today, with the pantry page's real questions.",
  purpose: "A short block of common questions, each one a small heading with its answer underneath, always open. It sits near the end of the About, Food help programs and Food pantries pages. Search engines read the same questions, so every answer must be true and match the page word for word.",
  instead: [
    "It's a long list of programs where people look for one: use the open-and-close cards on the Food help programs page.",
    "It's one instruction: write it in the page's own words, not as a question.",
  ],
  versions:
    wide("The block on the Food pantries page", faq()),
  states:
    demo("There is only one state: always open, nothing to press", faq([QA[1]], "Questions")),
  colors:
    swr("Ink 700", "color-ink-700", "The heading, the questions and the answers") +
    sw("Bone 50", "color-bone-50", "The page"),
  sizes: "Heading: 18 pixels, semi-bold, 12 above the first question. Question: 16 pixels, semi-bold, 4 above its answer. Answer: 14 pixels with roomy line spacing. 24 pixels between one answer and the next question.",
  wording: [
    "Questions in the visitor's own words, as they would ask them: How often can I go?",
    "Answers start with the answer, then the detail. No marketing words.",
    "Keep the block short: About has six questions, Food pantries and Food help programs four each.",
  ],
  everyone: [
    "Keyboard: nothing to press, so Tab skips it.",
    "Screen reader: the block has its own heading, and each question is a heading under it, so it can be skimmed by headings.",
    "Everything is visible at once, with nothing hidden behind a tap.",
  ],
  dd: dodont(
    [faq([QA[1]], "Questions"), "The question as a visitor would ask it, the answer in the first words."],
    [faq([["Frequency policy", "Visit frequency is determined at the discretion of each partner agency in accordance with its own guidelines."]], "FAQ"), "Office words. The visitor still doesn't know if they can come back next week."],
  ),
  code: [
    "src/components/FaqList.tsx (the visible block; About and Food help programs use it alone)",
    "src/components/FaqSection.tsx (the pantry page: the same block plus the search-engine copy, built from the same list so the two can't differ)",
    "Questions and answers: src/lib/faqItems.ts and the i18n files",
  ],
});

// ── Public form fields and buttons ───────────────────────────────────────────────────────────────────────────
type Fld = { id: string; label: string; req?: boolean; err?: string; hint?: string; cls?: string; ctrl?: "input" | "textarea" | "select"; value?: string; ph?: string; options?: string[] };
const field = (f: Fld) => {
  const c = `pg-in${f.err ? " err" : ""}${f.cls ? ` ${f.cls}` : ""}`;
  const aria = `${f.req ? ' aria-required="true"' : ""}${f.err ? ` aria-invalid="true" aria-describedby="${f.id}-e"` : f.hint ? ` aria-describedby="${f.id}-h"` : ""}`;
  const ctrl = f.ctrl === "textarea"
    ? `<textarea id="${f.id}" class="${c} ta" rows="3" placeholder="${q(f.ph ?? "")}"${aria}>${f.value ?? ""}</textarea>`
    : f.ctrl === "select"
      ? `<select id="${f.id}" class="${c}"${aria}>${(f.options ?? []).map((o, i) => `<option${i === 0 ? ' value=""' : ""}${o === f.value ? " selected" : ""}>${o}</option>`).join("")}</select>`
      : `<input id="${f.id}" type="text" class="${c}" value="${q(f.value ?? "")}" placeholder="${q(f.ph ?? "")}"${aria}>`;
  return `<div><label for="${f.id}" class="pg-lab">${f.label}${f.req ? ' <span aria-hidden="true" class="star">*</span>' : ""}</label>${ctrl}${f.err ? `<p id="${f.id}-e" role="alert" class="pg-err">${f.err}</p>` : f.hint ? `<p id="${f.id}-h" class="pg-hint">${f.hint}</p>` : ""}</div>`;
};
const CATS = ["Select a category", "Food Pantry", "Grocery / Supermarket", "Convenience Store", "Farm / Market", "Community Garden", "Edible Landscape", "Meal Site", "Blessing Box"];
const checks = (id: string) => `<fieldset class="pg-fs"><legend class="pg-lab lg">Accepted benefits</legend><label class="pg-cb"><input type="checkbox" id="${id}-snap">Accepts SNAP</label><label class="pg-cb"><input type="checkbox" id="${id}-wic" checked>Accepts WIC</label></fieldset>`;
const turnstile = `<div class="pg-ts" aria-hidden="true">Cloudflare's own check box draws here, about 300 by 65 pixels. Its look is Cloudflare's, so it isn't copied.</div>`;
const SEND_TAP = `const b=this;b.disabled=true;b.textContent='Sending…';setTimeout(()=>{b.disabled=false;b.textContent='Submit suggestion'},1600)`;
const send = (o: { label?: string; dis?: boolean; cls?: string; live?: boolean } = {}) =>
  `<button type="${o.live ? "button" : "button"}" class="pg-send${o.cls ? ` ${o.cls}` : ""}"${o.dis ? ' disabled aria-disabled="true"' : ""}${o.live ? ` onclick="${q(SEND_TAP)}"${sayMsg("Mockup: nothing is sent.")}` : ""}>${o.label ?? "Submit suggestion"}</button>`;
const retry = (cls = "") => `<button type="button" class="pg-retry${cls ? ` ${cls}` : ""}">Try again</button>`;
const banner = `<div role="alert" class="pg-banner"><p class="pg-bt">Something went wrong</p><p class="pg-bb">Your suggestion couldn't be sent. Please try again, or email us directly at suggestions@example.com.</p></div>`;
const success = `<div role="status" class="pg-ok"><h2>Thank you!</h2><p>Your suggestion has been submitted. We review all suggestions and will add verified places to the map.</p><a class="pg-okbtn" href="#forms"${sayMsg("Mockup: this would go back to the map.")}>Back to map</a></div>`;
const form = (inner: string) => `<div class="pfm pg-page pg-pad"><div class="pg-form">${inner}</div></div>`;

const formEntry = entry({
  id: "forms", name: "Public form fields and buttons (PublicForm)", status: "changing",
  statusNote: "What changes: Try again, the button that shows after a failed send, gets the light green tint (sage 100) under the pointer in place of the grey. Everything else is the form as it is live today.",
  purpose: "The fields, the send button and the messages every public page form shares: Suggest a place, Report an issue, Send us feedback and Share an event. One shell runs them all: it checks the fields, waits for Cloudflare's are-you-human check, sends, then shows either a thank-you or a plain error with Try again, keeping what was typed.",
  instead: [
    "It's a form inside a blessing box card (Adopt this box, Get alerts): those use their own copy of these styles (see Lives in) and the card's buttons.",
    "It's an admin form: the admin uses a second copy of the field styles (see Lives in).",
    "It's one tap, like a check-in: use a button, not a form.",
  ],
  versions:
    wide("The Suggest a place form, shortened. Type in the boxes; pick a category; tap Submit suggestion to see it send.", form(
      field({ id: "pf-name", label: "Place name", req: true, ph: "e.g. Eastside Food Pantry" }) +
      field({ id: "pf-cat", label: "Category", req: true, ctrl: "select", options: CATS }) +
      checks("pf") +
      field({ id: "pf-notes", label: "Additional notes (optional)", ctrl: "textarea", ph: "Anything else we should know?" }) +
      field({ id: "pf-email", label: "Your email", req: true, ph: "email@example.com", hint: "Only used if we need to follow up with you." }) +
      turnstile + send({ live: true }))) +
    wide("Sent: the form is replaced by the thank-you", form(success)) +
    wide("The send failed: a red message on top, the typed words kept, and Try again under the send button", form(banner + field({ id: "pf-name2", label: "Place name", req: true, value: "Eastside Community Pantry" }) + send() + retry())),
  states:
    demo("Text box, resting", form(field({ id: "s1", label: "Place name", req: true, ph: "e.g. Eastside Food Pantry" }))) +
    demo("Reached by keyboard or tapped into: a sage 500 ring and edge", form(field({ id: "s2", label: "Place name", req: true, value: "Eastside", cls: "is-focus" }))) +
    demo("Error: a red edge and the reason under it", form(field({ id: "s3", label: "Place name", req: true, err: "Please enter a place name." }))) +
    demo("With a hint under it", form(field({ id: "s4", label: "Your email", req: true, ph: "email@example.com", hint: "Only used if we need to follow up with you." }))) +
    demo("Send, resting", form(send())) +
    demo("Send, pointer over it: darkens to sage 700. Point at any send button.", form(send({ cls: "is-hover" }))) +
    demo("Send, reached by keyboard: a sage 500 ring with a gap", form(send({ cls: "is-focus" }))) +
    demo("Waiting for the check: faded, words say Verifying…, can't be pressed", form(send({ dis: true, label: "Verifying…" }))) +
    demo("Working: faded, words say Sending…", form(send({ dis: true, label: "Sending…" }))) +
    demo("The check failed: the red line under it", form(`<div>${turnstile}<p role="alert" class="pg-err">Couldn't verify you're human — please retry.</p></div>`)) +
    demo("Try again, pointer over it: light green tint (proposed; live is grey). Point at it.", form(retry("is-hover"))),
  colors:
    sw("White", "white", "Inside every field and the error box") +
    sw("Bone 300", "color-bone-300", `Field edge at rest. ${r("color-bone-300", "white", 3)} on white (edge): too faint to show where a box is (see Lives in)`) +
    swr("Ink 700", "color-ink-700", "Labels, the checkbox words, Try again", "white", 4.5, "white") +
    swr("Ink 900", "color-ink-900", "Typed words", "white", 4.5, "white") +
    swr("Ink 400", "color-ink-400", "Hints and placeholder words; on the page bone 50 it is " + r("color-ink-400", "color-bone-50"), "white", 4.5, "white") +
    swr("Danger red", "color-danger", "The required star, the error edge and words, the error box", "white", 4.5, "white") +
    swr("Sage 500", "color-sage-500", "Keyboard ring and the edge of the field you are in", "white", 3, "white") +
    sw("Sage 600", "color-sage-600", `Send fill. Bone 50 words on it ${ratio(PAPER, hex("color-sage-600"))}; under the pointer sage 700, ${ratio(PAPER, hex("color-sage-700"))}. Faded while waiting or sending, the words drop to 2.8 to 1 ✗ (allowed for a button that can't be pressed, but Verifying… is the only word that says what is happening)`) +
    sw("Sage 100", "color-sage-100", `Try again under the pointer (proposed; live is bone 100). Ink 700 on it ${r("color-ink-700", "color-sage-100")}`),
  sizes: "Fields fill the column, 10-pixel corners, 12 pixels in from the sides and 8 above and below. Typed words are 16 pixels on a phone (so iPhones don't zoom in) and 14 on a computer, which makes a box about 42 pixels tall on a phone and 38 on a computer. Labels 14 pixels medium, 4 above the box; hints and errors 12 pixels, 4 below. Fields are 24 pixels apart. Notes box at least 72 pixels, and it can be pulled taller. Checkboxes are the phone's own, 16 pixels, 8 apart. Send and Try again: full width, 48 tall, 16-pixel words. The thank-you sits 48 pixels from the top; its Back to map button is 64 pixels tall (its h-10 class reads 64 here, see the note at the top of this page's code). Error box: 16 pixels in, 12 above and below.",
  wording: [
    "Labels name the thing in two or three words. Optional fields say (optional) in the label: Hours (optional). Required fields carry a red star.",
    "The send button says what it sends: Submit suggestion, Send feedback, Submit report, Send for review. While it works it reads Sending… (Spanish: Enviando…), and Verifying… while the check runs.",
    "Errors say what to do: Please enter a place name. Please enter a valid email address.",
    "The thank-you says what happens next: We review all suggestions and will add verified places to the map.",
    "Every email box has the privacy line under it: Your email is used only to follow up on your submission. It is never sold or shared.",
  ],
  everyone: [
    "Keyboard: fields go top to bottom. A failed check moves the keyboard to the first error, so a screen reader hears it at once.",
    "Screen reader: each box has its label; required boxes say required; an error is linked to its box and read aloud; the checkboxes sit in a group called Accepted benefits; the thank-you and the error box are announced.",
    "Touch: the send button is 48 tall. The fields and the checkboxes are smaller than the 48-pixel floor (see Lives in).",
    "A hidden box catches robots; people never see it, and the keyboard skips it.",
    "Color is never the only sign: every error has words, and the required star is backed by the screen reader's required.",
  ],
  dd: dodont(
    [form(field({ id: "dd1", label: "Your email", req: true, err: "Please enter a valid email address." })), "Say what is wrong and how to fix it, right under the box."],
    [form(field({ id: "dd2", label: "Your email", req: true, err: "Invalid input." })), "A reason that doesn't help. The visitor can't tell what to change."],
  ),
  code: [
    "src/components/PublicForm.tsx (Field, INPUT_BASE, the send and Try again buttons, the thank-you, the error box). Change: Try again's hover:bg-bone-100 (PublicForm.tsx:323) becomes sage 100",
    "Used by SuggestForm.tsx, ReportForm.tsx, FeedbackForm.tsx, ShareEventForm.tsx",
    "The box card forms, AdoptBoxForm.tsx and BoxAlertSignupForm.tsx, do not use PublicForm: their own field classes, PRIMARY_BTN and SECONDARY_BTN from BoxCheckinPanel.tsx:177-182, and CardFormTurnstile.tsx (an invisible check that only shows Cloudflare's box when it doubts someone)",
    "Known live issue: the admin forms use a second, separate copy of the field styles, src/components/formClasses.ts (inputBase, line 8). There are two more: BoxNumbersPanel.tsx:37 (SELECT_CLASS) and the inline field classes in AdoptBoxForm.tsx:177 and BoxAlertSignupForm.tsx:162. Four copies of one look",
    "Known live issue: fields are about 42 pixels tall on a phone and 38 on a computer, under the 48-pixel floor (PublicForm.tsx:33)",
    "Known live issue: the checkboxes are the phone's own 16-pixel box, and the row they sit in is about 20 pixels tall to tap (SuggestForm.tsx:36)",
    "Known live issue: the field edge, bone 300 on white, is 1.6 to 1; an edge needs 3 to 1 (PublicForm.tsx:81)",
    "Known live issue: the box card forms' labels are 12 pixels (AdoptBoxForm.tsx:166)",
  ],
});

// ── Box numbers and activity ─────────────────────────────────────────────────────────────────────────────────
const dl = (rows: [string, string][]) => `<dl class="pg-rows">${rows.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
const numbers = `<div class="pfm pg-page pg-pad"><div class="pg-num">
  <div class="pg-sel"><label for="bn-period" class="pg-flab">Time period</label><select id="bn-period" class="pg-in"><option>Last 7 days</option><option selected>Last 30 days</option><option>Last 90 days</option><option>All time</option></select></div>
  ${dl([["Fills", "14"], ["Uses (“I used this box”)", "31"], ["Empty reports", "3"], ["Low reports", "5"], ["Total check-ins", "53"], ["Shared photos", "4"]])}
  <div><h3 class="pg-h3">Typical timing</h3>${dl([["Empty to next fill", "2 days"], ["Fill to next fill", "3 days"], ["Fill to next empty", "4 days"]])}</div>
  <p class="pg-honest">These numbers count check-ins, not every visit — so “uses” reads lower than real foot traffic, on purpose.</p></div></div>`;
const milestones = `<div class="pfm pg-page pg-pad"><h2 class="pg-ms">Milestones</h2><ul class="pg-msl"><li>Pueblo has filled its blessing boxes 100+ times</li><li>Neighbors have used Pueblo's blessing boxes 250+ times</li></ul></div>`;
type Act = { line: string; when: string; detail?: string; photo?: boolean };
const pager = (o: { prevDis?: boolean; cls?: string } = {}) => `<div class="pg-pager"><button type="button" class="pg-pg${o.cls ?? ""}"${o.prevDis ? " disabled" : ""}${sayMsg("Mockup: this would show the page before.")}>Previous</button><button type="button" class="pg-pg"${sayMsg("Mockup: this would show the next page.")}>Next</button></div>`;
const activity = (items: Act[], o: { count?: boolean; pager?: boolean } = {}) => `<div class="pfm pg-page pg-pad"><div class="pg-act">${o.count === false ? "" : `<p class="pg-count" aria-live="polite">${items.length} results</p>`}
  <ul class="pg-acl">${items.map((a) => `<li><p>${a.line}<span> · ${a.when}</span></p>${a.detail ? `<p class="d">${a.detail}</p>` : ""}${a.photo ? `<button type="button" class="pg-thumb" aria-label="View the photo from ${a.when} full size"${sayMsg("Mockup: this would open the photo full size.")}></button>` : ""}</li>`).join("")}</ul>
  ${o.pager === false ? "" : pager({ prevDis: true })}</div></div>`;
const ACTS: Act[] = [
  { line: "Elm Street Blessing Box was filled", when: "3 hours ago", detail: "Canned soup and diapers" },
  { line: "Someone used Park Avenue Blessing Box", when: "yesterday" },
  { line: "Elm Street Blessing Box is running low", when: "Oct 28" },
];

const boxEntry = entry({
  id: "box-numbers", name: "Box numbers and activity (BoxNumbersPanel, BoxActivityList, BoxMilestones)", status: "changing",
  statusNote: "What changes: Previous and Next get the light green tint (sage 100) under the pointer in place of the grey. Everything else is as it is live today, with made-up boxes and numbers.",
  purpose: "How the blessing boxes are doing, in words and plain numbers. The Numbers block counts fills, uses and reports for a time period you pick, with how long things usually take. The activity list is the latest check-ins and changes, newest first, a page at a time. Milestones is one or two proud lines once the town passes a round number. They sit on Blessing box activity (every box) and on one box's History page.",
  instead: [
    "It's one box's current state (stocked, low, empty): that is on the box card on the map.",
    "It's a chart: there are none on purpose. Plain rows read on any phone and to a screen reader.",
  ],
  versions:
    wide("Numbers, on one box's History page. Pick another period; the numbers change in place, with nothing loading.", numbers) +
    wide("Activity, on Blessing box activity: the count, the lines, Previous and Next", activity(ACTS)) +
    wide("Activity on one box's History page: This box in place of the name, and a photo when one was added", activity([{ line: "A new photo was added", when: "2 days ago", photo: true }, { line: "This box was filled", when: "Oct 30" }], { count: false, pager: false })) +
    wide("Milestones, on Blessing box activity only. With no milestone yet, the block doesn't show at all.", milestones),
  states:
    demo("Previous and Next, resting", activity([], { count: false }).replace("pg-pager", "pg-pager pg-only").replace(" disabled", "")) +
    demo("Pointer over it: light green tint (proposed; live is grey). Point at either.", activity([], { count: false }).replace("pg-pager", "pg-pager pg-only").replace(' class="pg-pg" disabled', ' class="pg-pg is-hover"')) +
    demo("Reached by keyboard: the browser's own outline. These buttons have no ring of their own.", activity([], { count: false }).replace("pg-pager", "pg-pager pg-only").replace(' class="pg-pg" disabled', ' class="pg-pg is-focus"')) +
    demo("Can't go back from the first page: faded", activity([], { count: false }).replace("pg-pager", "pg-pager pg-only")) +
    demo("Working: the count line says Loading… until the first page arrives", `<div class="pfm pg-page pg-pad"><p class="pg-count">Loading…</p></div>`) +
    demo("Nothing yet", `<div class="pfm pg-page pg-pad"><p class="pg-count">No activity at this box yet.</p></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The page") +
    sw("Bone 200", "color-bone-200", `Lines between rows and around the photo. ${contrast(hex("color-bone-200"), PAPER).toFixed(1)} to 1, decoration only`) +
    swr("Ink 900", "color-ink-900", "Numbers, activity lines, Typical timing, Milestones") +
    swr("Ink 700", "color-ink-700", "Row labels, milestone lines, Previous and Next") +
    swr("Ink 500", "color-ink-500", "The count, details under a line, the note about what is counted") +
    swr("Ink 400", "color-ink-400", "When it happened, after the line") +
    sw("Bone 300", "color-bone-300", `Previous, Next and the period box edges. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1: the words carry the buttons, but the period box needs its edge (see Lives in)`) +
    sw("Sage 100", "color-sage-100", `Previous and Next under the pointer (proposed; live is bone 100). Ink 700 on it ${r("color-ink-700", "color-sage-100")}. Faded, the words drop to 3.0 to 1 ✗, allowed for a button that can't be pressed`),
  sizes: "Rows: 14-pixel label left, 14-pixel medium number right, 8 above and below, a 1-pixel line between. Blocks 16 apart. Period box: 320 pixels wide at most, the same size as the form fields, with a 12-pixel label. Activity lines: 14 pixels, 12 apart with a line between; details 12 pixels; a photo is a 64-pixel square, 6 below its line. Previous and Next: 48 tall, 16 in from their sides, at the two ends of the row. Milestones heading: Fraunces 18; lines 14, 4 apart.",
  wording: [
    "Lines say what happened, in plain past tense: Elm Street Blessing Box was filled. Someone used Park Avenue Blessing Box. Never who, except a sponsor by the name they chose.",
    "Times within a week are relative (3 hours ago, yesterday); older ones are a short date (Oct 28).",
    "Numbers are counts of check-ins, and the note under them says so, so nobody reads uses as every visitor.",
    "Previous and Next, not Load more. Spanish: Anterior, Siguiente.",
  ],
  everyone: [
    "Keyboard: the period box, then Previous and Next, then each photo, in reading order. Previous and Next show the browser's own outline when Tab reaches them.",
    "Screen reader: the numbers are label and value pairs, read as Fills, 14. Only the count line is announced when the list changes, not the whole list again. A photo button says View the photo from 2 days ago full size.",
    "Touch: Previous, Next and the photos are 48 pixels or more. The period box is smaller (see Lives in).",
  ],
  dd: dodont(
    [`<div class="pfm pg-page pg-pad" style="width:100%">${dl([["Fills", "14"], ["Empty reports", "3"]])}</div>`, "A plain row per number, the label in words."],
    [`<div class="pfm pg-page pg-pad pg-tiles" style="width:100%"><div><b>14</b><small>F</small></div><div><b>3</b><small>ER</small></div></div>`, "Big number tiles with short codes. Nobody knows what ER means, and the tiles read as a jumble to a screen reader."],
  ),
  code: [
    "src/components/BoxNumbersPanel.tsx (Row, FIELD_LABEL, SELECT_CLASS)",
    "src/components/BoxActivityList.tsx (BoxActivityList and PagedBoxActivityList). Change: Previous and Next hover:bg-bone-100 (BoxActivityList.tsx:192, :200) becomes sage 100",
    "src/components/BoxMilestones.tsx",
    "Shown on BoxesActivityContent.tsx (/boxes/activity) and BoxHistoryContent.tsx (/box/&lt;id&gt;/history)",
    "Known live issue: the period box is about 42 pixels tall on a phone, under the 48-pixel floor; its label is 12 pixels; its edge, bone 300 on white, is 1.6 to 1 where an edge needs 3 to 1 (BoxNumbersPanel.tsx:34-38)",
  ],
});

// ── Not found page ───────────────────────────────────────────────────────────────────────────────────────────
const notFound = (cls = "") => `<div class="pg-zoomwrap"><div class="pfm pg-404"><div class="pg-404c"><h1>Page not found</h1><p>The page you are looking for doesn't exist or has been moved.</p><a class="pg-404b${cls ? ` ${cls}` : ""}" href="#not-found"${sayMsg("Mockup: this would go back to the map.")}>← Back to map</a></div></div></div>`;

const notFoundEntry = entry({
  id: "not-found", name: "Not found page (NotFoundContent)", status: "built",
  statusNote: "Shown as it is live today.",
  purpose: "What someone sees when a link is wrong or a page has gone: a white card in the middle of the page with a plain title, one sentence, and one button back to the map. No top bar, no bottom bar, no footer, so there is only one thing to do.",
  instead: [
    "An event has ended or been cancelled: its own page stays up and says so. Only a removed, draft or unknown event ends on this page.",
    "Something failed to load on a page that exists: say so on that page (We couldn't load the list of blessing boxes right now), with a way to the map.",
  ],
  versions:
    wide("At 360 pixels wide, the size of the site's baseline phone. Shown smaller in the Phone view.", notFound()),
  states:
    demo("Back to map, resting", `<div class="pfm pg-404s"><a class="pg-404b" href="#not-found">← Back to map</a></div>`) +
    demo("Pointer over it: darkens to sage 700. Point at it.", `<div class="pfm pg-404s"><a class="pg-404b is-hover" href="#not-found">← Back to map</a></div>`) +
    demo("Reached by keyboard: a sage 500 ring", `<div class="pfm pg-404s"><a class="pg-404b is-focus" href="#not-found">← Back to map</a></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The page around the card") +
    sw("White", "white", "The card") +
    sw("Bone 200", "color-bone-200", `The card's edge, with a faint shadow. ${contrast(hex("color-bone-200"), PAPER).toFixed(1)} to 1, decoration only`) +
    swr("Ink 900", "color-ink-900", "The title", "white", 4.5, "white") +
    swr("Ink 500", "color-ink-500", "The sentence", "white", 4.5, "white") +
    sw("Sage 600", "color-sage-600", `The button. White words on it ${ratio(WHITE, hex("color-sage-600"))}; under the pointer sage 700, ${ratio(WHITE, hex("color-sage-700"))}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring", "white", 3, "white"),
  sizes: "The card is 448 pixels wide at most, 14-pixel corners, with 48 pixels of space inside it, and the page keeps 32 pixels around it. On a 360-pixel phone that leaves the words about 200 pixels wide. Title: Fraunces 30, 12 above the sentence. Sentence: 16 pixels, 32 above the button. Button: 24 pixels in from its sides, 10 above and below, 14-pixel medium words: 40 pixels tall.",
  wording: [
    "Title: Page not found. Spanish: Página no encontrada.",
    "One sentence, no blame and no error codes: The page you are looking for doesn't exist or has been moved.",
    "The button: ← Back to map, the same words as every page's top bar.",
  ],
  everyone: [
    "Keyboard: the button is the only thing to reach.",
    "Screen reader: the title is the page's heading, and the browser tab says Page Not Found.",
    "Touch: the button is 40 pixels tall, under the 48-pixel floor (see Lives in).",
  ],
  dd: dodont(
    [`<div class="pfm pg-404s pg-col2"><b class="pg-404t">Page not found</b><a class="pg-404b" href="#not-found">← Back to map</a></div>`, "One way out, back to where the food is."],
    [`<div class="pfm pg-404s pg-col2"><b class="pg-404t">Error 404</b><span class="pg-404x">Request failed: route not matched.</span></div>`, "A code and no way out. Someone on a slow phone is stuck."],
  ),
  code: [
    "src/components/NotFoundContent.tsx",
    "Shown by src/app/(site)/not-found.tsx and src/app/es/not-found.tsx",
    "Known live issue: the button is px-5 py-2.5, 40 pixels tall, under the 48-pixel floor (NotFoundContent.tsx:47)",
    "Known live issue: on a 360-pixel phone the card's padding (p-8, 48 pixels here) and the page's (p-6, 32) leave the words about 200 pixels wide (NotFoundContent.tsx:33-34)",
  ],
});

// ── Event page ───────────────────────────────────────────────────────────────────────────────────────────────
const EV = { name: "Fall Produce Giveaway", host: "Eastside Neighbors Group", day: "Saturday, November 15", time: "10 AM – 1 PM", place: "Mesa Street Community Hall", address: "100 Example Ave, Pueblo, CO 81001" };
type Phase = "up" | "live" | "ended" | "cancel";
const BADGE: Record<Phase, string> = { up: "Coming up", live: "Happening now", ended: "This event has ended", cancel: "Cancelled" };
const badge = (p: Phase) => `<p class="pg-badge ${p}">${BADGE[p]}</p>`;
const crumbs = (cls = "") => `<nav class="pg-crumbs" aria-label="Breadcrumb"><div><ol><li class="c"><a class="pg-crumb${cls ? ` ${cls}` : ""}" href="#event-page"${sayMsg("Mockup: this would open the map.")}>Map</a></li><li aria-hidden="true" class="sep">›</li><li aria-current="page" class="cur">${EV.name}</li></ol><a class="pg-other" href="#event-page" lang="es"${sayMsg("Mockup: this would open the same event in Spanish.")}>Ver en español</a></div></nav>`;
const evButtons = (o: { ended?: boolean; cls?: Partial<Record<"go" | "map" | "cal", string>> } = {}) => {
  const c = (k: "go" | "map" | "cal") => (o.cls?.[k] ? ` ${o.cls[k]}` : "");
  return `<div class="pg-evb">${o.ended ? "" : `<a class="pg-go${c("go")}" href="#event-page" aria-label="Get directions to ${EV.name}"${sayMsg("Mockup: this would open Google Maps with directions.")}>${ic("nav", 18)}Get directions</a>`}
  <a class="pg-map${c("map")}" href="#event-page"${sayMsg("Mockup: this would open this event's card on the map.")}>Open on the map</a>
  ${o.ended ? `<a class="pg-cal${c("cal")}" href="#event-page"${sayMsg("Mockup: this would open the map.")}>Find food on the map</a>` : `<button type="button" class="pg-cal${c("cal")}"${sayMsg("Mockup: this would save a calendar file.")}>${ic("cal", 16)}Add to calendar</button>`}
  <a class="pg-evlink" href="#event-page"${sayMsg("Mockup: this would open the event's own page in a new tab.")}>Sign up</a></div>`;
};
const eventPage = (o: { phase?: Phase } = {}) => {
  const p = o.phase ?? "up";
  const ended = p === "ended" || p === "cancel";
  return `<div class="pfm pg-page">${crumbs()}<div class="pg-evcol">
    <div class="pg-flyer" aria-hidden="true">The event's flyer picture</div>
    <header class="pg-evh">${badge(p)}<h1>${EV.name}</h1><p class="host">Hosted by ${EV.host}</p>${p === "cancel" ? `<p class="why">This event will not take place.</p>` : p === "ended" ? `<p class="help">Looking for food today? See what is open right now.</p>` : ""}</header>
    <section><h2 class="pg-sl">When</h2><p class="pg-day">${EV.day}</p><p class="pg-t">${EV.time} · MST, Pueblo time</p></section>
    <section><h2 class="pg-sl">Where</h2><p class="pg-vn">${EV.place}</p><p class="pg-t">${EV.address}</p></section>
    <section class="pg-bring"><h2>What to bring</h2><p>Bags or a box for your produce.</p></section>
    ${evButtons({ ended })}</div></div>`;
};

const eventEntry = entry({
  id: "event-page", name: "Event page (EventPage, EventFlyer, EventAddToCalendar)", status: "changing",
  statusNote: "What changes: the brightening on hover goes from all four buttons; Add to calendar and Find food on the map get the light green tint (sage 100) under the pointer in place of the grey. Everything else is the page as it is live today, with a made-up event.",
  purpose: "The page one event gets, so it can be shared and found by search engines: the flyer, whether it is coming up, on now or over, the name, when and where, what to bring, then the buttons. It uses the event card's colors and the site footer, but has its own top bar: a breadcrumb back to the map, and the same event in the other language.",
  instead: [
    "It's on the map: use the event card (EventCardBody), which has the same parts in a smaller space.",
    "It's a place, not a one-off event: use the place page or card.",
  ],
  versions:
    wide("Coming up. Tap any button.", eventPage()) +
    wide("Over or cancelled: no directions or calendar; Find food on the map takes their place", eventPage({ phase: "ended" })),
  states:
    demo("Coming up: navy on paper", `<div class="pfm pg-badges">${badge("up")}</div>`) +
    demo("Happening now: paper on navy, an orange edge", `<div class="pfm pg-badges">${badge("live")}</div>`) +
    demo("This event has ended: ink on bone", `<div class="pfm pg-badges">${badge("ended")}</div>`) +
    demo("Cancelled: clay, with the reason under the name", `<div class="pfm pg-badges">${badge("cancel")}</div>`) +
    demo("Buttons, resting", `<div class="pfm pg-page pg-pad" style="width:100%">${evButtons()}</div>`) +
    demo("Pointer over them: no brightening; Open on the map darkens to sage 700; Add to calendar takes the light green tint (proposed; live is grey). Get directions keeps its orange. Point at any of them.", `<div class="pfm pg-page pg-pad" style="width:100%">${evButtons({ cls: { go: "is-hover", map: "is-hover", cal: "is-hover" } })}</div>`) +
    demo("Reached by keyboard: a navy ring on the orange button, sage 500 on the rest", `<div class="pfm pg-page pg-pad" style="width:100%">${evButtons({ cls: { go: "is-focus", cal: "is-focus" } })}</div>`) +
    demo("Top bar: Map, resting, pointer over it, keyboard", `<div class="pfm pg-page" style="width:100%">${crumbs()}${crumbs("is-hover")}${crumbs("is-focus")}</div>`),
  colors:
    sw("Brand orange (the event pin, event-pin)", "color-brand-orange", `Get directions fill. event-pin is the same ${hex("color-brand-orange")}. Navy words on it ${ratio(hex("color-brand-navy"), hex("color-brand-orange"))}. The one place orange fills a button, an exception Kyle approved for events`) +
    sw("Navy (the event outline, event-outline)", "color-brand-navy", `Get directions words, the Coming up badge, the Happening now fill. event-outline is the same ${hex("color-brand-navy")}. ${r("color-brand-navy", "color-bone-50")} on bone 50; bone 50 on navy ${ratio(PAPER, hex("color-brand-navy"))}`) +
    sw("Clay 100 and clay 700", "color-clay-100", `The Cancelled badge, with a clay 500 edge. Clay 700 words on it ${r("color-clay-700", "color-clay-100")}; the reason under the name in clay 700 on bone 50, ${r("color-clay-700", "color-bone-50")}`) +
    sw("Bone 200", "color-bone-200", `The This event has ended badge. Ink 700 on it ${r("color-ink-700", "color-bone-200")}`) +
    swr("Ink 400", "color-ink-400", "Section labels (WHEN, WHERE) and the › in the top bar") +
    swr("Ink 900", "color-ink-900", "The name, the day, the place name") +
    swr("Ink 500", "color-ink-500", "Hosted by, and the event name in the top bar") +
    sw("Sage 50", "color-sage-50", `What to bring, with a sage 500 edge. Sage 700 heading on it ${r("color-sage-700", "color-sage-50")}, ink 900 words ${r("color-ink-900", "color-sage-50")}`) +
    swr("Sage 600", "color-sage-600", "Map, Ver en español and the event's own link; the Open on the map fill (bone 50 words on it " + ratio(PAPER, hex("color-sage-600")) + ")") +
    sw("Sage 100", "color-sage-100", `Add to calendar and Find food on the map under the pointer (proposed; live is bone 100). Ink 700 on it ${r("color-ink-700", "color-sage-100")}`),
  sizes: "Top bar: the 512-pixel column, 16 in from the sides, a 1-pixel line under it; Map taps at 48 tall, Ver en español is 48 tall, and a long event name is cut short with … so nothing scrolls sideways. Body: 16 in from the sides, 32 above and below, blocks 24 apart. Flyer: 10-pixel corners, as tall as 70% of the screen at most. Badge: fully round, a 2-pixel edge, 14-pixel semi-bold words. Name: Fraunces 24. Section labels 11-pixel capitals; day 16 semi-bold; the rest 14. Get directions 56 tall with 16-pixel bold words and an 18-pixel icon; the other buttons 48 tall, full width, 12 apart; the event's own link 48 tall.",
  wording: [
    "The badge is a word, never a countdown: Coming up, Happening now, This event has ended, Cancelled. Spanish: Próximamente, En curso.",
    "Times are always Pueblo time and say so: 10 AM – 1 PM · MST, Pueblo time.",
    "The top bar's other-language link is written in that language: Ver en español on the English page, View in English on the Spanish one.",
    "Over or cancelled, the page points to food today: Looking for food today? See what is open right now.",
  ],
  everyone: [
    "Keyboard: top bar first (Map, then the other language), then the flyer, then the buttons in order.",
    "Screen reader: the top bar is a breadcrumb landmark, with the event marked as the current page. When, Where and What to bring are headed sections. Get directions says Get directions to the event's name.",
    "Touch: every button and link is 48 pixels or more; Get directions is 56.",
    "Color is never the only sign: the badge always has its word.",
    "It reads fine with the phone's code turned off; only Add to calendar needs it.",
  ],
  dd: dodont(
    [`<div class="pfm pg-badges">${badge("up")}</div>`, "Say the state in a word that stays true."],
    [`<div class="pfm pg-badges"><p class="pg-badge up">Starts in 2 days, 4 hours</p></div>`, "A countdown. A saved or shared copy of the page goes wrong as soon as it is opened later."],
  ),
  code: [
    "src/components/EventPage.tsx. Change: the PRESS_FEEDBACK on Get directions, Open on the map and Find food on the map (EventPage.tsx:220, :233, :248) and Find food's hover:bg-bone-100 (:248)",
    "src/components/EventAddToCalendar.tsx. Change: its hover:bg-bone-100 and PRESS_FEEDBACK (EventAddToCalendar.tsx:25-26)",
    "src/components/EventFlyer.tsx is the card's flyer; EventPage.tsx draws its own copy of it (EventPage.tsx:124-145), taller (70% of the screen at most, against the card's 55%)",
    "Footer: SiteFooter.tsx (above). Colors event-pin and event-outline: src/app/globals.css",
  ],
});

const all: [string, string, string][] = [
  ["page-top", "Page top", pageTopEntry],
  ["site-footer", "Site footer", footerEntry],
  ["language", "Language switch", langEntry],
  ["hub-rows", "Hub list rows", hubEntry],
  ["faq", "Questions and answers", faqEntry],
  ["forms", "Public forms", formEntry],
  ["box-numbers", "Box numbers", boxEntry],
  ["not-found", "Not found page", notFoundEntry],
  ["event-page", "Event page", eventEntry],
];

export const pages: Page[] = [{
  slug: "components-pages", route: "DESIGN.md → Components", title: "Design system: Components, pages and forms", area: "Design system", nav: "Components",
  blurb: "The inside pages: page top, footer, language switch, hub lists, questions, the public forms, box numbers, not found and the event page.",
  changed: [
    "Language switch and the event page's buttons: the brightening on hover goes.",
    "Try again on the forms, Previous and Next on box activity, Add to calendar and Find food on the event page: the grey hover becomes the light green tint (sage 100).",
    "SNAP and WIC stores page: the category and SNAP and WIC join on one line, as the chosen category label.",
    "Everything else is what's live, with made-up places, boxes and numbers.",
  ],
  kept: [
    "Cloudflare's are-you-human check is drawn as a plain box: it is Cloudflare's own, and can't be copied here.",
    "Flyers and box photos are flat blocks.",
    "The phone view is 360 pixels wide, the older Android phone the site is built for.",
  ],
  check: [
    "The line under the title on the form pages (Know a food resource we're missing? Tell us about it.): the no-subtitle ruling was made for the admin. Keep it on the public form pages, or drop it?",
    "Get directions on the event page: with the brightening gone it has no hover change at all, since the theme has no darker orange. Is that fine?",
    "Known live issues listed under each entry's Lives in: the forms' fields, checkboxes and the not-found button are under the 48-pixel floor.",
  ],
  html: `<div class="head"><h1>Components, pages and forms</h1></div>
  <p class="dsp" style="margin:0 0 12px">The parts of the inside pages. The bottom bar and the place card are on the <a href="components.html">main Components page</a>.</p>
  ${toc([...all.map(([id, n]) => [`#${id}`, n] as [string, string]), ["components.html", "← Components"]])}
  ${all.map(([, , h]) => h).join("")}`,
}];
