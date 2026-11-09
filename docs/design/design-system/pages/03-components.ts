// Design system: Components. The bottom bar and the place card set the entry layout (approved); the map screen
// and its cards follow in the order a visitor meets them (round 4). Each entry follows the design skill's template: status tag;
// what it's for and when to use something else; versions as working pieces; states as stills; shared colors
// (with contrast ratios) and sizes; wording; works for everyone; one live Do and one live Don't; the code file.
// The replicas copy the real classes, words and sizes from src/ (CSS in mock.css, "Pueblo Food Map: replicas").
// All venue data is made up. No Mapbox: a flat block stands in for the map.
import { contrast, dodont, hex, ratio, STATUS, sw, toc, type Page, type Status, type Token } from "../lib";

function entry(o: {
  id: string; name: string; status: Status; statusNote?: string; purpose: string; instead: string[];
  versions: string; states: string; colors: string; sizes: string; wording: string[]; everyone: string[];
  dd: string; code: string[]; extra?: string; // extra: a pick-one section shown right after Versions
  colorsExtra?: string; // more contrast pairs, shown under the swatches
}) {
  return `<section class="ds" id="${o.id}">
  <div class="dsh"><h2>${o.name}</h2><span class="st ${o.status}">${STATUS[o.status]}</span></div>
  ${o.statusNote ? `<p class="dsnote">${o.statusNote}</p>` : ""}
  <p class="dsp">${o.purpose}</p>
  <h3>Use something else when</h3><ul>${o.instead.map((i) => `<li>${i}</li>`).join("")}</ul>
  <h3>Versions</h3><div class="dsrow">${o.versions}</div>${o.extra ?? ""}
  <h3>States</h3><div class="dsrow">${o.states}</div>
  <h3>Shared colors and sizes</h3><ul class="sws">${o.colors}</ul>${o.colorsExtra ?? ""}<p class="dssz">${o.sizes}</p>
  <h3>Wording</h3><ul>${o.wording.map((i) => `<li>${i}</li>`).join("")}</ul>
  <h3>Works for everyone</h3><ul>${o.everyone.map((i) => `<li>${i}</li>`).join("")}</ul>
  <h3>Do and don't</h3>${o.dd}
  <h3>Lives in</h3><ul class="dscode">${o.code.map((c) => `<li><code>${c}</code></li>`).join("")}</ul>
</section>`;
}

// Icon shapes rendered from the lucide-react the site ships (1.65.0, ISC license; notice in icons.ts), plus the
// hand-drawn Boxes icon copied from src/components/bottomNavShared.tsx.
const ICONS: Record<string, string> = {
  locate: `<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/>`,
  loader: `<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`,
  star: `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>`,
  box: `<path d="M3 10 12 4l9 6"/><path d="M5 9v11h14V9"/><path class="heart" d="M12 17.5s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z"/>`,
  help: `<path d="M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14"/><path d="m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 13 6 6"/>`,
  menu: `<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>`,
  pin: `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
  phone: `<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>`,
  share: `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>`,
  flag: `<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>`,
  ext: `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
  unknown: `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
};
const ic = (n: string, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const PAPER = hex("color-bone-50");
/** Swatch with its contrast ratio against the background it really sits on. need 4.5 for words, 3 for edges. */
const swr = (name: string, t: Token, use: string, bg: Token = "color-bone-50", need: 4.5 | 3 = 4.5, bgName = "bone 50") =>
  sw(name, t, `${use}. ${ratio(hex(t), hex(bg), need)} on ${bgName}${need === 3 ? " (edge)" : ""}.`);
/** A demo as wide as the card it holds (the kit's demo() caps at 340px). */
const wide = (label: string, html: string) => `<figure class="dsd pfm-wide"><div>${html}</div><figcaption>${label}</figcaption></figure>`;
const demo = (label: string, html: string) => `<figure class="dsd"><div>${html}</div><figcaption>${label}</figcaption></figure>`;
const q = (s: string) => s.replaceAll('"', "&quot;");

// ── BottomNav ────────────────────────────────────────────────────────────────────────────────────────────────
type NavState = { open?: "saved" | "top"; boxes?: boolean; locating?: boolean; cls?: Record<string, string> };
const navItems = (s: NavState = {}, live = false) => {
  const c = (k: string) => (s.cls?.[k] ? ` ${s.cls[k]}` : "");
  // Live version only: tapping updates the bar the way the real one does (Saved and Menu light up while their
  // panel is open, Boxes toggles, Near me shows the spinner while locating).
  const tap = (js: string, msg: string) => (live ? ` onclick="${q(js)}" data-say="${q(msg)}"` : ``);
  const section = (key: "saved" | "top", label: string, icon: string) =>
    `<li><button type="button" class="pfm-it${c(key)}"${s.open === key ? ' aria-current="true"' : ""}${tap(`const on=this.getAttribute('aria-current')==='true';this.closest('ul').querySelectorAll('[data-sec]').forEach(b=>b.removeAttribute('aria-current'));if(!on)this.setAttribute('aria-current','true')`, `Mockup: this would ${key === "saved" ? "open your saved places" : "open the menu"}. Tap again to close it.`)} data-sec>${ic(icon)}<span>${label}</span></button></li>`;
  return `<ul>
    <li><button type="button" class="pfm-it${c("near")}"${s.locating ? ' disabled aria-busy="true"' : ""}${tap(`const b=this,s=b.querySelector('svg');b.disabled=true;b.setAttribute('aria-busy','true');s.innerHTML=${q(JSON.stringify(ICONS.loader))};s.classList.add('spinme');setTimeout(()=>{b.disabled=false;b.removeAttribute('aria-busy');s.classList.remove('spinme');s.innerHTML=${q(JSON.stringify(ICONS.locate))}},1600)`, "Mockup: this would ask for your location, then move the map to you.")}>${s.locating ? ic("loader", "spinme") : ic("locate")}<span>Near me</span></button>${s.locating ? '<span class="sr" aria-live="polite">Locating…</span>' : ""}</li>
    ${section("saved", "Saved", "star")}
    <li><button type="button" class="pfm-it${c("boxes")}" aria-pressed="${s.boxes ? "true" : "false"}"${tap(`this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')==='true'?'false':'true')`, "Mockup: this would show only blessing boxes, nearest first.")}>${ic("box")}<span>Boxes</span></button></li>
    <li><a class="pfm-it${c("help")}" href="#bottom-nav"${live ? ' data-say="Mockup: this would open the Food help programs page."' : ""}>${ic("help")}<span>Help</span></a></li>
    ${section("top", "Menu", "menu")}
  </ul>`;
};
const navBar = (s: NavState = {}, live = false, label = "Main") => `<nav class="pfm pfm-nav" aria-label="${label}">${navItems(s, live)}</nav>`;
/** One bar item on its own, for the states row. */
const cell = (item: "near" | "saved" | "boxes", s: NavState) => {
  const html = navItems(s);
  const li = html.match(/<li>[\s\S]*?<\/li>/g)!;
  return `<div class="pfm pfm-cell"><ul style="display:flex;flex:1;margin:0;padding:0;list-style:none">${li[{ near: 0, saved: 1, boxes: 2 }[item]].replace("<li>", '<li style="display:flex;flex:1">')}</ul></div>`;
};
const onMap = (bar: string, label = "The map stands in here") => `<div class="pfm-map">${label}${bar}</div>`;

const bottomNav = entry({
  id: "bottom-nav", name: "Bottom bar (BottomNav)", status: "changing",
  statusNote: "What changes: hover becomes a light green tint (sage 100); hover no longer flickers. Everything else is the bar as it is live today.",
  purpose: "The five ways off the map: Near me, Saved, Boxes, Help and Menu. It floats near the bottom of every map and menu page, under the thumb, so nothing important sits in the top corners. Near me and Boxes act on the map; Saved and Menu open a panel; Help opens the Food help programs page.",
  instead: [
    "It's about one place (directions, save, share): it goes on the place card, not in the bar.",
    "It narrows what the map shows by type, SNAP or open now: it goes in Filters, next to the search bar. Boxes is the one shortcut, agreed for blessing boxes only.",
    "It's a new destination: it goes in the Menu. A sixth item in the bar narrows every cell and needs a mockup first (DESIGN.md, Safe zones).",
  ],
  versions:
    wide("Phones and tablets, below 1536 pixels wide. Tap any item: Saved and Menu light up while open, Boxes turns on and off, Near me shows the spinner. On the Phone view this bar is narrower than on a real 360-pixel phone, so its words show at the 11-pixel size a 320-pixel phone gets.",`<div class="pfm">${onMap(navBar({}, true))}</div>`) +
    wide("Large screens, 1536 pixels and up: icon and word on one line, in the bottom centre. Shown smaller on a phone.", `<div class="pfm-widewrap">${`<nav class="pfm pfm-nav wide" aria-label="Main, large screens">${navItems()}</nav>`}</div>`),
  states:
    demo("Resting", cell("saved", {})) +
    demo("Pointer over it: a light green tint, fading in with no flicker (mouse only, never sticks on a phone). Point at any item in these pictures to see it. Live today: a grey fill plus a brightening that flickers.", cell("saved", { cls: { saved: "is-hover" } })) +
    demo("Reached by keyboard: a green ring just inside the item's own edge",cell("saved", { cls: { saved: "is-focus" } })) +
    demo("Its panel is open (navy)", cell("saved", { open: "saved" })) +
    demo("Boxes on: raspberry, and the heart fills. No hover fill while it's on (decided, Kyle): point at it to check.", cell("boxes", { boxes: true })) +
    demo("Working: Near me while locating. It can't be pressed again until it finishes; there is no other disabled look.", cell("near", { locating: true })),
  colors:
    sw("Bone 50", "color-bone-50", "The bar, the same paper as the page") +
    sw("Bone 300", "color-bone-300", `The bar's edge, as on the search bar. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1, decoration only: the words carry the items`) +
    swr("Ink 500", "color-ink-500", "Words and icons at rest") +
    swr("Navy", "color-brand-navy", "The item whose panel is open") +
    swr("Blessing box raspberry", "color-cat-blessing", "Boxes while it's on, words, icon and heart") +
    sw("Sage 100", "color-sage-100", `Fill under the pointer (proposed; live is bone 100). Words on it: ink 500 ${ratio(hex("color-ink-500"), hex("color-sage-100"))}, navy ${ratio(hex("color-brand-navy"), hex("color-sage-100"))}. Boxes while it's on gets no hover fill (decided, Kyle): raspberry stays on the bone 50 paper, ${ratio(hex("color-cat-blessing"), PAPER)} (on sage 100 it would be ${ratio(hex("color-cat-blessing"), hex("color-sage-100"))})`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring, drawn inside the item", "color-bone-50", 3),
  sizes: "64 pixels tall, fully round, 12 pixels in from each side and 12 pixels above the bottom of the screen (plus the phone's own safe area). Five equal items: about 64 pixels wide each at 360 pixels, about 57 at 320, all past the 48-pixel floor. 24-pixel icon above a 12-pixel bold word, 3 pixels apart (the word drops to 11 pixels on screens under 360 wide). Stops growing at 460 pixels wide on tablets. Shadow: 0 4 16 ink at 14%. On large screens: 52 pixels tall, 20-pixel icons, items 44 pixels tall.",
  wording: [
    "One or two short words per item, the same on every page: Near me, Saved, Boxes, Help, Menu. Spanish: Cercanos, Guardados, Cajas, Ayuda, Menú.",
    "The words never change with the state; only the icon or color does, so the bar never shifts. Near me stays Near me while locating.",
    "Help opens a page titled Food help programs. The short word is only for the bar.",
  ],
  everyone: [
    "Keyboard: it's the last thing on the page, after the map and the search, so Tab reaches those first. Every item is a real button or link; Enter or Space presses it.",
    "Screen reader: the bar is a navigation landmark called Main. The open item says it's current; Boxes says pressed or not pressed; while locating, a hidden line says Locating….",
    "Touch: every item is the full 64-pixel height and at least 57 pixels wide, with no gaps to miss between them. The phone's grey tap flash is turned off; a slight dim on press shows the tap landed.",
    "Color is never the only sign: Boxes on also fills the heart, and every item keeps its word.",
    "It hides while something covers the whole screen (the phone Menu, Filters, a photo, the route steps), so it never sits on top of them.",
  ],
  dd: dodont(
    [`<div class="pfm" style="width:100%">${onMap(navBar({}, false, "Do example"), "")}</div>`, "Every item has its word under the icon."],
    [`<div class="pfm" style="width:100%">${onMap(`<nav class="pfm pfm-nav" aria-label="Don't example">${navItems().replace(/<span>[^<]*<\/span>/g, "")}</nav>`, "")}</div>`, "Icons with no words. People guess wrong, and the old unlabelled menu circle was the only way into every page."],
  ),
  code: ["src/components/BottomNav.tsx", "src/components/bottomNavShared.tsx (classes and the Boxes icon). Known live issue for the site fix: ITEM_CLASS uses PRESS_FEEDBACK from src/lib/interactionStyles.ts (hover:brightness-105, active:brightness-95), the hover filter that makes the fade stutter; its hover fill is bone-100. Also: the spec's sizes are drawn here, but this site's spacing scale makes size-6 32 pixels, so live icons measure 32 on phones (spec 24) and 24 on large screens (spec 20), and the large-screen bar sits 32 up (2xl:bottom-6; spec 24). Use exact pixel classes in the site fix","src/app/globals.css ([data-bottom-nav], --bottom-nav-clearance)", "docs/bottom-nav-spec.md"],
});

// ── Venue card body ──────────────────────────────────────────────────────────────────────────────────────────
// Made-up place. 555-01xx numbers are reserved for fiction.
const V = {
  name: "Eastside Community Pantry", address: "100 Example Ave, Pueblo, CO 81001", phone: "(719) 555-0142",
  miles: "0.8 mi", notes: "Bring a bag. Fresh produce on the first Saturday of each month while it lasts. No ID needed for your first visit.",
};
const hoursRows: [string, string, boolean?][] = [["Mon", "Closed"], ["Tue", "9am – 1pm"], ["Wed", "9am – 1pm"], ["Thu", "2pm – 6pm", true], ["Fri", "9am – 1pm"], ["Sat", "10am – 12pm"], ["Sun", "Closed"]];
type CardOpt = { panel?: boolean; saved?: boolean; walkActive?: boolean; hours?: "open" | "opens" | "closed" | "unknown"; live?: boolean; peek?: boolean; name?: string };
/** Decided (Kyle, 2026-11-08): the category, then SNAP, then WIC, on one line under the name, separated by middle
 *  dots. Category word in its category color, SNAP and WIC in sage 700, dots in ink 400. */
const labelLine = (cat: string, label: string, benefits: string[]) =>
  `<p class="pfm-lab"><span style="color:var(--color-cat-${cat})">${label}</span>${benefits.map((t) => `<span class="dot" aria-hidden="true">·</span><span class="sr">, </span><span class="ben">${t}</span>`).join("")}</p>`;
const hoursLine = (h: CardOpt["hours"] = "open") =>
  h === "unknown" ? `<span class="unk">${ic("unknown")}Hours unknown — call ahead</span>`
  : `<span>${ic("clock")}${{ open: "Open now · Closes 6pm", opens: "Opens at 2pm", closed: "Closed today" }[h]}</span>`;
const dirButtons = (o: CardOpt = {}) => {
  const say = (m: string) => (o.live ? ` data-say="${q(m)}"` : "");
  return `<div class="pfm-dir">
    <button type="button" class="pfm-db walk${o.walkActive ? " active" : ""}" aria-label="${o.walkActive ? "Clear walking route" : `Walking directions to ${V.name} (opens on map)`}"${o.live ? ` onclick="${q("const a=this.classList.toggle('active');this.textContent=a?'Clear walking route':'Walk'")}" data-say="Mockup: this would draw the walking route on the map."` : ""}>${o.walkActive ? "Clear walking route" : "Walk"}</button>
    <a class="pfm-db ext" href="#venue-card" aria-label="Bus directions to ${V.name} (opens in new tab)"${say("Mockup: this would open Google Maps with bus directions.")}>Bus</a>
    <a class="pfm-db ext" href="#venue-card" aria-label="Drive directions to ${V.name} (opens in new tab)"${say("Mockup: this would open Google Maps with driving directions.")}>Drive</a>
  </div>`;
};
const card = (o: CardOpt = {}) => {
  const say = (m: string) => (o.live ? ` data-say="${q(m)}"` : "");
  const name = o.name ?? V.name;
  const body = `<div class="pfm-namerow"><h2 class="pfm-name">${name}</h2>
    <button type="button" class="pfm-ib share" aria-label="Share ${name}"${say("Mockup: this would share the link, or copy it.")}>${ic("share")}</button>
    <button type="button" class="pfm-ib" aria-pressed="${o.saved ? "true" : "false"}" aria-label="${o.saved ? "Remove" : "Add"} ${name} ${o.saved ? "from" : "to"} saved"${o.live ? ` onclick="${q("this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')==='true'?'false':'true')")}"` : ""}>${ic("star")}</button></div>
  ${labelLine("pantry", "Food Pantry", ["SNAP", "WIC"])}
  <p class="pfm-op">Operated by <a href="#venue-card"${say("Mockup: this would open pueblofoodproject.org in a new tab.")}>Pueblo Food Project</a></p>
  <div class="pfm-meta"><span>${ic("pin")}${V.miles} from you</span>${hoursLine(o.hours)}</div>
  <p class="pfm-notes">${V.notes}</p>
  ${dirButtons(o)}
  <div class="pfm-detail">
    <div class="pfm-addr">${ic("pin")}<div><p>${V.address}</p><p class="mono">${V.miles} from you</p></div></div>
    <div class="pfm-badges"><span class="pfm-pill big">Accepts SNAP</span><span class="pfm-pill big">Accepts WIC</span></div>
    <section class="pfm-sec" aria-label="Hours"><h3>Hours</h3><dl class="pfm-hours">${hoursRows.map(([d, t, today]) => `<div${today ? ' class="today" aria-current="date"' : ""}><dt>${d}${today ? '<span class="sr">, Today</span>' : ""}</dt><dd>${t}</dd></div>`).join("")}</dl></section>
    <section class="pfm-sec" aria-label="Contact"><h3>Contact</h3><a class="pfm-tel" href="#venue-card"${say(`Mockup: this would call ${V.phone}.`)}>${ic("phone")}${V.phone}</a></section>
    <a class="pfm-plen" href="#venue-card"${say("Mockup: this would open the place's Plentiful page in a new tab.")}><span>See hours, eligibility &amp; what to bring on Plentiful</span>${ic("ext")}</a>
    <a class="pfm-report" href="#venue-card"${say("Mockup: this would open the Report a problem form for this place.")}>${ic("flag")}Report an issue with this place</a>
  </div>`;
  return `<div class="pfm pfm-card${o.panel ? " pfm-pc" : ""}${o.peek ? " pfm-peek" : ""}">${body}</div>`;
};

// ── Category label: decided (Kyle, 2026-11-08): colored words under the name, sentence case, 14px semi-bold ──
// Made-up places: the three categories Kyle asked to see, plus a long name.
const CATS: { cat: string; label: string; name: string; miles: string; hours: string; benefits: string[] }[] = [
  { cat: "pantry", label: "Food Pantry", name: "Eastside Community Pantry", miles: "0.8 mi", hours: "Open now · Closes 6pm", benefits: [] },
  { cat: "grocery", label: "Grocery / Supermarket", name: "Northgate Grocery Market", miles: "1.4 mi", hours: "Open now · Closes 9pm", benefits: ["SNAP", "WIC"] },
  { cat: "garden", label: "Community Garden", name: "Mesa Street Community Garden", miles: "2.1 mi", hours: "Opens at 8am", benefits: [] },
  { cat: "pantry", label: "Food Pantry", name: "Saint Joseph Eastside Community Food Pantry", miles: "3.2 mi", hours: "Closed today", benefits: ["SNAP"] },
];
const ALL_CATS: [string, string][] = [["pantry", "Pantry"], ["grocery", "Grocery"], ["convenience", "Convenience"], ["farm", "Farm"], ["garden", "Garden"], ["landscape", "Edible landscape"], ["meal", "Meal site"], ["blessing", "Blessing box"]];
const topRow = (x: (typeof CATS)[number]) => `<div class="pfm-namerow"><h2 class="pfm-name">${x.name}</h2><button type="button" class="pfm-ib share" aria-label="Share ${x.name}">${ic("share")}</button><button type="button" class="pfm-ib" aria-pressed="false" aria-label="Add ${x.name} to saved">${ic("star")}</button></div>`;
const cardTop = (x: (typeof CATS)[number]) =>
  `<div class="pfm pfm-card"><div class="pfm-top">${topRow(x)}${labelLine(x.cat, x.label, x.benefits)}<div class="pfm-meta"><span>${ic("pin")}${x.miles} from you</span><span>${ic("clock")}${x.hours}</span></div></div></div>`;
const r = (fg: Token, bg: Token, need: 4.5 | 3 = 4.5) => ratio(hex(fg), hex(bg), need);
const catOptions = `<h3 id="category-label">Category label</h3>
  <p class="dsnote">Decided: colored words under the name (Kyle, 2026-11-08).</p>
  <p class="dssz">The category, then SNAP, then WIC, on one line under the name, separated by middle dots. Sentence case, 14 pixels, semi-bold. The category word is in its own category color; SNAP and WIC are in sage 700; the dots in ink 400. No fill, no underline, no pill. Made-up places; on a computer each is a real 360-pixel card, in the Phone view about 300 wide.</p>
  <div class="pfm-pair"><figure class="pfm-opt">${CATS.map((x) => cardTop(x)).join("")}</figure></div>
  <h4 style="margin:14px 0 6px">Every category's word on the card (bone 50)</h4>
  <ul class="fpairs">${ALL_CATS.map(([c, n]) => `<li><span class="fpair" style="background:${PAPER};color:var(--color-cat-${c})">Aa</span><span><b>${n}</b> ${r(`color-cat-${c}` as Token, "color-bone-50")}</span></li>`).join("")}
  <li><span class="fpair" style="background:${PAPER};color:var(--color-sage-700)">Aa</span><span><b>SNAP and WIC, sage 700</b> ${r("color-sage-700", "color-bone-50")}</span></li>
  <li><span class="fpair" style="background:${PAPER};color:var(--color-ink-400)">·</span><span><b>The dots, ink 400</b> ${r("color-ink-400", "color-bone-50")}</span></li></ul>`;

const venueCard = entry({
  id: "venue-card", name: "Place card (VenueCardBody)", status: "changing",
  statusNote: "What changes: hover becomes a light green tint (sage 100); hover no longer flickers; share and save line up with the name; the category becomes colored words on its own line under the name (Food Pantry · SNAP · WIC) in place of the pill. Everything else is the card as it is live today, with a made-up place.",
  purpose: "Everything about one place, in the order people need it: the name, what kind of place it is, how far and whether it's open, then the way to get there, then the full hours, phone and a way to report a problem. The same body shows in the card that slides up on a phone and in the window on the side of the map on a computer.",
  instead: [
    "It's a blessing box: use the box card (BoxCardBody), which has check-ins and photos.",
    "It's an event: use the event card (EventCardBody).",
    "It's a list of several places: use the list rows, and open this card from one of them.",
  ],
  versions:
    wide("Phone: the card slides up from the bottom. Tap Walk, the star or any link.", card({ live: true })) +
    wide("Phone, a long name over two lines: share and save stay on the first line.", card({ peek: true, name: "Saint Joseph Eastside Community Food Pantry" })) +
    wide("Phone, as it first opens: everything below the direction buttons sits below the screen edge, with its top showing, until it's pulled up.", `${card({ peek: true })}`) +
    wide("Computer: the window on the side of the map. Smaller words and icons, always the full details.", card({ panel: true })),
  extra: catOptions,
  states:
    demo("Walk, resting", `<div class="pfm" style="width:100%">${dirButtons()}</div>`) +
    demo("Pointer over it: Walk darkens to sage 700; Bus and Drive take a light green tint (proposed; live is grey). No flicker. Point at the buttons in any of these pictures to see it.", `<div class="pfm" style="width:100%">${dirButtons().replace("pfm-db walk", "pfm-db walk is-hover").replace('class="pfm-db ext"', 'class="pfm-db ext is-hover"')}</div>`) +
    demo("Reached by keyboard", `<div class="pfm" style="width:100%">${dirButtons().replace("pfm-db walk", "pfm-db walk is-focus")}</div>`) +
    demo("Walking route on the map: Walk turns into Clear walking route", `<div class="pfm" style="width:100%">${dirButtons({ walkActive: true })}</div>`) +
    demo("Open now", `<div class="pfm pfm-meta">${hoursLine("open")}</div>`) +
    demo("Opens later today", `<div class="pfm pfm-meta">${hoursLine("opens")}</div>`) +
    demo("Closed today", `<div class="pfm pfm-meta">${hoursLine("closed")}</div>`) +
    demo("No hours known: a different icon, so it's never read as open", `<div class="pfm pfm-meta">${hoursLine("unknown")}</div>`) +
    demo("Share and save: resting, pointer over it (light green tint, proposed; point at any of them), keyboard, saved", `<div class="pfm" style="display:flex;gap:16px;padding:8px"><button type="button" class="pfm-ib share" aria-label="Share">${ic("share")}</button><button type="button" class="pfm-ib share is-hover" aria-label="Share, pointer over it">${ic("share")}</button><button type="button" class="pfm-ib is-focus" aria-pressed="false" aria-label="Not saved, keyboard">${ic("star")}</button><button type="button" class="pfm-ib" aria-pressed="true" aria-label="Saved">${ic("star")}</button></div>`) +
    demo("Phone number: resting, pointer over it, keyboard (the browser's own outline: this link has no sage ring)",`<div class="pfm" style="display:flex;flex-direction:column;align-items:flex-start"><a class="pfm-tel" href="#venue-card">${ic("phone")}${V.phone}</a><a class="pfm-tel is-hover" href="#venue-card">${ic("phone")}${V.phone}</a><a class="pfm-tel is-focus" href="#venue-card">${ic("phone")}${V.phone}</a></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The card, the same paper as the page") +
    swr("Ink 900", "color-ink-900", "The place name") +
    swr("Ink 700", "color-ink-700", "Address, notes, hours, Bus and Drive words") +
    swr("Ink 500", "color-ink-500", "Distance and hours today, the operator line, the report button") +
    swr("Ink 400", "color-ink-400", "Section labels (HOURS, CONTACT), the middle dots in the category label, small icons, the star at rest") +
    swr("Sage 700", "color-sage-700", "Phone number, today's hours, SNAP and WIC in the label and the Accepts badges") +
    sw("Sage 600", "color-sage-600", `Walk button fill. Bone 50 words on it ${ratio(PAPER, hex("color-sage-600"))}; with the pointer over it sage 700, ${ratio(PAPER, hex("color-sage-700"))}`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on share, save, Bus and Drive (proposed; live is bone 100), the Accepts SNAP and WIC badges, and Walk while a route is on. Words on it: ink 700 ${r("color-ink-700", "color-sage-100")}, ink 500 ${r("color-ink-500", "color-sage-100")}, sage 700 ${r("color-sage-700", "color-sage-100")}; the star icon in ink 400 ${r("color-ink-400", "color-sage-100", 3)}; the sage 600 edge ${r("color-sage-600", "color-sage-100", 3)}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring, today's line, the Plentiful link's edge", "color-bone-50", 3) +
    sw("Pantry red (each category has its own)", "color-cat-pantry", `The category word in the label. ${r("color-cat-pantry", "color-bone-50")} on bone 50; every category passes, see Category label`) +
    swr("Clay 500", "color-clay-500", "The star once saved", "color-bone-50", 3) +
    sw("Bone 300", "color-bone-300", `Bus, Drive and report button edges. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1, decoration only: the words carry the buttons`),
  sizes: "Phone: 24 pixels in from the sides, 24 on top, 12 between blocks. Name in Fraunces 20, the rest in Public Sans 14 (labels 11 and the operator line 12). Share, Save, Walk, Bus, Drive and the Plentiful link are all 48 pixels to tap; the phone number is 44 tall with 2 extra pixels above and below to reach 48; the report button looks 36 tall and taps at 48. Corners 10 pixels on buttons, 20 on the top of the phone card, 14 on the computer window. Computer: 16 pixels of padding, words 12, labels 10, icons a size smaller.",
  wording: [
    "The label is the category name, then SNAP, then WIC, separated by a middle dot: Grocery / Supermarket · SNAP · WIC. The category is spelled out, never a code; SNAP or WIC only when the place takes it.",
    "Hours today read as a short sentence: Open now · Closes 6pm, Opens at 2pm, Closed today. Times are lower case, no :00.",
    "Distance is miles to one decimal and from you: 0.8 mi from you.",
    "One word on each direction button: Walk, Bus, Drive. Screen readers hear the full version: Walking directions to Eastside Community Pantry (opens on map).",
    "Section labels are capitals: HOURS, CONTACT. The report button says what it does: Report an issue with this place.",
  ],
  everyone: [
    "Keyboard: the order on the page is the order on the screen. On the phone a Close button shows when the keyboard reaches it; on screen it's hidden because the card closes by swiping down. While the phone card is pulled down, the half-shown details can't be reached by Tab.",
    "Screen reader: the name is the card's heading; Hours and Contact are labelled sections; today's row is marked as today, not just by color; Bus and Drive say they open a new tab; the star says Add to saved or Remove from saved and whether it's pressed.",
    "Touch: every control is at least 48 pixels, with at least 8 pixels between neighbours. Links that look small keep a 48-pixel tap area.",
    "Color is never the only sign: open or closed is written out, today's hours row has a line and bold, a saved star fills in.",
  ],
  dd: dodont(
    [`<div class="pfm" style="width:100%">${dirButtons()}</div>`, "One filled button for the route that stays in the map; the two that leave for Google Maps are outlines."],
    [`<div class="pfm" style="width:100%">${dirButtons().replaceAll("pfm-db ext", "pfm-db walk")}</div>`, "Three filled buttons: nobody can tell which one stays on the map."],
  ),
  code: ["src/components/VenueCardBody.tsx. Proposed change: the name row is items-start and Share / Save use -m-1, so their icons sit about 7 pixels below the middle of the name's first line; the mockup uses a -11.5px top and bottom margin instead", "src/components/DirectionButtons.tsx. Known live issue for the site fix: baseClass uses PRESS_FEEDBACK from src/lib/interactionStyles.ts (hover:brightness-105, active:brightness-95), the hover filter that makes the fade stutter; Bus and Drive hover to bone-100", "FavoriteButton.tsx and ShareButton.tsx use the same PRESS_FEEDBACK and a bone-100 hover","src/components/HoursList.tsx", "src/components/FavoriteButton.tsx, ShareButton.tsx, ReportVenueButton.tsx", "Shown inside src/components/BottomSheet.tsx (phone) and DesktopVenueWindow.tsx (computer)"],
});

// ════ Map screen and its cards (round 4) ════════════════════════════════════════════════════════════════════
// Twelve more entries, in the order a visitor meets them: search, filters, the map / list switch, pins, the
// card containers, directions, the share and save buttons, hours, events, blessing boxes, the menu, and the
// location help card with the splash's orange button. Same entry() template and helpers as the two above; CSS
// lives in mock.css's "map-cards" block. Every state still has both a frozen class (.is-hover / .is-focus) and
// the real :hover / :focus-visible rule, so pointing at it or tabbing to it shows the same thing.
Object.assign(ICONS, {
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  search: `<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>`,
  list: `<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>`,
  map: `<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>`,
  chevR: `<path d="m9 18 6-6-6-6"/>`,
  chevL: `<path d="m15 18-6-6 6-6"/>`,
  chevU: `<path d="m18 15-6-6-6 6"/>`,
  steps: `<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  card: `<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 14h2"/>`,
  apple: `<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>`,
  nav: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>`,
  heart: `<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>`,
  turnL: `<path d="M20 20v-7a4 4 0 0 0-4-4H4"/><path d="M9 14 4 9l5-5"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
  cal: `<path d="M16 18h6"/><path d="M16 2v3"/><path d="M19 15v6"/><path d="M21 11.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.3"/><path d="M3 9h18"/><path d="M8 2v3"/>`,
  // The Filters icon is hand-drawn in SearchBar.tsx (three bars, stroke 2.2), not a Lucide shape.
  filter: `<path d="M4 6h16M7 12h10M10 18h4" style="stroke-width:2.2"/>`,
  eventStar: `<polygon points="12,5.6 13.12,8.46 16.19,8.64 13.81,10.59 14.59,13.56 12,11.9 9.41,13.56 10.19,10.59 7.82,8.64 10.88,8.46"/>`,
});
const say2 = (m: string) => ` data-say="${q(m)}"`;
/** A flat block standing in for the map (no tiles, no Mapbox). */
const mapArea = (inner: string, h = 220, cls = "") => `<div class="pfm pfm-ma${cls ? ` ${cls}` : ""}" style="height:${h}px">${inner}</div>`;
const r3 = (fg: Token, bg: Token) => r(fg, bg, 3);
const knownIssues = (items: string[]) => items.map((i) => `Known live issue: ${i}`);
// Category keys used by the replicas, with the full names the site shows (category.full.* in src/lib/i18n.ts).
const FULL: [string, string][] = [["pantry", "Food Pantry"], ["grocery", "Grocery / Supermarket"], ["convenience", "Convenience Store"], ["farm", "Farm / Market"], ["garden", "Community Garden"], ["landscape", "Edible Landscape"], ["meal", "Meal Site"], ["blessing", "Blessing Box"]];
/** Each category word on a background, for the rows where the decided label sits on a tint. */
const catRatios = (bg: Token, bgName: string) =>
  `<ul class="fpairs">${FULL.map(([c, n]) => `<li><span class="fpair" style="background:${hex(bg)};color:var(--color-cat-${c})">Aa</span><span><b>${n}</b> ${r(`color-cat-${c}` as Token, bg)} on ${bgName}</span></li>`).join("")}</ul>`;

// ── Search bar ───────────────────────────────────────────────────────────────────────────────────────────────
const RES = [
  { name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", d: "0.8 mi" },
  { name: "East Mesa Grocery", cat: "grocery", label: "Grocery / Supermarket", d: "1.2 mi" },
  { name: "Eastview Community Garden", cat: "garden", label: "Community Garden", d: "2.4 mi" },
];
const sbBar = (o: { count?: number; value?: string; icls?: string; fcls?: string; live?: boolean } = {}) =>
  `<div class="pfm-sb">${ic("search", "mag")}<input type="search" class="pfm-sbin${o.icls ? ` ${o.icls}` : ""}" placeholder="Search" aria-label="Search places" value="${o.value ?? ""}" autocomplete="off" enterkeyhint="search"><button type="button" class="pfm-sbf${o.count ? " on" : ""}${o.fcls ? ` ${o.fcls}` : ""}" aria-label="${o.count ? `Filters, ${o.count} on` : "Filters"}"${o.live ? say2("Mockup: this would open Filters, sliding in from the left.") : ""}><span class="dv" aria-hidden="true"></span>${ic("filter")}${o.count ? `<span class="cnt" aria-hidden="true">${o.count}</span>` : ""}</button></div>`;
const resultRow = (x: (typeof RES)[number], cls = "", live = false) =>
  `<li role="option" aria-selected="${cls.includes("act")}" class="${cls}"${live ? say2(`Mockup: this would open ${x.name}.`) : ""}><span class="m"><span class="n">${x.name}</span><span class="c" style="color:var(--color-cat-${x.cat})">${x.label}</span></span><span class="d" aria-label="${x.d} away">${x.d}</span></li>`;
const seeAll = (cls = "", live = false) => `<button type="button" class="pfm-popall${cls ? ` ${cls}` : ""}"${live ? say2("Mockup: this would switch to the list, showing these 7 matches.") : ""}>${ic("list")}<span class="t">See all 7 matches as a list</span><span class="ch" aria-hidden="true">›</span></button>`;
const results = (live = false) => `<div class="pfm-pop"><ul role="listbox" aria-label="7 places match">${RES.map((x, i) => resultRow(x, i === 0 ? "act" : "", live)).join("")}</ul><p class="more">+4 more matches</p>${seeAll("", live)}</div>`;
const chip = (c: string, n: string, cls = "", live = false) => `<button type="button" class="pfm-chip${cls ? ` ${cls}` : ""}" aria-label="Show ${n} places"${live ? say2(`Mockup: this would search for ${n}.`) : ""}><i style="background:var(--color-cat-${c})"></i>${n}</button>`;
const emptyPop = (live = false) => `<div class="pfm-pop pad" role="status"><p class="t">No matches for "xyzzy"</p><p class="s">Try a category instead:</p><div class="chp">${FULL.map(([c, n]) => chip(c, n, "", live)).join("")}</div></div>`;

const searchBar = entry({
  id: "search-bar", name: "Search bar (SearchBar)", status: "changing",
  statusNote: "What changes: the pointer tint on result rows, the See all row and the category buttons becomes sage 100 (live: bone 100 or bone 200, both grey); the Filters icon no longer brightens under the pointer; the category under each result's name becomes the decided label: colored words, 14 pixels, semi-bold (live: 12-pixel grey words). Everything else is the bar as it is live today.",
  purpose: "The one way to find a place by name or kind. It floats at the top of the map, with Filters inside its right end. Results drop down under it as you type, nearest first. If nothing matches, it offers the eight kinds of place instead.",
  instead: [
    "You want to narrow the map by type, open now, SNAP or WIC: that's the Filters panel, opened from the icon in the bar's right end.",
    "You want to see every place as a list: that's the Map / list switch, which shows under the empty search bar.",
    "The category buttons under No matches are choices, not labels on a place, so they keep their color dot and plain words.",
  ],
  versions:
    wide("On the map. Type in it, or tap Filters. The mockup doesn't search.", `<div class="pfm">${mapArea(sbBar({ live: true }), 120, "tp")}</div>`) +
    wide("Filters on: the icon turns green and an orange count sits beside it, never over it.", `<div class="pfm">${mapArea(sbBar({ count: 2, live: true }), 120, "tp")}</div>`) +
    wide("Results while typing: up to seven rows, then it scrolls. The first row is the one the arrow keys have reached. Each name has the decided category label under it.", `<div class="pfm pfm-sbwrap">${sbBar({ value: "east" })}${results(true)}</div>`) +
    wide("No matches: the eight kinds of place to try instead.", `<div class="pfm pfm-sbwrap">${sbBar({ value: "xyzzy" })}${emptyPop(true)}</div>`),
  states:
    demo("Resting", `<div class="pfm" style="width:100%">${sbBar()}</div>`) +
    demo("Typing in it (keyboard or tap): the edge turns green with a soft green glow", `<div class="pfm" style="width:100%">${sbBar({ icls: "is-focus", value: "east" })}</div>`) +
    demo("Filters, reached by keyboard: a green ring. Under the pointer nothing changes (live: it brightens a little, a filter, which goes).", `<div class="pfm" style="width:100%">${sbBar({ fcls: "is-focus", count: 2 })}</div>`) +
    demo("Result row under the pointer: a light green tint (live: bone 100). Point at any row.", `<div class="pfm" style="width:100%"><div class="pfm-pop"><ul role="listbox" aria-label="Pointer example">${resultRow(RES[1]!, "is-hover")}</ul></div></div>`) +
    demo("Result row reached with the arrow keys: sage 50, a paler green than the pointer's", `<div class="pfm" style="width:100%"><div class="pfm-pop"><ul role="listbox" aria-label="Keyboard example">${resultRow(RES[0]!, "act")}</ul></div></div>`) +
    demo("See all row: pointer over it (light green), then keyboard (ring inside the row)", `<div class="pfm" style="width:100%"><div class="pfm-pop">${seeAll("is-hover")}${seeAll("is-focus")}</div></div>`) +
    demo("Category button: resting, pointer over it (light green; live: bone 200), keyboard", `<div class="pfm pfm-chips">${chip("pantry", "Food Pantry")}${chip("pantry", "Food Pantry", "is-hover")}${chip("pantry", "Food Pantry", "is-focus")}</div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The bar and the drop-downs") +
    sw("Bone 300", "color-bone-300", `The bar's edge. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1, decoration only: the magnifier, the word Search and a soft shadow mark the bar`) +
    swr("Ink 400", "color-ink-400", "The magnifier, the word Search before typing, distances, the more-matches line, the No matches hint") +
    swr("Ink 700", "color-ink-700", "Typed words and result names") +
    swr("Ink 500", "color-ink-500", "The Filters icon with nothing on") +
    swr("Sage 600", "color-sage-600", "The Filters icon with filters on, the list icon on See all", "color-bone-50", 3) +
    sw("Brand orange", "color-brand-orange", `The count beside the Filters icon. Navy number on it: ${r("color-brand-navy", "color-brand-orange")}`) +
    swr("Sage 700", "color-sage-700", "The See all words") +
    swr("Sage 500", "color-sage-500", "Typing edge and every keyboard ring", "color-bone-50", 3) +
    sw("Sage 50", "color-sage-50", `The row the arrow keys have reached. Ink 700 name on it ${r("color-ink-700", "color-sage-50")}; distances in ink 400 ${r("color-ink-400", "color-sage-50")}`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer (redesign; live is bone 100, bone 200 on the category buttons). Ink 700 on it ${r("color-ink-700", "color-sage-100")}, sage 700 ${r("color-sage-700", "color-sage-100")}, ink 400 distances ${r("color-ink-400", "color-sage-100")}`) +
    sw("Bone 100", "color-bone-100", `The category buttons. Ink 700 words on it ${r("color-ink-700", "color-bone-100")}`) +
    sw("Category colors", "color-cat-blessing", `The category word under each result. All pass on bone 50 (see Category label). On the pointer's sage 100 and the keyboard's sage 50 some fall short; see the list below`),
  colorsExtra: `<h4 style="margin:14px 0 6px">Category words on the result row's tints</h4><p class="dssz">The decided label under a result name, on the two fills a row can take. A ✗ is under 4.5 to 1.</p>${catRatios("color-sage-100", "sage 100 (pointer)")}${catRatios("color-sage-50", "sage 50 (arrow keys)")}`,
  sizes: "48 pixels tall on a phone, 52 on a computer, fully round, 16 pixels in from the screen sides; 520 wide on a computer. Magnifier 16 pixels (18 on a computer), 12 in from the left. Typed words 16 pixels on a phone so the phone doesn't zoom in, 14 on a computer. Filters is 44 pixels drawn and 48 to tap, with a 1-pixel divider on its left; the count is 19 pixels tall. Drop-downs sit 8 pixels under the bar, corners 14, shadow 0 4 12 ink at 6%. Result rows 52 tall; the See all row 46; category buttons 48 tall, fully round, 8 apart.",
  wording: [
    "The bar says Search (Buscar) before you type; screen readers hear Search places (Buscar lugares). There is never a Search button: results show as you type.",
    "Filters (Filtros) is the icon's name; with filters on it's heard as Filters, 2 on.",
    "Under the rows: +4 more matches, then See all 7 matches as a list (Ver los 7 resultados en una lista).",
    "No matches: No matches for \"xyzzy\", then Try a category instead: (Sin resultados para \"xyzzy\", Prueba una categoría:). The buttons say the full category names.",
  ],
  everyone: [
    "Keyboard: Tab reaches the bar first on the map. The arrow keys move through the results (the row turns pale green); Enter opens it; Escape closes the list. Tab from the bar reaches See all.",
    "Screen reader: the bar is a search box with a list of suggestions. The number of matches is read out when it changes; each distance is read as 0.8 mi away.",
    "Touch: the bar is 48 tall and Filters 48 to tap. Result rows are 52 tall. The category buttons are 48 tall. The See all row (46) is under the 48-pixel floor; see Lives in.",
    "Color is never the only sign: the count is written, and every category is named, not only colored.",
  ],
  dd: dodont(
    [`<div class="pfm" style="width:100%">${sbBar({ count: 2 })}</div>`, "The Filters icon and its count sit inside the bar, side by side, so the bar reads as one search box."],
    [`<div class="pfm" style="width:100%">${sbBar({ count: 2 }).replace('class="cnt"', 'class="cnt over"')}</div>`, "A count hanging over the icon's corner. It covers the icon and reads as a mistake (Kyle, #539)."],
  ),
  code: [
    "src/components/SearchBar.tsx (the bar and the Filters icon)",
    "src/components/SearchResultsPopover.tsx (results while typing)",
    "src/components/EmptySearchPopover.tsx (No matches)",
    "src/components/MapWrapper.tsx:1806 (passes the Search and Search places words)",
    ...knownIssues([
      "SearchBar.tsx:244, the Filters icon uses PRESS_FEEDBACK (hover:brightness-105), the hover filter",
      "SearchResultsPopover.tsx:180 and :245, rows and See all hover to bone-100 (grey)",
      "SearchResultsPopover.tsx:242, the See all row is 46 pixels tall, under the 48-pixel floor",
      "EmptySearchPopover.tsx:88, category buttons hover to bone-200 (grey)",
    ]),
  ],
});

// ── Filters panel ────────────────────────────────────────────────────────────────────────────────────────────
const fpSwitch = (icon: string, label: string, n: number, on = false, cls = "", live = false) =>
  `<div class="swr">${icon}<span class="l">${label}</span><span class="n">${n}</span><button type="button" role="switch" class="tg${cls ? ` ${cls}` : ""}" aria-checked="${on}" aria-label="${label}"${live ? ` onclick="${q("this.setAttribute('aria-checked',this.getAttribute('aria-checked')==='true'?'false':'true')")}"` : ""}><span></span></button></div>`;
const fpCat = (c: string, n: string, on = false, cls = "") =>
  `<label class="ck${cls ? ` ${cls}` : ""}"><input type="checkbox"${on ? " checked" : ""}><i style="background:var(--color-cat-${c})" aria-hidden="true"></i><span>${n}</span></label>`;
const evStarSmall = `<svg class="i ev" viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg>`;
const filterPanel = (live = false) => `<div class="pfm pfm-fp" role="dialog" aria-label="Filters">
  <div class="hd"><h2>Filters</h2><button type="button" class="clr"${live ? say2("Mockup: this would clear the kinds of place and the switches, never the search words.") : ""}>Clear all</button><button type="button" class="x" aria-label="Close filters"${live ? say2("Mockup: this would close Filters.") : ""}>${ic("x")}</button></div>
  <div class="bd"><div class="lab">Show only</div>
  ${fpSwitch(evStarSmall, "Events", 3, false, "", live)}${fpSwitch(ic("clock"), "Open now", 18, true, "", live)}${fpSwitch(ic("card"), "Accepts SNAP", 41, false, "", live)}${fpSwitch(ic("apple"), "Accepts WIC", 12, false, "", live)}
  <div class="rule" aria-hidden="true"></div><div class="lab">Kind of place</div>
  ${FULL.map(([c, n], i) => fpCat(c, n, i === 0)).join("")}</div>
  <div class="ft"><button type="button" class="pfm-or"${live ? say2("Mockup: this would close Filters. The map has already changed behind it.") : ""}>Show 24 places</button></div></div>`;

const filtersPanel = entry({
  id: "filters-panel", name: "Filters panel (FilterPanel)", status: "changing",
  statusNote: "What changes: the pointer tint on the kinds of place and on the × becomes sage 100 (live: bone 100, grey); Clear all, the × and Show 24 places no longer brighten under the pointer (a filter). The rulings give the orange button nothing in its place. Everything else is live.",
  purpose: "Narrows what the map shows. It slides in from the left, over a dimmed map, when Filters in the search bar is tapped. Every switch and tick applies at once, so the map changes behind it; the orange button only closes the panel and says how many places are left.",
  instead: [
    "You want one place by name: type it in the search bar.",
    "You only want blessing boxes: Boxes in the bottom bar is the one-tap shortcut.",
    "It's a picking job where nothing should change until you finish (choosing rows in the admin): that ends on Done. Here every tick applies at once, so the button only closes.",
  ],
  versions: wide("The panel. Flip the switches and tick the kinds of place; the buttons say what they'd do. On a phone it's 85% of the screen wide; on a computer 360.", filterPanel(true)),
  states:
    demo("Switch: off, then on, then reached by keyboard (a green ring with a gap)", `<div class="pfm pfm-fp mini">${fpSwitch(ic("clock"), "Open now", 18)}${fpSwitch(ic("clock"), "Open now", 18, true)}${fpSwitch(ic("clock"), "Open now", 18, true, "is-focus")}</div>`) +
    demo("Kind of place: resting, ticked, pointer over it (light green; live: bone 100)", `<div class="pfm pfm-fp mini">${fpCat("grocery", "Grocery / Supermarket")}${fpCat("grocery", "Grocery / Supermarket", true)}${fpCat("grocery", "Grocery / Supermarket", false, "is-hover")}</div>`) +
    demo("Clear all under the pointer (darker green words), and the × under the pointer (light green; live: bone 100)", `<div class="pfm pfm-fp mini"><div class="hd"><h2>Filters</h2><button type="button" class="clr is-hover">Clear all</button><button type="button" class="x is-hover" aria-label="Close filters">${ic("x")}</button></div></div>`) +
    demo("Show 24 places: resting, then reached by keyboard (an orange ring with a gap; it fails the 3 to 1 edge rule, see colors). Under the pointer nothing changes once the filter goes.", `<div class="pfm pfm-fp mini"><div class="ft"><button type="button" class="pfm-or">Show 24 places</button></div><div class="ft"><button type="button" class="pfm-or is-focus">Show 24 places</button></div></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The panel") +
    sw("Bone 200", "color-bone-200", "The lines under the title, between the two lists and above the button") +
    swr("Ink 700", "color-ink-700", "Title, switch names and kinds of place") +
    swr("Ink 400", "color-ink-400", "SHOW ONLY and KIND OF PLACE, and the counts") +
    swr("Ink 500", "color-ink-500", "The switch icons and the × at rest", "color-bone-50", 3) +
    swr("Sage 600", "color-sage-600", "Clear all, a switch that's on, a tick") +
    sw("Bone 300", "color-bone-300", `A switch that's off. ${r3("color-bone-300", "color-bone-50")} against the panel: under the 3 to 1 a switch needs to be seen. Its name and the white knob's position carry it today`) +
    sw("White", "white", `The switch knob. On sage 600 ${ratio("#FFFFFF", hex("color-sage-600"), 3)}; on bone 300 ${ratio("#FFFFFF", hex("color-bone-300"), 3)}`) +
    sw("Brand orange", "color-brand-orange", `Show 24 places. Navy words on it ${r("color-brand-navy", "color-brand-orange")}. Its keyboard ring is orange too: ${r3("color-brand-orange", "color-bone-50")} on the panel`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer (redesign; live is bone 100). Ink 700 on it ${r("color-ink-700", "color-sage-100")}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring on switches, ticks, Clear all and ×", "color-bone-50", 3),
  sizes: "85% of the screen wide, up to 360, full height, from the left; the map behind is dimmed with ink at 40%. Title row 16 pixels top and bottom, 24 at the sides. Every row is at least 48 tall with 24-pixel sides; the switch is drawn 36 by 24, but its whole row is the tap area. Ticks 16 pixels, category dots 10. The × is 48 round. The button is the full width, 48 tall, corners 10, 14-pixel bold words.",
  wording: [
    "Title Filters (Filtros). Clear all (Borrar todo) clears the kinds of place and the switches, never the search words.",
    "Two lists: SHOW ONLY (Mostrar solo) with Events, Open now, Accepts SNAP, Accepts WIC; KIND OF PLACE (Tipo de lugar) with the eight full category names.",
    "The button counts what's left: Show 24 places (Mostrar 24 lugares). With Events on: Show 3 events.",
    "Events only shows when there are events coming up.",
  ],
  everyone: [
    "Keyboard: focus moves into the panel and stays there; Tab goes round it. Escape, the ×, a tap on the dimmed map or a swipe to the left closes it, and focus goes back to Filters.",
    "Screen reader: it's a dialog named Filters. Each switch is heard as a switch, on or off, with its name; each kind of place is a real tick box.",
    "Touch: every row is 48 tall, and the whole switch row flips the switch.",
    "Color is never the only sign: a switch's knob moves across, a tick shows, and every kind of place is named beside its dot.",
  ],
  dd: dodont(
    [`<div class="pfm pfm-fp mini">${fpSwitch(ic("clock"), "Open now", 18, true)}<div class="ft"><button type="button" class="pfm-or">Show 18 places</button></div></div>`, "Changes apply at once, and the button says how many places are left."],
    [`<div class="pfm pfm-fp mini">${fpSwitch(ic("clock"), "Open now", 18, true)}<div class="ft"><button type="button" class="pfm-or">Apply</button></div></div>`, "An Apply button that holds the changes. People close the panel and lose them, and nothing says what's left."],
  ),
  code: [
    "src/components/FilterPanel.tsx",
    "Opened by the Filters icon in src/components/SearchBar.tsx; the filters themselves live in MapWrapper's useMapFilters",
    ...knownIssues([
      "FilterPanel.tsx:326, Clear all uses PRESS_FEEDBACK (hover:brightness-105)",
      "FilterPanel.tsx:337-338, the × hovers to bone-100 and uses PRESS_FEEDBACK",
      "FilterPanel.tsx:416, kinds of place hover to bone-100",
      "FilterPanel.tsx:452, Show N places brightens on hover (hover:brightness-105)",
      "FilterPanel.tsx:453, the keyboard ring is brand orange, 2.2 to 1 on bone-50, under 3 to 1",
      "FilterPanel.tsx:139, a switch that's off is bone-300 on bone-50, 1.5 to 1, under 3 to 1",
    ]),
  ],
});

// ── Map / list switch ────────────────────────────────────────────────────────────────────────────────────────
const vsRow = (toList = true, cls = "", live = false) =>
  `<div class="pfm pfm-pop"><button type="button" class="pfm-vs${cls ? ` ${cls}` : ""}"${live ? say2(toList ? "Mockup: this would switch to the list of all places." : "Mockup: this would switch back to the map.") : ""}>${ic(toList ? "list" : "map")}<span class="m"><span class="t">${toList ? "See all places as a list" : "Back to the map"}</span><span class="c">135 places</span></span><span class="ch" aria-hidden="true">›</span></button></div>`;
const menuItem = (label: string, icon = "", cls = "", live = false) =>
  `<li role="menuitem"><button type="button" class="pfm-mi${cls ? ` ${cls}` : ""}"${live ? say2(`Mockup: this would open ${label}.`) : ""}><span class="l">${label}</span>${icon ? `<span class="ico" aria-hidden="true">${ic(icon)}</span>` : ""}</button></li>`;

const viewSwitch = entry({
  id: "view-switch", name: "Map / list switch (ViewSuggestion)", status: "changing",
  statusNote: "What changes: the pointer tint becomes sage 100 (live: bone 100, grey). Everything else is live.",
  purpose: "The way from the map to a list of every place, and back. It isn't a standing control: tapping into the empty search bar drops down one row offering the other view. The Menu has the same choice as its first line, for anyone who never taps search; typed results end in See all matches as a list.",
  instead: [
    "A choice between two or three views that both stay on screen: use the slider (owner's ruling). This row only offers the view you're not in, so it's one button.",
    "You're narrowing what the map shows: that's Filters.",
  ],
  versions:
    wide("On the map: tap into the empty search bar and this row drops down", `<div class="pfm pfm-sbwrap">${sbBar({ icls: "is-focus" })}${vsRow(true, "", true)}</div>`) +
    wide("On the list: the same row offers the way back. Hidden when the map can't load on the device.", `<div class="pfm pfm-sbwrap">${sbBar({ icls: "is-focus" })}${vsRow(false, "", true)}<p class="pfm-lhd">135 places near you · Sorted by distance</p></div>`) +
    wide("In the Menu, first line: it names where it takes you", `<div class="pfm pfm-mn flat"><ul role="menu" aria-label="Menu">${menuItem("List view", "list", "", true)}${menuItem("Learn how to use this map", "", "", true)}</ul></div>`),
  states:
    demo("Resting", vsRow()) +
    demo("Pointer over it: light green (live: bone 100). Point at any of these rows.", vsRow(true, "is-hover")) +
    demo("Reached by keyboard: a green ring inside the row's edge", vsRow(true, "is-focus")),
  colors:
    sw("Bone 50", "color-bone-50", "The drop-down") +
    swr("Sage 700", "color-sage-700", "The words") +
    swr("Ink 500", "color-ink-500", "The count, 135 places") +
    swr("Sage 600", "color-sage-600", "The list or map icon", "color-bone-50", 3) +
    swr("Ink 400", "color-ink-400", "The › at the end", "color-bone-50", 3) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer (redesign; live is bone 100). Sage 700 on it ${r("color-sage-700", "color-sage-100")}, ink 500 ${r("color-ink-500", "color-sage-100")}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring", "color-bone-50", 3),
  sizes: "One row, 52 pixels tall, as wide as the search bar (520 on a computer), 8 pixels under it, corners 14, the drop-down's soft shadow. Icon 18 pixels, words 14 bold over a 12-pixel count. In the Menu it's an ordinary 48-pixel menu line.",
  wording: [
    "It names where it takes you, never the view you're in: See all places as a list (Ver todos los lugares en una lista), Back to the map (Volver al mapa).",
    "The count under it follows the filters, never the search words: 135 places.",
    "The Menu line is shorter: List view or Map view (Vista de lista, Vista de mapa).",
  ],
  everyone: [
    "Keyboard: Tab from the search bar reaches it, and it stays open while it has focus. Enter switches the view.",
    "Screen reader: a plain button; its words and the count are read together.",
    "Touch: 52 pixels tall, the full width of the bar.",
  ],
  dd: dodont(
    [`<div class="pfm pfm-sbwrap" style="width:100%">${sbBar({ icls: "is-focus" })}${vsRow()}</div>`, "One row that says where it goes, only when you reach for search."],
    [`<div class="pfm" style="width:100%"><div class="pfm-sb">${ic("search", "mag")}<input type="search" class="pfm-sbin wsw" placeholder="Search" aria-label="Don't example"><span class="pfm-oldsw" aria-hidden="true"><b>Map</b><span>List</span></span></div></div>`, "A Map and List switch squeezed into the bar. It took typing room and nobody read it (removed in #514)."],
  ),
  code: [
    "src/components/ViewSuggestion.tsx (the row under the empty bar)",
    "src/components/ListView.tsx (the list it opens: 135 places near you · Sorted by distance)",
    "src/components/SearchResultsPopover.tsx (See all 7 matches as a list) and src/components/HamburgerMenuContent.tsx (List view / Map view)",
    ...knownIssues(["ViewSuggestion.tsx:103, the row hovers to bone-100 (grey)"]),
  ],
});

// ── Map pins and the hover tooltip ───────────────────────────────────────────────────────────────────────────
// The pin shapes and the stacked-copy shadow are copied from VenueMarker.tsx, PinShadow.tsx and EventMarker.tsx.
const PIN_D = "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0";
const pinShadow = (px: number, base: number, shape: string) =>
  `<g transform="translate(0 ${(2 / px).toFixed(3)})" fill="#000" stroke="#000" stroke-linejoin="round">${([[8, 0.01], [6, 0.015], [4, 0.025], [2, 0.03], [1, 0.04]] as const).map(([g, o]) => `<g opacity="${o}" stroke-width="${(base + g / px).toFixed(3)}">${shape}</g>`).join("")}</g>`;
const pinShape = (cat: string) => `<g fill="var(--color-cat-${cat})" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${PIN_D}"/><circle cx="12" cy="10" r="3"/></g>`;
const placePinSvg = (cat: string, selected = false) => selected
  ? `<svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true" style="display:block;overflow:visible">${pinShadow(1, 4, `<circle cx="23" cy="23" r="21" fill="none"/>`)}<g transform="translate(5 5) scale(1.5)">${pinShadow(1.5, 1.5, `<path d="${PIN_D}"/>`)}</g><circle cx="23" cy="23" r="21" fill="none" stroke="var(--color-sage-500)" stroke-width="4"/><g transform="translate(5 5) scale(1.5)">${pinShape(cat)}</g></svg>`
  : `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" style="display:block;overflow:visible">${pinShadow(28 / 24, 1.5, `<path d="${PIN_D}"/>`)}${pinShape(cat)}</svg>`;
const tip = (name: string, cat: string, label: string) => `<span class="pfm-tip" role="tooltip"><b>${name}</b><span style="color:var(--color-cat-${cat})">${label}</span></span>`;
const placePin = (o: { name: string; cat: string; label: string; aria: string; x?: string; y?: number; selected?: boolean; cls?: string }) =>
  `<button type="button" class="pfm-pin${o.selected ? " sel" : ""}${o.cls ? ` ${o.cls}` : ""}" aria-label="${o.name}, ${o.aria}, 0.8 mi"${o.x ? ` style="left:${o.x};top:${o.y}px"` : ""}${o.x ? say2(`Mockup: this would open ${o.name}.`) : ""}><span class="pw">${placePinSvg(o.cat, o.selected)}</span>${tip(o.name, o.cat, o.label)}</button>`;
const eventPinSvg = (size: number) => {
  const w = ((size * 20) / 21.5).toFixed(2);
  return `<svg class="evsvg" width="${w}" height="${size}" viewBox="2 1 20 21.5" aria-hidden="true">${pinShadow(size / 21.5, 1.6, `<path d="${PIN_D}"/>`)}<path d="${PIN_D}" class="evshape"/><polygon points="12,5.6 13.12,8.46 16.19,8.64 13.81,10.59 14.59,13.56 12,11.9 9.41,13.56 10.19,10.59 7.82,8.64 10.88,8.46" class="evstar"/></svg>`;
};
const eventPin = (o: { live?: boolean; selected?: boolean; label: string; aria: string; x?: string; y?: number; cls?: string }) => {
  const size = o.live ? 52 : 44;
  return `<button type="button" class="pfm-evp${o.cls ? ` ${o.cls}` : ""}" data-live="${!!o.live}" data-selected="${!!o.selected}" aria-pressed="${!!o.selected}" aria-label="${o.aria}"${o.x ? ` style="left:${o.x};top:${o.y}px"` : ""}${o.x ? say2("Mockup: this would open the event's card.") : ""}><span class="bdy" style="--pin:${size}px">${o.live ? `<span class="ring" aria-hidden="true"></span><span class="ring late" aria-hidden="true"></span>` : ""}${o.selected ? `<span class="selr" aria-hidden="true"></span>` : ""}${eventPinSvg(size)}<span class="lbl" aria-hidden="true">${o.label}</span></span></button>`;
};
const pinStill = (html: string, h = 110) => `<div class="pfm pfm-ma still" style="height:${h}px">${html}</div>`;

const mapPins = entry({
  id: "map-pins", name: "Map pins and the hover tooltip (VenueMarker, EventMarker)", status: "changing",
  statusNote: "What changes: the category under the name in the hover tooltip becomes the decided label, colored words at 14 pixels, semi-bold (live: 11-pixel grey words under a 12-pixel name). The pins themselves are live as they are.",
  purpose: "Every place is a pin in its category's color with a white edge; tapping one opens its card. A computer shows a small tooltip with the name and kind when the pointer or the keyboard reaches a pin. Special events get their own bigger orange pin with a navy star and their time written over it, so they never read as one more place.",
  instead: [
    "Several places at the same spot, or a long list: use the list view.",
    "Something that's not a place or an event (a note about the area): it doesn't go on the map.",
  ],
  versions:
    wide("Place pins and two event pins on a stand-in map. Point at a place pin, or Tab to it, for the tooltip; tap any pin.", `<div class="pfm">${mapArea(
      placePin({ name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", aria: "Food pantry", x: "18%", y: 120 }) +
      placePin({ name: "Northgate Grocery Market", cat: "grocery", label: "Grocery / Supermarket", aria: "Grocery store", x: "40%", y: 76 }) +
      placePin({ name: "Mesa Street Community Garden", cat: "garden", label: "Community Garden", aria: "Community garden", x: "62%", y: 150 }) +
      placePin({ name: "Elm Street Blessing Box", cat: "blessing", label: "Blessing Box", aria: "Blessing box", x: "84%", y: 96 }) +
      placePin({ name: "Southside Meal Site", cat: "meal", label: "Meal Site", aria: "Meal site", x: "30%", y: 196, selected: true }) +
      eventPin({ label: "Sat 2 PM", aria: "Harvest Day, special event, Saturday 2 PM", x: "56%", y: 236 }) +
      eventPin({ live: true, label: "NOW, until 2 PM", aria: "Coat and Food Drive, special event, happening now, until 2 PM", x: "82%", y: 250 }), 270)}</div>`),
  states:
    demo("Place pin, resting", pinStill(placePin({ name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", aria: "Food pantry" }))) +
    demo("Pointer over it: the pin grows 15% and the tooltip shows (computer only)", pinStill(placePin({ name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", aria: "Food pantry", cls: "is-hover" }), 130)) +
    demo("Reached by keyboard: the browser's own outline, and the same tooltip", pinStill(placePin({ name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", aria: "Food pantry", cls: "is-focus" }), 130)) +
    demo("Its card is open: bigger, with a sage ring", pinStill(placePin({ name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", aria: "Food pantry", selected: true }))) +
    demo("Event coming up: orange pin, navy star, its day and time over it", pinStill(eventPin({ label: "Sat 2 PM", aria: "Harvest Day, special event, Saturday 2 PM" }), 120)) +
    demo("Event happening now: bigger, with two slow rings and a filled NOW label", pinStill(eventPin({ live: true, label: "NOW, until 2 PM", aria: "Coat and Food Drive, special event, happening now, until 2 PM" }), 130)) +
    demo("Event, its card open: a sage ring; keyboard: a green outline", pinStill(eventPin({ selected: true, label: "Sat 2 PM", aria: "Harvest Day, special event, Saturday 2 PM" }) + eventPin({ label: "Sat 2 PM", aria: "Harvest Day, keyboard example", cls: "is-focus" }), 120)),
  colors:
    sw("Category colors", "color-cat-pantry", "Each pin's fill, one per kind of place (Foundations lists all eight); the edge and center ring are white. The map under a pin changes, so its contrast isn't measured here") +
    swr("Sage 500", "color-sage-500", "The ring round a pin whose card is open, and an event pin's keyboard outline", "color-bone-50", 3) +
    sw("Brand orange (the event pin token, same hex)", "color-brand-orange", `An event pin's fill and its live rings. --color-event-pin in globals.css, kept apart from brand orange on purpose`) +
    sw("Brand navy (the event outline token, same hex)", "color-brand-navy", `An event pin's edge and star, and its label: ${r("color-brand-navy", "color-bone-50")} on bone 50; live, bone 50 on navy ${r("color-bone-50", "color-brand-navy")}`) +
    sw("Bone 50", "color-bone-50", `The tooltip and an event label. Tooltip edge sage 500 ${r3("color-sage-500", "color-bone-50")} inside`) +
    swr("Ink 700", "color-ink-700", "The name in the tooltip") +
    sw("Pantry red (each category has its own)", "color-cat-pantry", `The kind of place in the tooltip, as the decided label. ${r("color-cat-pantry", "color-bone-50")} on bone 50; every category passes there`),
  sizes: "Place pin 28 pixels; its card open, 36 inside a 46-pixel sage ring 4 wide. Each pin taps at 44 by 44, anchored at its point. Shadow: five see-through copies of the shape, 2 pixels down, never a filter. Event pin 44 tall coming up, 52 happening now, tapping at 48; its label is 12-pixel bold words, 2 pixels above the pin. Pointer over a pin: 15% bigger (events 8%, an open event 12%), over a tenth of a second. Tooltip up to 240 wide, corners 6, 4 by 8 padding, name 12 pixels semi-bold.",
  wording: [
    "The tooltip says the name, then the kind of place in full: Eastside Community Pantry, Food Pantry.",
    "A screen reader hears the name, a short kind and the distance: Eastside Community Pantry, Food pantry, 0.8 mi. The short kinds are lower case: Food pantry, Grocery store, Community garden, Blessing box.",
    "Event labels are short: Sat 2 PM, Today 2 PM, NOW, until 2 PM. Screen readers hear the name too: Harvest Day, special event, Saturday 2 PM.",
  ],
  everyone: [
    "Keyboard: every pin is a real button. Tab reaches them, Enter or Space opens the card, and the tooltip shows on focus as it does on hover.",
    "Screen reader: each pin says its name, kind and distance; an event pin says whether its card is open (pressed).",
    "Touch: there's no tooltip on a phone; a tap opens the card. Place pins tap at 44 pixels, under the 48 floor (see Lives in); event pins at 48.",
    "Motion: the live rings stop for anyone who has asked their phone for less motion.",
    "Color is never the only sign: events are a different shape, bigger, and carry their time; the open pin is bigger and ringed.",
  ],
  dd: dodont(
    [pinStill(eventPin({ label: "Sat 2 PM", aria: "Do example" }) + placePin({ name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", aria: "Food pantry" }), 110), "An event gets its own orange star pin with its time, beside the ordinary place pins."],
    [pinStill(placePin({ name: "Harvest Day", cat: "farm", label: "Event", aria: "Don't example" }) + placePin({ name: "Eastside Community Pantry", cat: "pantry", label: "Food Pantry", aria: "Food pantry" }), 110), "An event in an ordinary place pin. It reads as one more place, and nobody knows it's only on Saturday."],
  ),
  code: [
    "src/components/VenueMarker.tsx (place pin)",
    "src/components/PinShadow.tsx (the shadow, drawn as shapes)",
    "src/components/EventMarker.tsx and the .pfm-event-* rules in src/app/globals.css (event pin)",
    "src/components/Map.tsx:574 and .pfm-tooltip in src/app/globals.css:331 (tooltip)",
    ...knownIssues(["VenueMarker.tsx:42, MIN_HIT_SIZE = 44, so place pins tap at 44 pixels, under the 48-pixel floor"]),
  ],
});

// ── Phone card sheet and computer side panel ────────────────────────────────────────────────────────────────
const grab = (cls = "", live = false) => `<div class="pfm pfm-grab"><button type="button" class="${cls}" aria-expanded="false" aria-label="Show details"${live ? ` onclick="${q("const c=this.closest('.pfm-sheet').querySelector('.pfm-card');const open=c.classList.toggle('pfm-peek')===false;this.setAttribute('aria-expanded',open);this.setAttribute('aria-label',open?'Hide details':'Show details')")}"` : ""}><span aria-hidden="true"></span></button></div>`;
const phoneSheet = (live = false) => `<div class="pfm pfm-ma tall"><span class="pfm-mal">The map stands in here</span><div class="pfm-sheet">${grab("", live)}${card({ peek: true, live })}</div></div>`;
const popHeader = (cls = "", history = false) => `<div class="pfm-ph">${history ? `<a class="hist" href="#card-shells">History</a>` : ""}<span class="sp"></span><button type="button" class="x${cls ? ` ${cls}` : ""}" aria-label="Close">${ic("x")}</button></div>`;
const sidePanel = (back = false) => `<div class="pfm pfm-ma sde"><span class="pfm-mal">The map stands in here</span><div class="pfm-side">${back ? `<button type="button" class="bk">← Saved</button>` : ""}${popHeader()}<div class="sb">${card({ panel: true })}</div></div></div>`;

const cardShells = entry({
  id: "card-shells", name: "Phone card sheet and computer side panel (BottomSheet, DesktopSidePanel)", status: "changing",
  statusNote: "What changes: the × on the computer panel and the phone's keyboard-only Close take a sage 100 tint under the pointer (live: bone 100, grey), and neither the × nor the grab bar brightens under the pointer any more (a filter). Everything else is live.",
  purpose: "The two containers every card sits in: a place, a blessing box, an event, and on a computer the Saved list and the Menu too. On a phone it's a sheet that slides up from the bottom and follows the finger between two heights. On a computer it's one fixed panel on the right, and the map moves the chosen pin clear of it.",
  instead: [
    "It covers the whole screen and has to be closed before anything else (a photo, the route steps): use a full dialog.",
    "It's a short message, not a card (Location is off): use the location help card.",
  ],
  versions:
    wide("Phone, as it first opens: the summary, with the top of the details showing at the screen edge. Tap the grab bar to pull it up or down; swipe down to close.", phoneSheet(true)) +
    wide("Computer: the panel on the right of the map, always the full details, with the × in a bar along its top.", sidePanel()) +
    wide("Computer, opened from the Saved list: a ← Saved row above the bar takes you back.", sidePanel(true)),
  states:
    demo("Grab bar: resting", grab()) +
    demo("Grab bar reached by keyboard: a green ring. Under the pointer nothing changes (live: it brightens, a filter, which goes).", grab("is-focus")) +
    demo("Computer ×: resting, pointer over it (light green; live: bone 100), keyboard", `<div class="pfm pfm-side flat">${popHeader()}${popHeader("is-hover")}${popHeader("is-focus")}</div>`) +
    demo("Phone Close: hidden until the keyboard reaches it, then a 48-pixel button in the top corner", `<div class="pfm pfm-sheet still"><button type="button" class="pfm-hclose is-focus" aria-label="Close">${ic("x")}</button>${grab()}</div>`) +
    demo("← Saved: resting, then pointer over it (lighter green words)", `<div class="pfm pfm-side flat"><button type="button" class="bk">← Saved</button><button type="button" class="bk is-hover">← Saved</button></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "Both containers, the same paper as the page") +
    sw("Bone 300", "color-bone-300", `The grab bar. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1: faint for a control. It also has a name (Show details), and the sheet opens by tapping its peek or dragging anywhere`) +
    sw("Bone 200", "color-bone-200", `The computer panel's edge and the line under its bar. ${contrast(hex("color-bone-200"), PAPER).toFixed(1)} to 1, decoration: a heavy shadow lifts it off the map`) +
    swr("Ink 500", "color-ink-500", "The ×", "color-bone-50", 3) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on the × (redesign; live is bone 100). The × in ink 500 on it ${r3("color-ink-500", "color-sage-100")}`) +
    swr("Sage 700", "color-sage-700", "← Saved and History; sage 600 under the pointer") +
    swr("Sage 500", "color-sage-500", "Keyboard rings", "color-bone-50", 3),
  sizes: "Phone sheet: the full width, top corners 20, soft shadow; fully open it leaves 100 pixels of map showing at the top. Grab bar 64 by 5 inside a 48 by 48 button, so the bar is wider than its button. As it first opens, everything below the direction buttons sits under the screen edge with 64 pixels showing. Computer panel: 380 wide, 12 pixels from the top, right and bottom, corners 14, shadow 0 8 32 black at 18%. Its top bar is 44 tall with a 44-pixel × that taps at 48.",
  wording: [
    "The grab bar is heard as Show details or Hide details (Ver detalles, Ocultar detalles).",
    "The × is heard as Close (Cerrar). ← Saved (← Guardados) only shows when the card was opened from the Saved list.",
    "A blessing box card has History (Historial) on the left of the computer bar.",
  ],
  everyone: [
    "Phone: drag the sheet or tap the grab bar; swipe down to close; Escape closes it too. Close is hidden until the keyboard reaches it. While the sheet is down, the half-shown details can't be reached by Tab.",
    "Computer: when a card opens, focus moves to its name; Escape closes it and focus goes back to the pin. It isn't a trap: the map stays usable beside it.",
    "Screen reader: the phone sheet is named after the place (Eastside Community Pantry place details); the grab bar says whether the details are open.",
    "Touch: the grab bar, Close and the × all tap at 48.",
  ],
  dd: dodont(
    [`<div class="pfm" style="width:100%">${mapArea(`${sbBar()}<span class="pfm-dpanel" aria-hidden="true">Card</span><span class="pfm-dpin" aria-hidden="true"></span>`, 150, "tp dd")}</div>`, "One panel, always on the right; the map moves the pin clear of it."],
    [`<div class="pfm" style="width:100%">${mapArea(`${sbBar()}<span class="pfm-dpanel float" aria-hidden="true">Card</span><span class="pfm-dpin hi" aria-hidden="true"></span>`, 150, "tp dd")}</div>`, "A card floating beside the pin. Near the top it lands under the search bar (the old window, before #682)."],
  ),
  code: [
    "src/components/BottomSheet.tsx (phone sheet, grab bar, the two heights)",
    "src/components/DesktopSidePanel.tsx (computer panel shell: size, place, Escape and focus)",
    "src/components/DesktopVenueWindow.tsx (what the computer panel shows; ← Saved) and src/components/VenuePopupHeader.tsx (its top bar)",
    "src/lib/interactionStyles.ts (HIDDEN_UNTIL_FOCUS, the phone's keyboard-only Close)",
    ...knownIssues([
      "BottomSheet.tsx:829, the grab bar uses PRESS_FEEDBACK (hover:brightness-105)",
      "BottomSheet.tsx:938-939, the box card's Close hovers to bone-100 and uses PRESS_FEEDBACK",
      "VenuePopupHeader.tsx:40-41 and :71-72, History and the × hover to bone-100 and use PRESS_FEEDBACK",
    ]),
  ],
});

// ── Direction buttons and the route strip ───────────────────────────────────────────────────────────────────
// Made-up turns: Mapbox writes the real ones, in the visitor's language.
const stepper = (o: { n?: number; first?: boolean; cls?: string } = {}) => {
  const n = o.n ?? 2;
  return `<div class="pfm-ws"><p class="cnt">Step ${n} of 7</p><div class="ins" role="status">${ic("turnL")}<span>Turn left onto Example Avenue</span></div><p class="dist">In 280 ft</p><p class="then">Then: Turn right onto Sample Street</p><div class="nav"><button type="button" class="sn${o.cls ? ` ${o.cls}` : ""}" aria-label="Previous turn"${o.first ? " disabled" : ""}>${ic("chevL")}</button><button type="button" class="sn" aria-label="Next turn">${ic("chevR")}</button></div><button type="button" class="all" aria-expanded="false">All turns ${ic("chevR")}</button></div>`;
};
const routeOn = () => `<div class="pfm pfm-card pfm-pc pfm-rtc">${dirButtons({ walkActive: true })}<p class="pfm-rinfo"><span>0.6 mi walk</span><span aria-hidden="true">·</span><span>13 min</span></p>${stepper()}<div class="pfm-gm"><a href="#directions" aria-label="Open walking directions to ${V.name} in Google Maps (opens in new tab)"${say2("Mockup: this would open the walk in Google Maps.")}>Open in Google Maps</a></div></div>`;
const routeStrip = (o: { cls?: Record<string, string>; live?: boolean } = {}) => {
  const c = (k: string) => (o.cls?.[k] ? ` ${o.cls[k]}` : "");
  const s = (m: string) => (o.live ? say2(m) : "");
  return `<div class="pfm-rs"><div class="r1"><p class="nm">${V.name}</p><p class="inf">0.6 mi walk · 13 min</p></div><div class="r2"><button type="button" class="lk${c("clear")}"${s("Mockup: this would clear the route and close the card.")}>Clear walking route</button><div class="rt"><button type="button" class="stp${c("steps")}"${s("Mockup: this would open the turn-by-turn steps over the map.")}>${ic("steps")}Steps</button><button type="button" class="lk${c("show")}"${s("Mockup: this would bring the full card back.")}>Show card ${ic("chevU")}</button></div></div></div>`;
};
const stepsSheet = (cls = "") => `<div class="pfm-ss"><div class="hd"><p class="nm">${V.name}</p><button type="button" class="x${cls ? ` ${cls}` : ""}" aria-label="Close">${ic("x")}</button></div>${stepper()}</div>`;

const directions = entry({
  id: "directions", name: "Direction buttons and the route strip (DirectionButtons, RouteStrip)", status: "changing",
  statusNote: "What changes: Bus, Drive and the steps sheet's × take a sage 100 tint under the pointer (live: bone 100, grey), and nothing brightens under the pointer any more (a filter; live on Walk, Bus, Drive, the turn arrows, Steps and the text links). Everything else is live.",
  purpose: "Getting to a place. Walk draws the walking route right on the map, with one turn at a time; Bus and Drive open Google Maps. On a phone, starting a walk shrinks the card to a short strip so the route shows, with Steps and Show card a tap away.",
  instead: [
    "It's a blessing box: the address itself is the walking-route link; there's no Walk, Bus, Drive row.",
    "It's an event: one orange Get directions button that opens Google Maps.",
  ],
  versions:
    wide("Walk, Bus and Drive on a place card (the full card is the Place card entry above). Tap Walk to turn it into Clear walking route.", `<div class="pfm" style="width:100%">${dirButtons({ live: true })}</div>`) +
    wide("A walking route is on: the distance and time, then one turn at a time with Back and Next, All turns, and Open in Google Maps for the phone's own map. Shown at the computer size.", routeOn()) +
    wide("Walk with location off: a line says why nothing happened.", `<div class="pfm pfm-card pfm-pc">${dirButtons()}<p class="pfm-hint" role="status">Share your location to see walking directions.</p></div>`) +
    wide("Phone, route on: the card shrinks to this strip at the bottom of the screen. Tap its buttons.", `<div class="pfm pfm-ma tall"><span class="pfm-mal">The walking route shows on the map here</span><div class="pfm-sheet">${grab()}${routeStrip({ live: true })}</div></div>`) +
    wide("Phone, Steps: the turns open over the map, on the same turn as the card.", `<div class="pfm pfm-ma tall dim">${stepsSheet()}</div>`),
  states:
    demo("Back and Next: resting, pointer over it (sage 700), keyboard, and Back on the first turn (can't be pressed)", `<div class="pfm pfm-ws only"><div class="nav"><button type="button" class="sn" aria-label="Next turn">${ic("chevR")}</button><button type="button" class="sn is-hover" aria-label="Next turn, pointer">${ic("chevR")}</button><button type="button" class="sn is-focus" aria-label="Next turn, keyboard">${ic("chevR")}</button><button type="button" class="sn" disabled aria-label="Previous turn">${ic("chevL")}</button></div></div>`) +
    demo("Steps: resting, pointer over it (sage 700), keyboard (a ring with a gap)", `<div class="pfm pfm-rs only">${routeStrip({}).match(/<button type="button" class="stp[^>]*>[\s\S]*?<\/button>/)![0]}${routeStrip({ cls: { steps: "is-hover" } }).match(/<button type="button" class="stp[^>]*>[\s\S]*?<\/button>/)![0]}${routeStrip({ cls: { steps: "is-focus" } }).match(/<button type="button" class="stp[^>]*>[\s\S]*?<\/button>/)![0]}</div>`) +
    demo("Clear walking route and Show card: resting, pointer over it (darker green, underlined), keyboard", `<div class="pfm pfm-rs only"><button type="button" class="lk">Clear walking route</button><button type="button" class="lk is-hover">Clear walking route</button><button type="button" class="lk is-focus">Show card ${ic("chevU")}</button></div>`) +
    demo("Steps sheet ×: resting, pointer over it (light green; live: bone 100), keyboard", `<div class="pfm pfm-ss only"><button type="button" class="x" aria-label="Close">${ic("x")}</button><button type="button" class="x is-hover" aria-label="Close, pointer">${ic("x")}</button><button type="button" class="x is-focus" aria-label="Close, keyboard">${ic("x")}</button></div>`),
  colors:
    sw("Sage 600", "color-sage-600", `Walk, Back, Next and Steps fill: bone 50 or white words on it ${r("color-bone-50", "color-sage-600")}; sage 700 under the pointer. Also the text links, All turns, and the strip's Clear walking route and Show card: ${r("color-sage-600", "color-bone-50")} on bone 50`) +
    swr("Sage 700", "color-sage-700", "The route's distance and time") +
    swr("Ink 900", "color-ink-900", "The current turn, and the place name on the strip") +
    swr("Ink 400", "color-ink-400", "Step 2 of 7, the distance to the turn, the next turn") +
    swr("Ink 500", "color-ink-500", "Open in Google Maps, the location line, the steps sheet's ×") +
    sw("Bone 200", "color-bone-200", `A turn arrow that can't be pressed, with an ink 400 arrow (${r3("color-ink-400", "color-bone-200")}). Disabled controls don't need to meet the ratio`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on Bus, Drive and the ×, and Walk while a route is on (redesign; live is bone 100). Ink 500 × on it ${r3("color-ink-500", "color-sage-100")}`) +
    swr("Sage 500", "color-sage-500", "Keyboard rings", "color-bone-50", 3),
  sizes: "Walk, Bus and Drive share the card's width, 48 tall, 8 apart, corners 10. Back and Next are 48 by 48, corners 10, at the two ends of their row. The strip is 112 pixels tall with 24-pixel sides; the name is Fraunces 16. Turn arrows and the turn icon are 24 pixels. Steps is a fully round pill 36 tall; Clear walking route and Show card are 14-pixel words about 32 tall; the steps sheet's × is 36 by 36. The steps sheet rises from the bottom, up to 70% of the screen, top corners 20, over a 40% black dim.",
  wording: [
    "One word each: Walk, Bus, Drive (Caminar, Autobús, Manejar). Screen readers hear Walking directions to Eastside Community Pantry (opens on map); Bus and Drive say opens in new tab.",
    "While a route is on, Walk reads Clear walking route (Eliminar ruta a pie).",
    "The route: 0.6 mi walk · 13 min. The turns: Step 2 of 7, In 280 ft, Then: …, and You have arrived at the end. All turns (Todos los giros) opens the whole list.",
    "Strip: Steps (Pasos), Show card (Mostrar tarjeta). Open in Google Maps (Abrir en Google Maps).",
    "Location off: Share your location to see walking directions.",
  ],
  everyone: [
    "Keyboard: every control is a real button or link. Back and Next can't be pressed past the first or last turn.",
    "Screen reader: each new turn is read out when Back or Next is pressed; the location line is read out the moment it shows. The arrows are named Previous turn and Next turn.",
    "Touch: Walk, Bus, Drive, Back and Next are 48 pixels. On the strip, Steps (36), the two text links (about 32) and the steps sheet's × (36) are under the 48 floor; see Lives in.",
    "The steps sheet is a real dialog: focus moves in, Escape or a tap outside closes it, and focus goes back to Steps.",
  ],
  dd: dodont(
    [`<div class="pfm" style="width:100%">${routeStrip()}</div>`, "Steps is the strip's one filled button; Clear walking route and Show card are plain words."],
    [`<div class="pfm" style="width:100%">${routeStrip().replace('class="stp"', 'class="lk ul"').replace(/<svg[^>]*>[\s\S]*?<\/svg>Steps/, "Steps")}</div>`, "Three underlined links in one row. On a real walk nobody found Steps (#537)."],
  ),
  code: [
    "src/components/DirectionButtons.tsx (Walk, Bus, Drive; the route readout; WalkStepper)",
    "src/components/RouteStrip.tsx (the phone strip and the steps sheet)",
    ...knownIssues([
      "DirectionButtons.tsx:619, Walk, Bus and Drive use PRESS_FEEDBACK (hover:brightness-105); :642, Bus and Drive hover to bone-100",
      "DirectionButtons.tsx:247, :381, :563, :597, the turn arrows, All turns, Clear walking route and Open in Google Maps use PRESS_FEEDBACK",
      "RouteStrip.tsx:112, Clear walking route and Show card are about 32 pixels tall (py-1.5), under 48",
      "RouteStrip.tsx:122, Steps is 36 pixels tall (py-2), under 48, and uses PRESS_FEEDBACK",
      "RouteStrip.tsx:306-308, the steps sheet's × is 36 by 36 (h-9 w-9), hovers to bone-100 and uses PRESS_FEEDBACK",
    ]),
  ],
});

// ── Icon buttons: share and save ────────────────────────────────────────────────────────────────────────────
const shareBtn = (cls = "", copied = false, label = `Share ${V.name}`) => `<button type="button" class="pfm-ib share${cls ? ` ${cls}` : ""}" aria-label="${label}" title="${label}">${copied ? `<svg class="i ok" viewBox="0 0 24 24" aria-hidden="true">${ICONS.check}</svg><span class="sr" role="status">Link copied</span>` : ic("share")}</button>`;
const saveBtn = (cls = "", on = false) => `<button type="button" class="pfm-ib${cls ? ` ${cls}` : ""}" aria-pressed="${on}" aria-label="${on ? "Remove" : "Add"} ${V.name} ${on ? "from" : "to"} saved" title="${on ? "Remove" : "Add"} ${V.name} ${on ? "from" : "to"} saved">${ic("star")}</button>`;
const ibPair = (live = false) => {
  const tog = live ? ` onclick="${q("this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')==='true'?'false':'true')")}"` : "";
  const cp = live ? ` onclick="${q("const b=this,s=b.querySelector('svg');s.innerHTML=" + JSON.stringify(ICONS.check) + ";s.classList.add('ok');b.dataset.say='Mockup: Link copied.';setTimeout(()=>{s.innerHTML=" + JSON.stringify(ICONS.share) + ";s.classList.remove('ok')},2000)")}"` : "";
  return shareBtn().replace("<button ", `<button${cp} `) + saveBtn().replace("<button ", `<button${tog} `);
};
const nameRow = (name: string, live = false, pc = false) => `<div class="pfm pfm-card${pc ? " pfm-pc" : ""} pfm-ibdemo"><div class="pfm-namerow"><h2 class="pfm-name">${name}</h2>${ibPair(live)}</div></div>`;

const iconButtons = entry({
  id: "icon-buttons", name: "Icon buttons: share and save (ShareButton, FavoriteButton)", status: "changing",
  statusNote: "What changes: a sage 100 tint under the pointer (live: bone 100, grey), no brightening under the pointer (a filter), and the pair centers on the first line of the name beside it, however many lines the name takes (live: about 7 pixels low). Everything else is live.",
  purpose: "Two small square buttons beside a card's name: share the link to it, and save it to Saved. They're the same on place cards and blessing box cards, on a phone and a computer.",
  instead: [
    "The action needs words to be understood (Get directions, Add to calendar): use a button with words. The event card's own Share has words for that reason.",
    "It's a third or fourth action for one row: put them all in one three-dot menu (owner's ruling), not more icons.",
  ],
  versions:
    wide("Beside a one-line name. Tap share (it says Link copied with a tick where the phone has no share sheet) and the star.", nameRow(V.name, true)) +
    wide("Beside a long name: both stay on its first line.", nameRow("Saint Joseph Eastside Community Food Pantry", true)) +
    wide("Computer: icons a size smaller (18 pixels).", nameRow(V.name, true, true)),
  states:
    demo("Resting", `<div class="pfm pfm-ibs">${shareBtn()}${saveBtn()}</div>`) +
    demo("Pointer over it: light green; the share icon darkens. Point at any of them.", `<div class="pfm pfm-ibs">${shareBtn("is-hover")}${saveBtn("is-hover")}</div>`) +
    demo("Reached by keyboard: a green ring", `<div class="pfm pfm-ibs">${shareBtn("is-focus")}${saveBtn("is-focus")}</div>`) +
    demo("Saved: the star fills in clay", `<div class="pfm pfm-ibs">${saveBtn("", true)}</div>`) +
    demo("Link copied: a green tick for 2 seconds, and Link copied is read out", `<div class="pfm pfm-ibs">${shareBtn("", true)}</div>`),
  colors:
    swr("Ink 400", "color-ink-400", "Both icons at rest", "color-bone-50", 3) +
    swr("Ink 700", "color-ink-700", "The share icon under the pointer", "color-bone-50", 3) +
    swr("Clay 500", "color-clay-500", "The star once saved, filled", "color-bone-50", 3) +
    swr("Sage 600", "color-sage-600", "The tick after Link copied", "color-bone-50", 3) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer (redesign; live is bone 100). Icons on it: ink 400 ${r3("color-ink-400", "color-sage-100")}, ink 700 ${r3("color-ink-700", "color-sage-100")}, clay 500 ${r3("color-clay-500", "color-sage-100")}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring", "color-bone-50", 3),
  sizes: "48 by 48 to tap, corners 10, icon 20 pixels (18 on a computer). Each overlaps the card's padding by 4 pixels at the sides so the icons line up with the edge. Beside a title the pair centers on the title's first line (the button's middle on the middle of that 25-pixel line).",
  wording: [
    "No visible words. Screen readers and the pointer's tip say Share Eastside Community Pantry (Compartir …), Add Eastside Community Pantry to saved, Remove … from saved (Agregar … a guardados).",
    "After a copy: Link copied (Enlace copiado).",
  ],
  everyone: [
    "Keyboard: real buttons, in the order share then save.",
    "Screen reader: save says pressed or not pressed; Link copied is read out once.",
    "Touch: 48 by 48 each, side by side with no gap to miss.",
    "Color is never the only sign: a saved star fills in, a copy shows a tick.",
  ],
  dd: dodont(
    [nameRow("Saint Joseph Eastside Community Food Pantry"), "Centered on the name's first line."],
    [nameRow("Saint Joseph Eastside Community Food Pantry").replace("pfm-ibdemo", "pfm-ibdemo mid"), "Centered on the whole two-line name: the icons float between the lines and look lost."],
  ),
  code: [
    "src/components/ShareButton.tsx and src/lib/share.ts (the phone's share sheet, or copy)",
    "src/components/FavoriteButton.tsx",
    "Used in src/components/VenueCardBody.tsx and, through BottomSheet.tsx and DesktopVenueWindow.tsx, src/components/BoxCardBody.tsx",
    ...knownIssues([
      "ShareButton.tsx:75-77 and FavoriteButton.tsx:51-52, hover to bone-100 and PRESS_FEEDBACK (hover:brightness-105)",
    ]),
  ],
});

// ── Hours list ───────────────────────────────────────────────────────────────────────────────────────────────
const hoursDl = (rows: [string, string, boolean?][], cls = "") =>
  `<dl class="pfm-hours${cls ? ` ${cls}` : ""}">${rows.map(([d, t, today]) => `<div${today ? ' class="today" aria-current="date"' : ""}><dt>${d}${today ? '<span class="sr">, Today</span>' : ""}</dt><dd>${t}</dd></div>`).join("")}</dl>`;
const monthly = `<div class="pfm-mon"><p>Monthly</p><ul><li>2nd Tue of each month, 11am – 12pm</li><li>The 15th of each month, 9am – 11am</li></ul></div>`;
const TWO: [string, string, boolean?][] = [["Mon", "Closed"], ["Tue", "9am – 12pm, 1pm – 4pm"], ["Wed", "9am – 12pm, 1pm – 4pm", true], ["Thu", "Closed"], ["Fri", "9am – 12pm"], ["Sat", "Closed"], ["Sun", "Closed"]];

const hoursList = entry({
  id: "hours-list", name: "Hours list (HoursList)", status: "built",
  purpose: "A place's hours for the whole week, Monday first, with today marked. If a place also opens on a monthly pattern, a Monthly list follows under the week. The same list shows on the phone card and the computer panel.",
  instead: [
    "You only need today: the card's short line under the name (Open now · Closes 6pm) already says it.",
    "It's an event: its When section gives the one date and time.",
  ],
  versions:
    wide("Phone card size, 14 pixels, under the HOURS label", `<div class="pfm pfm-card"><section class="pfm-sec" aria-label="Hours"><h3>Hours</h3>${hoursDl(hoursRows)}</section></div>`) +
    wide("Computer size, 12 pixels, with two opening times on one day and a Monthly list", `<div class="pfm pfm-card pfm-pc"><section class="pfm-sec" aria-label="Hours"><h3>Hours</h3>${hoursDl(TWO)}${monthly}</section></div>`) +
    wide("The place's own page (/venue/…): its own copy, with no today line, because that page is built ahead of time and today would go stale", `<div class="pfm pfm-card pfm-vc"><section aria-label="Hours"><h3>HOURS</h3>${hoursDl(hoursRows.map(([d, t]) => [d, t] as [string, string]), "page")}</section></div>`),
  states:
    demo("Today: a green line on the left, the day in bold, both in sage 700", `<div class="pfm" style="width:100%">${hoursDl([["Thu", "2pm – 6pm", true]])}</div>`) +
    demo("Another day", `<div class="pfm" style="width:100%">${hoursDl([["Fri", "9am – 1pm"]])}</div>`) +
    demo("Closed all day: written out, never left blank", `<div class="pfm" style="width:100%">${hoursDl([["Sun", "Closed"]])}</div>`) +
    demo("Monthly only: some places have no weekly list at all", `<div class="pfm" style="width:100%">${monthly}</div>`),
  colors:
    swr("Ink 500", "color-ink-500", "Day names, and the Monthly label") +
    swr("Ink 700", "color-ink-700", "Times, and the monthly lines") +
    swr("Sage 700", "color-sage-700", "Today's day and times") +
    swr("Sage 500", "color-sage-500", "Today's line", "color-bone-50", 3),
  sizes: "Day column 48 pixels wide (28 on a computer), 12 pixels to the times; the place's own page also uses 48, with 16 to the times. Rows 4 apart with 2 pixels above and below. Today's line is 3 pixels, with the day 8 pixels from it; other days sit 12 in. Times are in the plain monospace font so they line up. 14 pixels on a phone, 12 on a computer. The list has no pointer or keyboard states: nothing in it can be pressed.",
  wording: [
    "Three-letter days, Monday first: Mon, Tue … Sun (Lun, Mar …).",
    "Times are lower case with no :00, joined by a spaced en dash: 9am – 1pm. Two times on one day are joined by a comma.",
    "A day with no hours says Closed (Cerrado). The monthly heading is Monthly (Mensual), with lines like 2nd Tue of each month, 11am – 12pm.",
  ],
  everyone: [
    "Screen reader: a list of terms and details, each day with its hours. Today is marked as the current date and also says , Today.",
    "Color is never the only sign: today also has the line and bold.",
    "Nothing in it takes focus, so Tab skips it.",
  ],
  dd: dodont(
    [`<div class="pfm" style="width:100%">${hoursDl(hoursRows.slice(0, 4))}</div>`, "Every day listed, Closed written out."],
    [`<div class="pfm" style="width:100%">${hoursDl(hoursRows.slice(1, 4))}</div>`, "Closed days left out. Nobody can tell closed from not known."],
  ),
  code: [
    "src/components/HoursList.tsx (used by VenueCardBody.tsx on the phone card and the computer panel)",
    "src/components/VenueContent.tsx:159-205 builds its own copy for the place's own page: no today line on purpose, since that page is built ahead of time and must never read today's date",
    "src/lib/hours.ts (the day order and the time format)",
  ],
});

// ── Event card ───────────────────────────────────────────────────────────────────────────────────────────────
// Made-up event. The site's own words come from events.card.* in src/lib/i18n.ts.
const EV = { name: "Harvest Day Food Giveaway", host: "Eastside Neighbors Group", day: "Saturday, November 14", time: "2 PM – 5 PM", venue: "Eastside Community Hall", addr: "200 Sample St, Pueblo, CO 81001", about: "Free fresh produce, bread and canned goods for every family that comes, while supplies last. Volunteers will help carry boxes to your car. No sign-up needed to receive food.", bring: "Bags or a box, and a cooler if you have one." };
type Phase = "upcoming" | "live" | "ended" | "cancelled";
const evBadge = (p: Phase) => `<p class="pfm-evb ${p}">${p === "live" ? `<i aria-hidden="true"></i>Happening now, ends in 1 hour` : { upcoming: "Starts in 2 days", ended: "This event has ended", cancelled: "Cancelled" }[p]}</p>`;
const evAction = (cls = "", live = false) => `<a class="pfm-eva${cls ? ` ${cls}` : ""}" href="#event-card" aria-label="Volunteer, example.org (opens in a new tab)"${live ? say2("Mockup: this would open the event's sign-up page in a new tab.") : ""}>${ic("globe")}<span class="m"><b>Volunteer</b><span>example.org</span></span>${ic("chevR")}</a>`;
const evSecondary = (cls = "", live = false) => `<div class="pfm-ev2"><button type="button" class="${cls}"${live ? say2("Mockup: this would share the event, or copy its link.") : ""}>${ic("share")}Share</button><button type="button"${live ? say2("Mockup: this would download a calendar file for the event.") : ""}>${ic("cal")}Add to calendar</button></div>`;
const evDirections = (cls = "", live = false) => `<a class="pfm-evd${cls ? ` ${cls}` : ""}" href="#event-card" aria-label="Get directions to ${EV.name} (opens in a new tab)"${live ? say2("Mockup: this would open Google Maps with directions.") : ""}>${ic("nav")}Get directions</a>`;
const eventCard = (o: { phase?: Phase; panel?: boolean; live?: boolean; first?: boolean } = {}) => {
  const p = o.phase ?? "upcoming";
  const active = p === "upcoming" || p === "live";
  const head = `<div class="tr">${evBadge(p)}${o.panel ? `<button type="button" class="x" aria-label="Close event details">${ic("x")}</button>` : ""}</div><div><h2 class="nm">${EV.name}</h2><p class="host">Hosted by ${EV.host}</p></div>`;
  const when = `<section><h3>When</h3><p class="day">${EV.day}</p><p class="tm">${EV.time}</p></section>`;
  const about = `<section><h3>About</h3><p class="ab">${EV.about}</p><button type="button" class="rm">Read more</button></section>`;
  const where = `<section><h3>Where</h3><div class="wh">${ic("pin")}<div><p class="vn">${EV.venue}</p><p>${EV.addr}</p><p class="mono">1.1 mi from you</p></div></div></section>`;
  const bring = `<section class="br"><h3>What to bring</h3><p>${EV.bring}</p></section>`;
  const endNote = p === "cancelled" ? `<p class="cn">Rain has closed the hall. We hope to see you next month.</p>` : p === "ended" ? `<p class="en">Looking for food today? See what is open right now.</p><a class="seeopen" href="#event-card">See places open now</a>` : "";
  const top = `${head}${p === "cancelled" || p === "ended" ? endNote : ""}${when}${about}${evAction("", o.live)}`;
  const rest = `${where}${bring}${active ? `${evSecondary("", o.live)}${evDirections("", o.live)}` : ""}`;
  return `<div class="pfm pfm-ev${o.panel ? " pc" : ""}">${o.first ? top : `${top}${rest}`}</div>`;
};
const hereLine = (cls = "", live = false) => `<button type="button" class="pfm-evh${cls ? ` ${cls}` : ""}"${live ? say2("Mockup: this would open the event's card.") : ""}><svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS.star}</svg>Event here Saturday</button>`;
const evStrip = (o: { live?: boolean; more?: number; cls?: string; tap?: boolean } = {}) =>
  `<div class="pfm-evs" data-live="${!!o.live}"><button type="button" class="op${o.cls ? ` ${o.cls}` : ""}"${o.tap ? say2("Mockup: this would open the event's card.") : ""}><svg viewBox="6 3.6 12 12" aria-hidden="true"><polygon points="12,5.6 13.12,8.46 16.19,8.64 13.81,10.59 14.59,13.56 12,11.9 9.41,13.56 10.19,10.59 7.82,8.64 10.88,8.46"/></svg><span class="m"><span class="stt">${o.live ? "Happening now, until 5 PM" : "Today 2 PM"}</span><span class="n">${EV.name}</span></span>${o.more ? "" : ic("chevR")}</button>${o.more ? `<button type="button" class="mo" aria-label="and ${o.more} more, show the events list"${o.tap ? say2("Mockup: this would open the events list.") : ""}>and ${o.more} more</button>` : ""}<button type="button" class="dx" aria-label="Hide ${EV.name} for today"${o.tap ? say2("Mockup: this would hide this event from the strip until tomorrow.") : ""}>${ic("x")}</button></div>`;
const evEmpty = (live = false) => `<div class="pfm-eve"><a class="sh" href="#event-card"${live ? say2("Mockup: this would open the Share an event form.") : ""}>Share an event</a><div class="nt" role="status"><span>No events coming up</span><button type="button"${live ? say2("Mockup: this would turn Events off and show places again.") : ""}>Show places again</button></div></div>`;

const eventCardEntry = entry({
  id: "event-card", name: "Event card (EventCardBody)", status: "changing",
  statusNote: "What changes: Share, Add to calendar and the computer's × take a sage 100 tint under the pointer (live: bone 100, grey), and nothing brightens under the pointer any more (a filter; live on the action button, Get directions, the Event here line and the strip). The rulings give the orange Get directions nothing in its place. Everything else is live.",
  purpose: "Everything about one special event, from its pin or the strip at the top of the map, in the same sheet and panel as a place card. A badge says when, then the name and host, When, About, the event's own link as a green button, Where, What to bring, Share and Add to calendar, and the orange Get directions last.",
  instead: [
    "It's a place that's open on a weekly or monthly pattern: that's a place card with its hours.",
    "You're telling people about an event: that's the Share an event form; its preview shows this same card.",
  ],
  versions:
    wide("Phone: the first view, before pulling the sheet up. The badge, name, When, About cut to three lines, and the action button.", eventCard({ first: true, live: true })) +
    wide("The whole card (on a computer, always all of it). Tap the buttons.", eventCard({ live: true, panel: true })) +
    wide("On the place card where an event is being held: one line opens the event.", `<div class="pfm pfm-card pfm-pc">${hereLine("", true)}</div>`) +
    wide("At the top of the map, under the search bar, on the day: the next event. Tap it, and the ×.", `<div class="pfm">${mapArea(sbBar() + evStrip({ tap: true }) + evStrip({ live: true, more: 2, tap: true }), 200, "tp")}</div>`) +
    wide("Events on in Filters, but none coming up", `<div class="pfm">${mapArea(evEmpty(true), 150, "bot")}</div>`),
  states:
    demo("Badge: coming up, happening now, ended, cancelled", `<div class="pfm pfm-evbs">${(["upcoming", "live", "ended", "cancelled"] as Phase[]).map(evBadge).join("")}</div>`) +
    demo("Action button: resting, pointer over it (sage 700), keyboard (a ring with a gap)", `<div class="pfm pfm-evst">${evAction()}${evAction("is-hover")}${evAction("is-focus")}</div>`) +
    demo("Share: resting, pointer over it (light green; live: bone 100), keyboard", `<div class="pfm pfm-evst">${evSecondary()}${evSecondary("is-hover")}${evSecondary("is-focus")}</div>`) +
    demo("Get directions: resting, then keyboard (a navy ring with a gap). Under the pointer nothing changes once the filter goes.", `<div class="pfm pfm-evst">${evDirections()}${evDirections("is-focus")}</div>`) +
    demo("Event here line: resting, keyboard", `<div class="pfm pfm-evst">${hereLine()}${hereLine("is-focus")}</div>`) +
    demo("Strip, reached by keyboard: an orange ring inside it", `<div class="pfm" style="width:100%">${evStrip({ cls: "is-focus" })}</div>`) +
    demo("Ended: no Get directions, Share or calendar; a way to places open now instead", eventCard({ phase: "ended", first: true })),
  colors:
    sw("Brand navy (the event outline token, same hex)", "color-brand-navy", `A coming-up badge's words and edge, the Event here line, the strip. Navy on bone 50 ${r("color-brand-navy", "color-bone-50")}; bone 50 on navy ${r("color-bone-50", "color-brand-navy")}; the strip's white words ${ratio("#FFFFFF", hex("color-brand-navy"))}`) +
    sw("Brand orange (the event pin token, same hex)", "color-brand-orange", `Get directions (navy words ${r("color-brand-navy", "color-brand-orange")}), the live badge's edge and dot, the strip's star and its status line: orange on navy ${r("color-brand-orange", "color-brand-navy")}. The owner-approved exception to orange being kept for the find-food buttons`) +
    sw("Sage 600", "color-sage-600", `The action button. White words ${ratio("#FFFFFF", hex("color-sage-600"))}; the site name in sage 100 ${r("color-sage-100", "color-sage-600")}; sage 700 under the pointer`) +
    sw("Sage 50", "color-sage-50", `What to bring, with a sage 500 edge (${r3("color-sage-500", "color-sage-50")}). Heading sage 700 ${r("color-sage-700", "color-sage-50")}, words ink 900 ${r("color-ink-900", "color-sage-50")}`) +
    sw("Clay 100", "color-clay-100", `A cancelled badge, with a clay 500 edge and clay 700 words (${r("color-clay-700", "color-clay-100")}); the cancel note is clay 700 on bone 50, ${r("color-clay-700", "color-bone-50")}`) +
    sw("Bone 200", "color-bone-200", `An ended badge, with ink 700 words (${r("color-ink-700", "color-bone-200")})`) +
    swr("Ink 900", "color-ink-900", "The name, the day, the place name under Where") +
    swr("Ink 400", "color-ink-400", "WHEN, WHERE, ABOUT and the pin icon") +
    swr("Ink 500", "color-ink-500", "Hosted by, and the distance") +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on Share, Add to calendar and the × (redesign; live is bone 100). Ink 700 on it ${r("color-ink-700", "color-sage-100")}`) +
    sw("Brand orange as a ring", "color-brand-orange", `The strip's keyboard ring, drawn inside it: ${r3("color-brand-orange", "color-brand-navy")} on navy. Get directions' ring is navy: ${r3("color-brand-navy", "color-bone-50")}`),
  sizes: "Phone: 24 pixels in from the sides. Badge fully round, 2-pixel edge, 14-pixel bold words. Name in Fraunces 24. Section labels 11 pixels, capitals. The action button is the full width, at least 60 tall, corners 10, 22-pixel icon, 16 bold over a 12-pixel site name. Share and Add to calendar share a row, 48 tall each. Get directions is the full width, 56 tall, 16 bold. The Event here line is 48 tall with a navy edge. The strip is 48 tall, as wide as the search bar, 8 under it; its × is 48 wide.",
  wording: [
    "Badge: Starts in 2 days, Starts in 3 hours, Happening now, ends in 1 hour, This event has ended, Cancelled. It changes once a minute and is never read out on its own.",
    "Hosted by Eastside Neighbors Group. Sections: When, Where, About, What to bring (Cuándo, Dónde, Acerca del evento, Qué llevar). About ends in Read more (Leer más) only when it's cut.",
    "The action button says what the link is for: Visit website, Sign up, Get tickets, RSVP, Volunteer or Donate, with the site's name under it.",
    "Share, Add to calendar, Get directions (Compartir, Agregar al calendario, Cómo llegar). On a place card: Event here now, Event here today, Event here Saturday.",
    "The strip: Today 2 PM or Happening now, until 5 PM, over the name; and 2 more. With none coming up: No events coming up, Show places again, and Share an event.",
  ],
  everyone: [
    "Keyboard: on a phone the Close button is hidden until the keyboard reaches it, as on a place card; on a computer the × shows.",
    "Screen reader: the action button says where it goes and that it opens a new tab (Volunteer, example.org (opens in a new tab)); Get directions names the event. The strip's × says Hide Harvest Day Food Giveaway for today.",
    "Touch: every button is 48 or taller. The strip's and 2 more is 36 wide when it shortens to +2 on a phone under 360; see Lives in.",
    "Color is never the only sign: every badge is written out, and an ended or cancelled card loses the buttons that no longer help.",
  ],
  dd: dodont(
    [`<div class="pfm pfm-evst" style="width:100%">${evAction()}${evDirections()}</div>`, "One orange button, Get directions, last; the event's own link is green."],
    [`<div class="pfm pfm-evst" style="width:100%">${evAction().replace('class="pfm-eva"', 'class="pfm-eva or"')}${evDirections()}</div>`, "Two orange buttons. Neither stands out, and orange stops meaning go there."],
  ),
  code: [
    "src/components/EventCardBody.tsx (the card)",
    "src/components/EventHereLine.tsx (the line on a place card), src/components/EventStrip.tsx (the strip), src/components/EventsEmptyNotice.tsx (none coming up)",
    "src/lib/eventCard.ts (the badge, the When words, the action button's label); --color-event-pin and --color-event-outline in src/app/globals.css",
    ...knownIssues([
      "EventCardBody.tsx:125-126 and :278-279, Share, Add to calendar and the × hover to bone-100 and use PRESS_FEEDBACK (hover:brightness-105)",
      "EventCardBody.tsx:422 and :474, the action button and Get directions use PRESS_FEEDBACK",
      "EventHereLine.tsx:26 and EventStrip.tsx:83, :100, :113 use PRESS_FEEDBACK",
      "EventStrip.tsx:100, and 2 more is min-w-9 (36 pixels) when it shortens to +2 under 360 wide, under 48",
    ]),
  ],
});

// ── Blessing box card ────────────────────────────────────────────────────────────────────────────────────────
type BoxStatus = "stocked" | "low" | "empty" | "unknown" | "out";
const BOX_ST: Record<BoxStatus, [string, string]> = { stocked: ["Stocked", "filled 2 hours ago"], low: ["Running low", "filled 3 days ago"], empty: ["Empty", "filled 6 days ago"], unknown: ["Unknown", "no recent check-ins"], out: ["Out of service", "filled 2 weeks ago"] };
const boxPill = (s: BoxStatus, overlay = false) => `<div class="pfm-bxp ${s}${overlay ? " ov" : ""}"><i aria-hidden="true"></i><span class="w">${BOX_ST[s][0]}</span><span class="d">· ${BOX_ST[s][1]}</span></div>`;
const ckBtn = (label: string, dot = "", cls = "", dis = false) => `<button type="button" class="pfm-ck${cls ? ` ${cls}` : ""}"${dis ? " disabled" : ""}>${dot ? `<i class="${dot}" aria-hidden="true"></i>` : ""}${label}</button>`;
const BOX = { name: "Elm Street Blessing Box", addr: "300 Example Ln, Pueblo, CO 81001" };
const boxCard = (o: { photo?: boolean; live?: boolean; first?: boolean } = {}) => {
  const tap = (m: string) => (o.live ? say2(m) : "");
  const photo = o.photo ? `<div class="phw"><button type="button" class="img" aria-label="View photo full size"${tap("Mockup: this would open the photo full size.")}><span>Photo of the box</span></button>${boxPill("stocked", true)}<span class="cap">Photo · 2 hours ago</span></div>` : "";
  const top = `${photo}<div class="in"><div class="pfm-namerow"><h2 class="pfm-name">${BOX.name}</h2>${shareBtn("", false, `Share ${BOX.name}`)}${saveBtn().replaceAll(V.name, BOX.name)}</div>
    ${labelLine("blessing", "Blessing Box", [])}
    ${o.photo ? "" : boxPill("stocked")}
    <button type="button" class="pfm-bxa" aria-label="${BOX.addr}, walking directions to ${BOX.name} (opens on map)"${tap("Mockup: this would draw the walking route on the map.")}>${BOX.addr}</button>
    <section><h3>Most needed</h3><div class="pfm-bxn"><span>Canned food</span><span>Diapers</span><span>Pet food</span></div></section>
    <p class="hn">Kept by the Elm Street neighbors. Please leave food in sealed packages.</p>
    <section class="pfm-bxc" aria-label="Please update this box"><h3 class="hh">Please update this box</h3>
      <div class="g3">${ckBtn("I filled it", "ok")}${ckBtn("Running low", "wn")}${ckBtn("It's empty", "bd")}</div>
      <div class="g2">${ckBtn("I used this box")}${ckBtn("Add a photo")}</div>
      <button type="button" class="rp"${tap("Mockup: this would open a short note to report a problem.")}>Report a problem</button></section></div>`;
  const rest = `<div class="in"><div class="pfm-bxs"><p>This box needs a sponsor.</p><p class="sm">Want to help too? <button type="button"${tap("Mockup: this would open the sponsor form.")}>Apply to sponsor this box</button></p></div><div class="ft"><a href="#box-card"${tap("Mockup: this would open the box's history page.")}>History</a></div></div>`;
  return `<div class="pfm pfm-bx">${o.first ? top : `${top}${rest}`}</div>`;
};

const boxCardEntry = entry({
  id: "box-card", name: "Blessing box card (BoxCardBody)", status: "changing",
  statusNote: "What changes: the category becomes the decided label, Blessing Box in raspberry words on its own line under the name (live: a raspberry pill above the name, with share and save beside it); share and save move beside the name, centered on its first line; the check-in buttons and Cancel take a sage 100 tint under the pointer (live: bone 100, grey). Everything else is live, with a made-up box.",
  purpose: "A little free pantry on a post: how full it is, what it needs, and a one-tap way for anyone to say they filled it, took something or found it empty. Everything happens on the card, never on a separate page. The latest photo leads the card, with the box's status on it.",
  instead: [
    "It's a staffed place with hours: use the place card.",
    "You want the box's whole past: History opens its own page.",
  ],
  versions:
    wide("Phone, with a photo, first view. Tap the photo, the address (it draws the walking route) or Report a problem.", boxCard({ photo: true, live: true, first: true })) +
    wide("No photo yet: the status sits under the label. Shown whole, with the sponsor band and History at the end.", boxCard({ live: true })),
  states:
    demo("Status: Stocked, Running low, Empty, Unknown, Out of service. On a photo the pill is bone 50; without one, bone 100.", `<div class="pfm pfm-bxps">${(["stocked", "low", "empty", "unknown", "out"] as BoxStatus[]).map((s) => boxPill(s)).join("")}${boxPill("stocked", true).replace(" ov", " ovs")}</div>`) +
    demo("Check-in button: resting, pointer over it (light green; live: bone 100), keyboard, and Sending… while a tap goes through", `<div class="pfm pfm-bxc only"><div class="g2">${ckBtn("I filled it", "ok")}${ckBtn("I filled it", "ok", "is-hover")}${ckBtn("I filled it", "ok", "is-focus")}${ckBtn("Sending…", "ok", "", true)}</div></div>`) +
    demo("After a tap: a thank-you line, or a red line if it didn't go through", `<div class="pfm pfm-bxc only"><p class="okl" role="status">Thanks for filling it!</p><p class="bdl" role="alert">That didn't go through. Please try again.</p></div>`) +
    demo("Photo full size: the screen goes nearly black, with a round × and the photo's age", `<div class="pfm pfm-pv"><button type="button" class="x" aria-label="Close">×</button><span class="img">Photo of the box</span><p>Photo · 2 hours ago</p></div>`),
  colors:
    sw("Success green", "color-success", `Stocked, the dot on I filled it, thank-you lines. ${r("color-success", "color-bone-50")} on bone 50, ${r("color-success", "color-bone-100")} on bone 100`) +
    sw("Warning amber", "color-warning", `Running low. ${r("color-warning", "color-bone-50")} on bone 50, ${r("color-warning", "color-bone-100")} on bone 100`) +
    sw("Danger red", "color-danger", `Empty, error lines. ${r("color-danger", "color-bone-50")} on bone 50, ${r("color-danger", "color-bone-100")} on bone 100`) +
    sw("Ink 400", "color-ink-400", `Unknown and Out of service. ${r("color-ink-400", "color-bone-50")} on bone 50, ${r("color-ink-400", "color-bone-100")} on bone 100; the · filled detail is ink 500, ${r("color-ink-500", "color-bone-100")} on bone 100`) +
    sw("Blessing box raspberry", "color-cat-blessing", `The Blessing Box label under the name. ${r("color-cat-blessing", "color-bone-50")} on bone 50`) +
    swr("Sage 600", "color-sage-600", "The address (the walking-route link) and History; sage 700 under the pointer") +
    swr("Sage 700", "color-sage-700", "Report a problem") +
    sw("White", "white", `The check-in buttons, with a bone 300 edge (decoration, ${contrast(hex("color-bone-300"), "#FFFFFF").toFixed(1)} to 1) and ink 700 words (${ratio(hex("color-ink-700"), "#FFFFFF")})`) +
    sw("Bone 100", "color-bone-100", `Most needed tags, and the status pill without a photo. Ink 700 on it ${r("color-ink-700", "color-bone-100")}`) +
    sw("Clay 100", "color-clay-100", `This box needs a sponsor, in clay 700: ${r("color-clay-700", "color-clay-100")}. Once sponsored: sage 700 on sage 50, ${r("color-sage-700", "color-sage-50")}`) +
    sw("Sage 100", "color-sage-100", `Fill under the pointer on the check-in buttons (redesign; live is bone 100). Ink 700 on it ${r("color-ink-700", "color-sage-100")}`),
  sizes: "Photo 170 pixels tall, edge to edge, with the status pill 12 pixels in at its bottom left and the photo's age at its top right, both fully round. 16 pixels in from the sides, 12 between blocks. Name in Fraunces 20; the label 14 semi-bold. Check-in buttons at least 48 tall, corners 10, three to a row then two, 8 apart. The address, Report a problem, History and Apply to sponsor are links 44 tall with 2 extra pixels above and below to tap at 48. The full-size photo's × is 48 round.",
  wording: [
    "Statuses: Stocked, Running low, Empty, Unknown, Out of service (Surtida, Quedan pocas cosas, Vacía, Desconocido, Fuera de servicio), then · filled 2 hours ago or · no recent check-ins.",
    "Heading Please update this box. Buttons: I filled it, Running low, It's empty, I used this box, Add a photo, and a quiet Report a problem (La surtí, Quedan pocas cosas, Está vacía, Usé esta caja, Agregar una foto, Reportar un problema).",
    "While sending: Sending…. Thanks: Thanks for filling it!, Thanks for the heads up.",
    "Photos: Photos are reviewed before they're shown publicly. Please don't include faces or license plates.",
    "No sponsor: This box needs a sponsor. Want to help too? Apply to sponsor this box.",
  ],
  everyone: [
    "Keyboard: every check-in is a real button; while one is sending, all of them wait, so nothing is sent twice.",
    "Screen reader: thanks are read out, errors are read out at once. The address says it draws walking directions on the map. The photo opens in a real dialog; Escape closes it.",
    "Touch: every check-in is 48 tall; the links tap at 48.",
    "Color is never the only sign: every status is a word beside its dot.",
  ],
  dd: dodont(
    [`<div class="pfm pfm-bxps">${boxPill("low")}</div>`, "The status word in its color, with the dot and the last fill."],
    [`<div class="pfm pfm-bxps"><div class="pfm-bxp low"><i aria-hidden="true"></i></div></div>`, "A colored dot on its own. Nobody can tell amber from red, and a screen reader hears nothing."],
  ),
  code: [
    "src/components/BoxCardBody.tsx (the card; BoxCardBody.tsx:323, the category pill that becomes the label)",
    "src/components/BoxCheckinPanel.tsx (check-ins and photos), src/components/PhotoViewer.tsx (full-size photo)",
    "src/lib/blessingBoxes.ts:421-436 (the status colors); AdoptBoxForm.tsx and BoxAlertSignupForm.tsx (the sponsor and alert forms, not drawn here)",
    ...knownIssues([
      "BoxCheckinPanel.tsx:634, check-in buttons hover to bone-100; :182 and :838, Cancel and the needs tags hover to bone-100",
      "BoxCardBody.tsx:184 (StatusPill without a photo, bone-100) with src/lib/blessingBoxes.ts:430-436: Stocked (success, 4.4 to 1) and Running low (warning, just under 4.5) fall short for words on bone 100",
    ]),
  ],
});

// ── Menu panel ───────────────────────────────────────────────────────────────────────────────────────────────
const MENU_ITEMS: [string, string][] = [["List view", "list"], ["Learn how to use this map", ""], ["Show welcome screen", ""], ["Suggest a place", ""], ["Share an event", ""], ["Send us feedback", ""], ["About this map", ""], ["Browse all places", ""], ["Blessing box activity", ""], ["Food help programs", ""], ["Roadmap", ""]];
const mnHead = (title: string, cls = "") => `<div class="hd"><h2>${title}</h2><button type="button" class="x${cls ? ` ${cls}` : ""}" aria-label="Close menu">${ic("x")}</button></div>`;
const sponsorCard = (cls = "") => `<a class="spn${cls ? ` ${cls}` : ""}" href="#menu-panel" aria-label="Sponsored by Pueblo Food Project (opens in new tab)"><span class="m"><span class="k">Sponsored by</span><span class="v">Pueblo Food Project</span></span>${ic("ext")}</a>`;
const donateCard = (cls = "") => `<a class="dn${cls ? ` ${cls}` : ""}" href="#menu-panel" aria-label="Donate. Supports this map and Pueblo Food Project's other work (opens in new tab)"><span class="hc" aria-hidden="true">${ic("heart")}</span><span class="m"><span class="v">Donate</span><span class="k">Supports this map and Pueblo Food Project's other work</span></span>${ic("ext")}</a>`;
const langRow = `<div class="lang"><span>Language / Idioma</span><span class="tgl" role="radiogroup" aria-label="Language selection"><button type="button" role="radio" aria-checked="true">EN</button><button type="button" role="radio" aria-checked="false">ES</button></span></div>`;
const menuPanel = (live = false) => `<div class="pfm pfm-mn">${mnHead("Pueblo Food Map")}<div class="bd">${sponsorCard()}${donateCard()}<ul role="menu" aria-label="Open menu">${MENU_ITEMS.map(([l, i]) => menuItem(l, i, "", live)).join("")}</ul>${langRow}</div></div>`;
const SAVED: [string, string, string][] = [["pantry", "Eastside Community Pantry", "0.8 mi"], ["blessing", "Elm Street Blessing Box", "1.3 mi"], ["garden", "Mesa Street Community Garden", "2.1 mi"]];
const savedRow = (c: string, n: string, d: string, cls = "") => `<li><button type="button" class="sv${cls ? ` ${cls}` : ""}"><i style="background:var(--color-cat-${c})" aria-hidden="true"></i><span class="n">${n}</span><span class="d">${d}</span></button></li>`;
const savedPanel = `<div class="pfm pfm-mn">${mnHead("Saved places")}<div class="bd"><ul aria-label="Saved places">${SAVED.map(([c, n, d]) => savedRow(c, n, d)).join("")}</ul></div></div>`;
const savedEmpty = `<div class="pfm pfm-mn">${mnHead("Saved places")}<div class="bd"><div class="emp">${ic("star")}<p class="t">No saved places yet</p><p>Tap the star on any place to save it. It will show up here.</p></div></div></div>`;

const menuPanelEntry = entry({
  id: "menu-panel", name: "Menu panel (HamburgerMenu)", status: "changing",
  statusNote: "What changes: the pointer tint on menu lines, saved rows and the × becomes sage 100 (live: bone 100, grey); the ×, the sponsor card and the donate card no longer brighten under the pointer (a filter). Everything else is live.",
  purpose: "Everything that isn't on the map: the list view, the tour, the forms, the about and help pages, the sponsor and a way to donate, and the language. Menu in the bottom bar opens it; Saved opens the same panel showing only your saved places. On a phone it slides in from the right; on a computer it shows in the side panel on the right of the map.",
  instead: [
    "It acts on one place: it belongs on that place's card.",
    "It's used on most visits: it may earn a spot in the bottom bar, but a sixth item needs a mockup first.",
  ],
  versions:
    wide("Phone, from Menu: 80% of the screen wide, up to 384. Tap any line.", menuPanel(true)) +
    wide("From Saved: just your saved places, nearest first", savedPanel) +
    wide("From Saved, with nothing saved yet", savedEmpty),
  states:
    demo("Menu line: resting, pointer over it (light green, darker words; live: bone 100), keyboard (a ring inside the line)", `<div class="pfm pfm-mn flat"><ul role="menu" aria-label="States">${menuItem("Suggest a place")}${menuItem("Suggest a place", "", "is-hover")}${menuItem("Suggest a place", "", "is-focus")}</ul></div>`) +
    demo("Saved row under the pointer (light green; live: bone 100)", `<div class="pfm pfm-mn flat"><ul aria-label="States">${savedRow("pantry", "Eastside Community Pantry", "0.8 mi", "is-hover")}</ul></div>`) +
    demo("×: resting, pointer over it (light green), keyboard", `<div class="pfm pfm-mn flat">${mnHead("Pueblo Food Map")}${mnHead("Pueblo Food Map", "is-hover")}${mnHead("Pueblo Food Map", "is-focus")}</div>`) +
    demo("Sponsor and donate cards under the pointer: the edge darkens (live: they also brighten, a filter, which goes)", `<div class="pfm pfm-mn flat"><div class="bd">${sponsorCard("is-hover")}${donateCard("is-hover")}</div></div>`) +
    demo("Language: English chosen, then Spanish", `<div class="pfm pfm-mn flat">${langRow}${langRow.replace('aria-checked="true">EN', 'aria-checked="false">EN').replace('aria-checked="false">ES', 'aria-checked="true">ES')}</div>`),
  colors:
    sw("White", "white", `The phone panel (on a computer it's the side panel's bone 50). Ink 700 lines on it ${ratio(hex("color-ink-700"), "#FFFFFF")}`) +
    swr("Ink 900", "color-ink-900", "Line words under the pointer, Donate", "color-bone-50") +
    swr("Ink 400", "color-ink-400", "Icons at the end of a line", "color-bone-50", 3) +
    sw("Sage 100", "color-sage-100", `The sponsor card, with a sage 500 edge (${r3("color-sage-500", "color-sage-100")}). Pueblo Food Project in sage 700 ${r("color-sage-700", "color-sage-100")}; SPONSORED BY in ink 500 ${r("color-ink-500", "color-sage-100")}. Also the fill under the pointer (redesign; live is bone 100): ink 900 on it ${r("color-ink-900", "color-sage-100")}`) +
    sw("Bone 300", "color-bone-300", `The donate card's edge, ${contrast(hex("color-bone-300"), "#FFFFFF").toFixed(1)} to 1 on white, decoration: the words carry it. Ink 400 under the pointer`) +
    sw("Clay 100", "color-clay-100", `The circle behind the heart; the heart is clay 500, ${r3("color-clay-500", "color-clay-100")}`) +
    swr("Ink 500", "color-ink-500", "The donate line's small words, distances on saved rows") +
    sw("Ink 700", "color-ink-700", `The chosen language: bone 50 words on it ${r("color-bone-50", "color-ink-700")}`) +
    swr("Sage 500", "color-sage-500", "Keyboard rings", "color-bone-50", 3),
  sizes: "Phone: 80% of the screen wide, up to 384, full height, from the right, over the map dimmed with ink at 40%. Title row 16 pixels top and bottom, 24 at the sides; the × 48 round. Menu lines and saved rows at least 48 tall, 24-pixel sides, 14-pixel words. The heart's circle on the donate card is 48. Sponsor and donate cards 16 in from the sides, corners 14. Category dots on saved rows 10 pixels. The language switch taps at 48 for each half.",
  wording: [
    "Lines, in order: List view (or Map view), Learn how to use this map, Show welcome screen, Suggest a place, Share an event, Send us feedback, About this map, Browse all places, Blessing box activity, Food help programs, Roadmap (Sugerir un lugar, Envíanos tu opinión, Ideas y novedades …).",
    "The view line names where it takes you: List view on the map, Map view on the list.",
    "Saved: Saved places; empty, No saved places yet, then Tap the star on any place to save it. It will show up here.",
    "Never sponsor for money here: on this site sponsor means looking after a blessing box. The money card says Donate.",
    "Language / Idioma, with EN and ES.",
  ],
  everyone: [
    "Keyboard: on a phone, focus moves into the panel and stays there; Escape, the × or a tap outside closes it, and focus goes back to Menu or Saved. On a computer it's part of the side panel and isn't a trap.",
    "Screen reader: the lines are a menu of menu items. The sponsor and donate cards are plain links that say they open a new tab.",
    "Touch: every line is 48 tall with nothing between them to miss.",
  ],
  dd: dodont(
    [`<div class="pfm pfm-mn flat"><ul role="menu" aria-label="Do example">${menuItem("Suggest a place")}${menuItem("Send us feedback")}</ul></div>`, "Plain words on every line, the same as the page they open."],
    [`<div class="pfm pfm-mn flat"><div class="pfm-mnicons" aria-hidden="true">${ic("pin")}${ic("help")}${ic("flag")}${ic("star")}</div></div>`, "A grid of icons with no words. People guess wrong, and the old unlabelled menu was the only way into every page."],
  ),
  code: [
    "src/components/HamburgerMenu.tsx (the phone shell: place, dim, focus, Escape)",
    "src/components/HamburgerMenuContent.tsx (the lines, Saved, the sponsor and donate cards), src/components/HamburgerMenuItem.tsx (one line), src/components/LanguageToggle.tsx",
    "On a computer the same content shows in src/components/DesktopSidePanel.tsx",
    ...knownIssues([
      "HamburgerMenuItem.tsx:56 and HamburgerMenuContent.tsx:152, lines and saved rows hover to bone-100",
      "HamburgerMenuContent.tsx:124-125, the × hovers to bone-100 and uses PRESS_FEEDBACK (hover:brightness-105)",
      "HamburgerMenuContent.tsx:205 and :235, the sponsor and donate cards use PRESS_FEEDBACK",
    ]),
  ],
});

// ── Location help card and the splash's main button ──────────────────────────────────────────────────────────
const locCard = (denied = true, live = false) => `<div class="pfm-lh" role="status"><button type="button" class="x" aria-label="Close"${live ? say2("Mockup: this would close the card.") : ""}>${ic("x")}</button><div class="tt">${ic("pin")}<h2>${denied ? "Location is off" : "We couldn't find you"}</h2></div><p class="bd">${denied ? "No problem, you can still find food." : "Your phone took too long to find where you are. This happens a lot indoors."} Tap any pin on the map to see hours and directions.</p><div class="bt">${denied ? "" : `<button type="button" class="pfm-or rnd"${live ? say2("Mockup: this would ask for your location again.") : ""}>Try again</button>`}<button type="button" class="ol"${live ? say2("Mockup: this would switch to the list of all places.") : ""}>See all places as a list</button></div>${denied ? `<p class="hn">To use your location next time, turn it on in your browser or phone settings.</p>` : ""}</div>`;
const splashBtns = (live = false) => `<div class="pfm-spl"><button type="button" class="pfm-or big" lang="en"${live ? say2("Mockup: this would set English and find food near you.") : ""}>Find food near me</button><button type="button" class="pfm-or big" lang="es"${live ? say2("Mockup: this would set Spanish and find food near you.") : ""}>Encuentra comida cerca de mí</button><button type="button" class="tour"${live ? say2("Mockup: this would start the tour.") : ""}>Take a tour</button><p>We only use your location to show food nearby. Nothing is saved.</p></div>`;

const locationHelp = entry({
  id: "location-help", name: "Location help card and the splash's orange button (LocationHelpCard, SplashScreen)", status: "changing",
  statusNote: "What changes: the card's × and See all places as a list, and the splash's Take a tour, take a sage 100 tint under the pointer (live: bone 200, sage 50 and bone 100); no orange button brightens under the pointer any more (a filter), and the rulings give orange nothing in its place. Everything else is live.",
  purpose: "The orange button is the site's one loud action: Find food near me on the welcome screen, one per language. When the phone won't share its location, a card above the bottom bar says so kindly and offers a way on: try again, or see every place as a list.",
  instead: [
    "Any other action: use a sage button or a plain link. Orange is kept for finding food (the splash, Try again, Show 24 places in Filters) and the owner-approved event exception, Get directions.",
    "The message is about one place: it goes on that place's card.",
  ],
  versions:
    wide("Welcome screen: one button per language, then the tour", splashBtns(true)) +
    wide("Location is off: no Try again, since the phone will say no again", `<div class="pfm">${mapArea(locCard(true, true), 270, "bot")}</div>`) +
    wide("Location didn't work: Try again comes first", `<div class="pfm">${mapArea(locCard(false, true), 250, "bot")}</div>`),
  states:
    demo("Orange button: resting, then reached by keyboard (an orange ring with a gap, under 3 to 1 on the page). Under the pointer nothing changes once the filter goes; a press still dims it a little.", `<div class="pfm pfm-spl only"><button type="button" class="pfm-or big">Find food near me</button><button type="button" class="pfm-or big is-focus">Find food near me</button></div>`) +
    demo("See all places as a list: resting, pointer over it (light green; live: sage 50), keyboard", `<div class="pfm pfm-lh only"><div class="bt"><button type="button" class="ol">See all places as a list</button><button type="button" class="ol is-hover">See all places as a list</button><button type="button" class="ol is-focus">See all places as a list</button></div></div>`) +
    demo("Take a tour: resting, pointer over it (light green; live: bone 100), keyboard", `<div class="pfm pfm-spl only"><button type="button" class="tour">Take a tour</button><button type="button" class="tour is-hover">Take a tour</button><button type="button" class="tour is-focus">Take a tour</button></div>`) +
    demo("The card's ×: resting, pointer over it (light green; live: bone 200), keyboard", `<div class="pfm pfm-lh only xs"><button type="button" class="x" aria-label="Close">${ic("x")}</button><button type="button" class="x is-hover" aria-label="Close, pointer">${ic("x")}</button><button type="button" class="x is-focus" aria-label="Close, keyboard">${ic("x")}</button></div>`),
  colors:
    sw("Brand orange", "color-brand-orange", `The main button. Navy words on it ${r("color-brand-navy", "color-brand-orange")}. Its keyboard ring is orange too: ${r3("color-brand-orange", "color-bone-50")} on bone 50, ${r3("color-brand-orange", "color-bone-100")} on the card's bone 100`) +
    sw("Bone 100", "color-bone-100", `The location card. Navy title on it ${r("color-brand-navy", "color-bone-100")}; ink 700 words ${r("color-ink-700", "color-bone-100")}; the ink 500 hint ${r("color-ink-500", "color-bone-100")}; sage 600 button words and edge ${r("color-sage-600", "color-bone-100")}`) +
    swr("Sage 600", "color-sage-600", "The card's top band and pin icon, the outline button", "color-bone-100", 3, "bone 100") +
    swr("Sage 700", "color-sage-700", "Take a tour, on its sage 600 edge") +
    swr("Ink 500", "color-ink-500", "The line under the splash buttons, and the card's ×") +
    sw("Sage 100", "color-sage-100", `Fill under the pointer (redesign). Sage 600 on it ${r("color-sage-600", "color-sage-100")}, sage 700 ${r("color-sage-700", "color-sage-100")}, the ink 500 × ${r3("color-ink-500", "color-sage-100")}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring on the card's buttons and the tour", "color-bone-50", 3),
  sizes: "Splash buttons are the full width, about 50 pixels tall (18-pixel words, 16 above and below, 32 at the sides; 16 for the Spanish one on a phone), corners 10, 12 apart. Take a tour 48 tall with a 2-pixel sage edge. The card sits 12 pixels in from the sides, 6 above the bottom bar (420 wide on a computer), corners 14, a 4-pixel sage band along its top, 16-pixel padding. Its title is Fraunces 18; its buttons are 48 tall, fully round, 15-pixel bold words, 10 apart; the × is 48 round in the top corner.",
  wording: [
    "Find food near me / Encuentra comida cerca de mí: tapping one also picks the site's language.",
    "Under them: We only use your location to show food nearby. Nothing is saved.",
    "Card titles: Location is off, We couldn't find you (Ubicación desactivada, No pudimos encontrarte). Each ends with Tap any pin on the map to see hours and directions.",
    "Buttons: Try again (Intentar de nuevo), See all places as a list. Location off adds: To use your location next time, turn it on in your browser or phone settings.",
  ],
  everyone: [
    "Keyboard: real buttons. Escape closes the card. The card hides while any panel is open over the map.",
    "Screen reader: the card is a status, so it's read out when it shows. Each splash button carries its own language, so it's read in that language.",
    "Touch: every button is 48 or taller.",
  ],
  dd: dodont(
    [`<div class="pfm-lh only"><div class="bt"><button type="button" class="pfm-or rnd">Try again</button><button type="button" class="ol">See all places as a list</button></div></div>`, "One orange button; the other choice is a sage outline."],
    [`<div class="pfm-lh only"><div class="bt"><button type="button" class="pfm-or rnd">Try again</button><button type="button" class="pfm-or rnd">See all places as a list</button></div></div>`, "Two orange buttons side by side. Nothing says which one to press."],
  ),
  code: [
    "src/components/LocationHelpCard.tsx",
    "src/components/SplashScreen.tsx (the welcome screen)",
    "The same orange button: FilterPanel.tsx (Show N places) and LocationHelpCard.tsx (Try again)",
    ...knownIssues([
      "SplashScreen.tsx:215 and :240, both orange buttons brighten on hover (hover:brightness-105); :218 and :243, their keyboard ring is brand orange, 2.2 to 1 on bone-50, under 3 to 1",
      "SplashScreen.tsx:261, Take a tour hovers to bone-100",
      "LocationHelpCard.tsx:130-132, the × hovers to bone-200 and uses PRESS_FEEDBACK; :167, Try again uses PRESS_FEEDBACK; :182-184, the outline button hovers to sage-50 and uses PRESS_FEEDBACK",
    ]),
  ],
});

const all: [string, string, string][] = [
  ["bottom-nav", "Bottom bar", bottomNav], ["venue-card", "Place card", venueCard],
  ["search-bar", "Search bar", searchBar], ["filters-panel", "Filters", filtersPanel], ["view-switch", "Map / list switch", viewSwitch],
  ["map-pins", "Pins and tooltip", mapPins], ["card-shells", "Card sheet and side panel", cardShells], ["directions", "Directions and route strip", directions],
  ["icon-buttons", "Share and save", iconButtons], ["hours-list", "Hours list", hoursList], ["event-card", "Event card", eventCardEntry],
  ["box-card", "Blessing box card", boxCardEntry], ["menu-panel", "Menu panel", menuPanelEntry], ["location-help", "Location help and orange button", locationHelp],
];

export const pages: Page[] = [{
  slug: "components", route: "DESIGN.md → Components", title: "Design system: Components", area: "Design system", nav: "Components",
  blurb: "The map screen and its cards: the bottom bar, the place card, search, filters, pins, the card containers, directions, events, blessing boxes, the menu and the orange button.",
  changed: [
    "Bottom bar: hover becomes a light green tint (sage 100), and hover no longer flickers. Everything else is what's live.",
    "Place card: the same hover change on share, save, Bus and Drive; share and save line up with the name; the category becomes colored words under the name. Everything else is what's live, with made-up places.",
    "Decided and written in: the category label is colored words under the name (Kyle, 2026-11-08), and Boxes while it's on gets no hover fill (Kyle).",
    "Twelve new entries, in the order a visitor meets them: search bar, filters, the map / list switch, pins and the tooltip, the phone sheet and computer side panel, directions and the route strip, share and save, the hours list, the event card, the blessing box card, the menu, and the location card with the orange button.",
    "Across them, only your rulings change anything: every grey hover becomes sage 100, nothing brightens under the pointer, share and save sit on the name's first line, and every category shown on a place uses the decided label. Everything else is what's live.",
    "Each entry lists, under Lives in, what's live today that breaks a ruling or the 48-pixel floor, for the site fix.",
  ],
  kept: ["The map itself isn't drawn: a flat block stands in for it.", "The phone view is 360 pixels wide, the older Android phone the site is built for."],
  check: [
    "Orange buttons (Find food near me, Show 24 places, Try again, Get directions): with the brightening gone they show nothing under the pointer. The rulings don't say what replaces it. Keep it that way, or pick a look?",
    "The decided 14-pixel category label in two tight spots: under each search result's name, and in the map tooltip under a 12-pixel name. Does it fit, or do they keep their smaller size?",
    "The same label on a result row under the pointer (sage 100) or the arrow keys (sage 50): some category colors fall under 4.5 to 1 there (listed in the Search bar entry).",
    "Orange keyboard rings (splash, Filters) are 2.2 to 1 on the page, under the 3 to 1 an edge needs, and a switch that's off in Filters is 1.5 to 1.",
  ],
  html: `<div class="head"><h1>Components</h1></div>
  <p class="dsp" style="margin:0 0 12px">The parts of the inside pages (page top, footer, language switch, lists, forms, box numbers, not found, event page) are on <a href="components-pages.html">Components, pages and forms</a>.</p>
  ${toc([...all.slice(0, 2).map(([id, n]) => [`#${id}`, n] as [string, string]), ["#category-label", "Category label"], ...all.slice(2).map(([id, n]) => [`#${id}`, n] as [string, string]), ["foundations.html", "Foundations →"]])}
  ${all.map(([, , h]) => h).join("")}`,
}];
