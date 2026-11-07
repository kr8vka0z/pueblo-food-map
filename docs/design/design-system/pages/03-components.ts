// Design system: Components. Round 1 holds two entries, BottomNav and the venue card body, so the owner can settle
// the entry layout before the other ~25 are written. Each entry follows the design skill's template: status tag;
// what it's for and when to use something else; versions as working pieces; states as stills; shared colors
// (with contrast ratios) and sizes; wording; works for everyone; one live Do and one live Don't; the code file.
// The replicas copy the real classes, words and sizes from src/ (CSS in mock.css, "Pueblo Food Map: replicas").
// All venue data is made up. No Mapbox: a flat block stands in for the map.
import { contrast, dodont, hex, ratio, STATUS, sw, toc, type Page, type Status, type Token } from "../lib";

function entry(o: {
  id: string; name: string; status: Status; statusNote?: string; purpose: string; instead: string[];
  versions: string; states: string; colors: string; sizes: string; wording: string[]; everyone: string[];
  dd: string; code: string[]; extra?: string; // extra: a pick-one section shown right after Versions
}) {
  return `<section class="ds" id="${o.id}">
  <div class="dsh"><h2>${o.name}</h2><span class="st ${o.status}">${STATUS[o.status]}</span></div>
  ${o.statusNote ? `<p class="dsnote">${o.statusNote}</p>` : ""}
  <p class="dsp">${o.purpose}</p>
  <h3>Use something else when</h3><ul>${o.instead.map((i) => `<li>${i}</li>`).join("")}</ul>
  <h3>Versions</h3><div class="dsrow">${o.versions}</div>${o.extra ?? ""}
  <h3>States</h3><div class="dsrow">${o.states}</div>
  <h3>Shared colors and sizes</h3><ul class="sws">${o.colors}</ul><p class="dssz">${o.sizes}</p>
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
  const tap = (js: string, msg: string) => (live ? ` onclick="${q(js)}" data-say="${q(msg)}"` : ` tabindex="-1"`);
  const section = (key: "saved" | "top", label: string, icon: string) =>
    `<li><button type="button" class="pfm-it${c(key)}"${s.open === key ? ' aria-current="true"' : ""}${tap(`const on=this.getAttribute('aria-current')==='true';this.closest('ul').querySelectorAll('[data-sec]').forEach(b=>b.removeAttribute('aria-current'));if(!on)this.setAttribute('aria-current','true')`, `Mockup: this would ${key === "saved" ? "open your saved places" : "open the menu"}. Tap again to close it.`)} data-sec>${ic(icon)}<span>${label}</span></button></li>`;
  return `<ul>
    <li><button type="button" class="pfm-it${c("near")}"${s.locating ? ' disabled aria-busy="true"' : ""}${tap(`const b=this,s=b.querySelector('svg');b.disabled=true;b.setAttribute('aria-busy','true');s.innerHTML=${q(JSON.stringify(ICONS.loader))};s.classList.add('spinme');setTimeout(()=>{b.disabled=false;b.removeAttribute('aria-busy');s.classList.remove('spinme');s.innerHTML=${q(JSON.stringify(ICONS.locate))}},1600)`, "Mockup: this would ask for your location, then move the map to you.")}>${s.locating ? ic("loader", "spinme") : ic("locate")}<span>Near me</span></button>${s.locating ? '<span class="sr" aria-live="polite">Locating…</span>' : ""}</li>
    ${section("saved", "Saved", "star")}
    <li><button type="button" class="pfm-it${c("boxes")}" aria-pressed="${s.boxes ? "true" : "false"}"${tap(`this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')==='true'?'false':'true')`, "Mockup: this would show only blessing boxes, nearest first.")}>${ic("box")}<span>Boxes</span></button></li>
    <li><a class="pfm-it${c("help")}" href="#bottom-nav"${live ? ' data-say="Mockup: this would open the Food help programs page."' : ' tabindex="-1"'}>${ic("help")}<span>Help</span></a></li>
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
  statusNote: "What changes: hover becomes a light green tint; hover no longer flickers. Everything else is the bar as it is live today.",
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
    demo("Pointer over it: a light green tint, fading in with no flicker (mouse only, never sticks on a phone). Live today: a grey fill plus a brightening that flickers.", cell("saved", { cls: { saved: "is-hover" } })) +
    demo("Reached by keyboard: a green ring just inside the item's own edge",cell("saved", { cls: { saved: "is-focus" } })) +
    demo("Its panel is open (navy)", cell("saved", { open: "saved" })) +
    demo("Boxes on: raspberry, and the heart fills", cell("boxes", { boxes: true })) +
    demo("Working: Near me while locating. It can't be pressed again until it finishes; there is no other disabled look.", cell("near", { locating: true })),
  colors:
    sw("Bone 50", "color-bone-50", "The bar, the same paper as the page") +
    sw("Bone 300", "color-bone-300", `The bar's edge, as on the search bar. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1, decoration only: the words carry the items`) +
    swr("Ink 500", "color-ink-500", "Words and icons at rest") +
    swr("Navy", "color-brand-navy", "The item whose panel is open") +
    swr("Blessing box raspberry", "color-cat-blessing", "Boxes while it's on, words, icon and heart") +
    sw("Sage 50", "color-sage-50", `Fill under the pointer (proposed; live is bone 100). Words on it: ink 500 ${ratio(hex("color-ink-500"), hex("color-sage-50"))}, navy ${ratio(hex("color-brand-navy"), hex("color-sage-50"))}, raspberry ${ratio(hex("color-cat-blessing"), hex("color-sage-50"))} (Boxes on, under the pointer: under 4.5 to 1, as it already is on today's grey at ${contrast(hex("color-cat-blessing"), hex("color-bone-100")).toFixed(1)} to 1; flagged, no color changed)`) +
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
  code: ["src/components/BottomNav.tsx", "src/components/bottomNavShared.tsx (classes and the Boxes icon). Known live issue for the site fix: ITEM_CLASS uses PRESS_FEEDBACK from src/lib/interactionStyles.ts (hover:brightness-105, active:brightness-95), the hover filter that makes the fade stutter; its hover fill is bone-100","src/app/globals.css ([data-bottom-nav], --bottom-nav-clearance)", "docs/bottom-nav-spec.md"],
});

// ── Venue card body ──────────────────────────────────────────────────────────────────────────────────────────
// Made-up place. 555-01xx numbers are reserved for fiction.
const V = {
  name: "Eastside Community Pantry", address: "100 Example Ave, Pueblo, CO 81001", phone: "(719) 555-0142",
  miles: "0.8 mi", notes: "Bring a bag. Fresh produce on the first Saturday of each month while it lasts. No ID needed for your first visit.",
};
const hoursRows: [string, string, boolean?][] = [["Mon", "Closed"], ["Tue", "9am – 1pm"], ["Wed", "9am – 1pm"], ["Thu", "2pm – 6pm", true], ["Fri", "9am – 1pm"], ["Sat", "10am – 12pm"], ["Sun", "Closed"]];
type CardOpt = { panel?: boolean; saved?: boolean; walkActive?: boolean; hours?: "open" | "opens" | "closed" | "unknown"; live?: boolean; peek?: boolean; name?: string };
const hoursLine = (h: CardOpt["hours"] = "open") =>
  h === "unknown" ? `<span class="unk">${ic("unknown")}Hours unknown — call ahead</span>`
  : `<span>${ic("clock")}${{ open: "Open now · Closes 6pm", opens: "Opens at 2pm", closed: "Closed today" }[h]}</span>`;
const dirButtons = (o: CardOpt = {}) => {
  const say = (m: string) => (o.live ? ` data-say="${q(m)}"` : ' tabindex="-1"');
  return `<div class="pfm-dir">
    <button type="button" class="pfm-db walk${o.walkActive ? " active" : ""}" aria-label="${o.walkActive ? "Clear walking route" : `Walking directions to ${V.name} (opens on map)`}"${o.live ? ` onclick="${q("const a=this.classList.toggle('active');this.textContent=a?'Clear walking route':'Walk'")}" data-say="Mockup: this would draw the walking route on the map."` : ' tabindex="-1"'}>${o.walkActive ? "Clear walking route" : "Walk"}</button>
    <a class="pfm-db ext" href="#venue-card" aria-label="Bus directions to ${V.name} (opens in new tab)"${say("Mockup: this would open Google Maps with bus directions.")}>Bus</a>
    <a class="pfm-db ext" href="#venue-card" aria-label="Drive directions to ${V.name} (opens in new tab)"${say("Mockup: this would open Google Maps with driving directions.")}>Drive</a>
  </div>`;
};
const card = (o: CardOpt = {}) => {
  const live = o.live ? "" : ' tabindex="-1"';
  const say = (m: string) => (o.live ? ` data-say="${q(m)}"` : ' tabindex="-1"');
  const name = o.name ?? V.name;
  const body = `<div class="pfm-namerow"><h2 class="pfm-name">${name}</h2>
    <button type="button" class="pfm-ib share" aria-label="Share ${name}"${say("Mockup: this would share the link, or copy it.")}>${ic("share")}</button>
    <button type="button" class="pfm-ib" aria-pressed="${o.saved ? "true" : "false"}" aria-label="${o.saved ? "Remove" : "Add"} ${name} ${o.saved ? "from" : "to"} saved"${o.live ? ` onclick="${q("this.setAttribute('aria-pressed',this.getAttribute('aria-pressed')==='true'?'false':'true')")}"` : live}>${ic("star")}</button></div>
  <p class="pfm-op">Operated by <a href="#venue-card"${say("Mockup: this would open pueblofoodproject.org in a new tab.")}>Pueblo Food Project</a></p>
  <div class="pfm-badges"><span class="pfm-cat" style="background:var(--color-cat-pantry)"><i aria-hidden="true"></i>Food Pantry</span><span class="pfm-pill">SNAP</span><span class="pfm-pill">WIC</span></div>
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

// ── Category label: four options against today's pill (round 2) ────────────────────────────────────────────────
// Made-up places, one per category Kyle asked to see. Each option restyles the label and the SNAP / WIC tags.
type Cat = "pantry" | "grocery" | "garden";
const CATS: { cat: Cat; label: string; name: string; miles: string; hours: string; benefits: string[] }[] = [
  { cat: "pantry", label: "Food Pantry", name: "Eastside Community Pantry", miles: "0.8 mi", hours: "Open now · Closes 6pm", benefits: [] },
  { cat: "grocery", label: "Grocery / Supermarket", name: "Northgate Grocery Market", miles: "1.4 mi", hours: "Open now · Closes 9pm", benefits: ["SNAP", "WIC"] },
  { cat: "garden", label: "Community Garden", name: "Mesa Street Community Garden", miles: "2.1 mi", hours: "Opens at 8am", benefits: [] },
];
const catVar = (c: Cat | string) => `var(--color-cat-${c})`;
const catTok = (c: string) => `color-cat-${c}` as Token;
const ALL_CATS = ["pantry", "grocery", "convenience", "farm", "garden", "landscape", "meal", "blessing"];
const pinSvg = (c: Cat) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" fill="${catVar(c)}" stroke="#FFFFFF" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="none" stroke="#FFFFFF" stroke-width="1.5"/></svg>`;
const tick = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
type Opt = "today" | "a" | "b" | "c" | "d";
const labelRow = (o: Opt, x: (typeof CATS)[number]) => {
  const b = x.benefits;
  if (o === "today") return `<div class="pfm-badges"><span class="pfm-cat" style="background:${catVar(x.cat)}"><i aria-hidden="true"></i>${x.label}</span>${b.map((t) => `<span class="pfm-pill">${t}</span>`).join("")}</div>`;
  if (o === "b") return `<div class="pfm-badges"><span class="pfm-pinlab">${pinSvg(x.cat)}${x.label}</span>${b.map((t) => `<span class="pfm-ben">${tick}${t}</span>`).join("")}</div>`;
  if (o === "c") return `<div class="pfm-badges"><span class="pfm-tab" style="--c:${catVar(x.cat)}">${x.label}</span>${b.map((t) => `<span class="pfm-tab sm" style="--c:var(--color-sage-600)">${t}</span>`).join("")}</div>`;
  return `<div class="pfm-badges" style="gap:14px"><span class="pfm-ul" style="--c:${catVar(x.cat)}">${x.label}</span>${b.map((t) => `<span class="pfm-ul sm" style="--c:var(--color-sage-500)">${t}</span>`).join("")}</div>`;
};
const cardTop = (o: Opt, x: (typeof CATS)[number]) => {
  const kicker = o === "a" ? `<p class="pfm-kick"><span style="color:${catVar(x.cat)}">${x.label}</span>${x.benefits.map((t) => `<span class="and">·</span><span class="ben">${t}</span>`).join("")}</p>` : "";
  return `<div class="pfm pfm-card"><div class="pfm-top">${kicker}<div class="pfm-namerow"><h2 class="pfm-name">${x.name}</h2><button type="button" class="pfm-ib share" tabindex="-1" aria-label="Share ${x.name}">${ic("share")}</button><button type="button" class="pfm-ib" tabindex="-1" aria-pressed="false" aria-label="Add ${x.name} to saved">${ic("star")}</button></div>
  ${o === "a" ? "" : labelRow(o, x)}<div class="pfm-meta"><span>${ic("pin")}${x.miles} from you</span><span>${ic("clock")}${x.hours}</span></div></div></div>`;
};
const r = (fg: Token, bg: Token, need: 4.5 | 3 = 4.5) => ratio(hex(fg), hex(bg), need);
const lowest = (bg: Token) => { const [c, v] = ALL_CATS.map((c) => [c, contrast(hex(catTok(c)), hex(bg))] as const).sort((p, q) => p[1] - q[1])[0]; return `${c} ${v.toFixed(1)} to 1`; };
const OPTS: [Opt, string, string][] = [
  ["a", "A. Section kicker", `Small capital letters in the category's own color, no fill, above the name, like the section label over a newspaper story. Fits the Civic Editorial direction in DESIGN.md. Words on the card's bone 50: pantry ${r("color-cat-pantry", "color-bone-50")}, grocery ${r("color-cat-grocery", "color-bone-50")}, garden ${r("color-cat-garden", "color-bone-50")}; all eight categories pass, lowest ${lowest("color-bone-50")}. SNAP and WIC in sage 700 ${r("color-sage-700", "color-bone-50")}. No color failed, so none needed switching to ink.`],
  ["b", "B. Map-pin match", `The same pin shape and color as on the map, beside the label in ink 700. Ties the card to the pin that was tapped. Words: ink 700 on bone 50 ${r("color-ink-700", "color-bone-50")}. The pin is a shape: pantry ${r("color-cat-pantry", "color-bone-50", 3)}, grocery ${r("color-cat-grocery", "color-bone-50", 3)}, garden ${r("color-cat-garden", "color-bone-50", 3)} (3 to 1 needed). SNAP and WIC get a sage 700 tick, ${r("color-sage-700", "color-bone-50", 3)}.`],
  ["c", "C. Ledger tab", `A square-cornered tag (2-pixel corners) on bone 100 with a 4-pixel bar in the category color on the left, like a tab in a ledger. Words: ink 700 on bone 100 ${r("color-ink-700", "color-bone-100")}. The bar is decoration, the word carries the meaning. SNAP and WIC are smaller tabs with a sage 600 bar.`],
  ["d", "D. Plain underline", `The label in ink 700 with a 3-pixel underline in the category color. The quietest option: no shape at all. Words: ink 700 on bone 50 ${r("color-ink-700", "color-bone-50")}. The underline is decoration. SNAP and WIC get a thinner sage 500 underline. Note: an underline usually means a link, and these aren't links.`],
  ["today", "Today (live)", `The fully round pill in the category color with bone 50 words, for comparison. Words: pantry ${r("color-bone-50", "color-cat-pantry")}, grocery ${r("color-bone-50", "color-cat-grocery")}, garden ${r("color-bone-50", "color-cat-garden")}. SNAP and WIC: sage 700 on sage 100 ${r("color-sage-700", "color-sage-100")}.`],
];
const catOptions = `<h3 id="category-label">Category label: pick one</h3>
  <p class="dssz">Kyle: the round pill looks machine-made. Four other ways to show the category, each with the SNAP and WIC tags restyled to match, on three made-up places at phone width. Today's pill is last for comparison. Every ratio is worked out from the real colors when this page builds. On a computer each option is a real 360-pixel card; in the Phone view they're about 300 wide, so lines wrap a little sooner than on a real phone.</p>
  <div class="pfm-opts">${OPTS.map(([o, title, why]) => `<figure class="pfm-opt"><h4>${title}</h4>${CATS.map((x) => cardTop(o, x)).join("")}<figcaption>${why}</figcaption></figure>`).join("")}</div>`;

const venueCard = entry({
  id: "venue-card", name: "Place card (VenueCardBody)", status: "changing",
  statusNote: "What changes: hover becomes a light green tint; hover no longer flickers; share and save line up with the name. The category label may change too: pick one below. Everything else is the card as it is live today, with a made-up place.",
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
    demo("Pointer over it: Walk darkens to sage 700; Bus and Drive take a light green tint (proposed; live is grey). No flicker.", `<div class="pfm" style="width:100%">${dirButtons().replace("pfm-db walk", "pfm-db walk is-hover").replace('class="pfm-db ext"', 'class="pfm-db ext is-hover"')}</div>`) +
    demo("Reached by keyboard", `<div class="pfm" style="width:100%">${dirButtons().replace("pfm-db walk", "pfm-db walk is-focus")}</div>`) +
    demo("Walking route on the map: Walk turns into Clear walking route", `<div class="pfm" style="width:100%">${dirButtons({ walkActive: true })}</div>`) +
    demo("Open now", `<div class="pfm pfm-meta">${hoursLine("open")}</div>`) +
    demo("Opens later today", `<div class="pfm pfm-meta">${hoursLine("opens")}</div>`) +
    demo("Closed today", `<div class="pfm pfm-meta">${hoursLine("closed")}</div>`) +
    demo("No hours known: a different icon, so it's never read as open", `<div class="pfm pfm-meta">${hoursLine("unknown")}</div>`) +
    demo("Share and save: resting, pointer over it (light green tint, proposed), keyboard, saved", `<div class="pfm" style="display:flex;gap:16px;padding:8px"><button type="button" class="pfm-ib share" tabindex="-1" aria-label="Share">${ic("share")}</button><button type="button" class="pfm-ib share is-hover" tabindex="-1" aria-label="Share, pointer over it">${ic("share")}</button><button type="button" class="pfm-ib is-focus" aria-pressed="false" tabindex="-1" aria-label="Not saved, keyboard">${ic("star")}</button><button type="button" class="pfm-ib" aria-pressed="true" tabindex="-1" aria-label="Saved">${ic("star")}</button></div>`) +
    demo("Phone number: resting, pointer over it, keyboard (the browser's own outline: this link has no sage ring)",`<div class="pfm" style="display:flex;flex-direction:column;align-items:flex-start"><a class="pfm-tel" tabindex="-1">${ic("phone")}${V.phone}</a><a class="pfm-tel is-hover" tabindex="-1">${ic("phone")}${V.phone}</a><a class="pfm-tel is-focus" tabindex="-1">${ic("phone")}${V.phone}</a></div>`),
  colors:
    sw("Bone 50", "color-bone-50", "The card, the same paper as the page") +
    swr("Ink 900", "color-ink-900", "The place name") +
    swr("Ink 700", "color-ink-700", "Address, notes, hours, Bus and Drive words") +
    swr("Ink 500", "color-ink-500", "Distance and hours today, the operator line, the report button") +
    swr("Ink 400", "color-ink-400", "Section labels (HOURS, CONTACT), small icons, the star at rest") +
    swr("Sage 700", "color-sage-700", "Phone number, today's hours, SNAP and WIC words") +
    sw("Sage 600", "color-sage-600", `Walk button fill. Bone 50 words on it ${ratio(PAPER, hex("color-sage-600"))}; with the pointer over it sage 700, ${ratio(PAPER, hex("color-sage-700"))}`) +
    sw("Sage 100", "color-sage-100", `SNAP and WIC fill, and Walk while a route is on. Sage 700 words on it ${ratio(hex("color-sage-700"), hex("color-sage-100"))}; the sage 600 edge ${ratio(hex("color-sage-600"), hex("color-sage-100"), 3)}`) +
    swr("Sage 500", "color-sage-500", "Keyboard ring, today's line, the Plentiful link's edge", "color-bone-50", 3) +
    sw("Pantry red (each category has its own)", "color-cat-pantry", `Category badge fill. Bone 50 words on it ${ratio(PAPER, hex("color-cat-pantry"))}; every category passes, see Foundations`) +
    swr("Clay 500", "color-clay-500", "The star once saved", "color-bone-50", 3) +
    sw("Sage 50", "color-sage-50", `Fill under the pointer on share, save, Bus and Drive (proposed; live is bone 100). Words on it: ink 700 ${r("color-ink-700", "color-sage-50")}, ink 500 ${r("color-ink-500", "color-sage-50")}; the share icon in ink 700 and the star in ink 400 ${r("color-ink-400", "color-sage-50", 3)}`) +
    sw("Bone 300", "color-bone-300", `Bus, Drive and report button edges. ${contrast(hex("color-bone-300"), PAPER).toFixed(1)} to 1, decoration only: the words carry the buttons`),
  sizes: "Phone: 20 pixels in from the sides, 20 on top, 12 between blocks. Name in Fraunces 20, the rest in Public Sans 14 (labels 11 and the operator line 12). Share, Save, Walk, Bus, Drive and the Plentiful link are all 48 pixels to tap; the phone number is 44 tall with 2 extra pixels above and below to reach 48; the report button looks 36 tall and taps at 48. Corners 10 pixels on buttons, 20 on the top of the phone card, 14 on the computer window. Computer: 16 pixels of padding, words 12, labels 10, icons a size smaller.",
  wording: [
    "The category is spelled out: Food Pantry, Grocery / Supermarket, Community Garden, never a code.",
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

const all: [string, string, string][] = [["bottom-nav", "Bottom bar", bottomNav], ["venue-card", "Place card", venueCard]];

export const pages: Page[] = [{
  slug: "components", route: "DESIGN.md → Components", title: "Design system: Components", area: "Design system", nav: "Components",
  blurb: "The first two pieces, the bottom bar and the place card, so the layout of each entry can be settled.",
  changed: [
    "Bottom bar: hover becomes a light green tint, and hover no longer flickers. Everything else is what's live.",
    "Place card: the same hover change on share, save, Bus and Drive; share and save line up with the name. Four options for the category label. Everything else is what's live, with made-up places.",
    "Keyboard rings now follow each button's own shape in the pictures (a mockup fix; the live site draws them correctly).",
    "Each entry runs in the same order: what it's for, when to use something else, versions, states, colors and sizes, wording, works for everyone, do and don't, and where the code lives.",
  ],
  kept: ["The map itself isn't drawn: a flat block stands in for it.", "The phone view is 360 pixels wide, the older Android phone the site is built for."],
  check: [
    "Hover tint: the light green (sage 50) fill on the bar items, share, save, Bus and Drive, in place of the grey.",
    "Keyboard ring: it now lines up with the button's shape in every picture and on the live bars.",
    "Hover stutter: the brightening filter is gone, so hover is one clean color fade. The slight dim while pressing stays.",
    "Icon alignment: share and save sit on the middle of the name's first line, also when the name runs to two lines.",
    "Category label: pick A, B, C or D (or keep Today).",
  ],
  html: `<div class="head"><h1>Components</h1></div>
  ${toc([...all.map(([id, n]) => [`#${id}`, n] as [string, string]), ["#category-label", "Category label: pick one"], ["foundations.html", "Foundations →"]])}
  ${all.map(([, , h]) => h).join("")}`,
}];
