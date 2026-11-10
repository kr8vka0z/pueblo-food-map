// Building blocks for the mockups. Every page in pages/ is made only from these, so a look change happens once
// (here or mock.css). Names, numbers and addresses in the template pages are made up; keep yours made up too.
import { brand } from "./brand";

export type Page = {
  slug: string; // file name, no .html
  route: string; // the real address it stands for, e.g. /admin/customers
  title: string; // name in the index and on the review strip
  area: string; // heading it sits under in the index (one of brand.areas)
  nav: string; // admin menu item lit up ("" for none)
  blurb: string; // one line in the index: the biggest change
  changed: string[]; // Notes panel: What changes
  kept?: string[]; // Notes panel: Kept as is (messages, empty states, rules kept word for word that the mock doesn't show)
  check?: string[]; // Notes panel: Change for you to check (a call the owner should look at on purpose)
  html: string | ((all: Page[]) => string); // a function gets every page (the index uses it)
  bare?: boolean; // no admin menu (a sign-in page)
  narrow?: boolean;
};

// Colors, read from brand.ts so swatches and contrast ratios always match what's drawn.
export type Token = keyof typeof brand.colors;
export const hex = (t: Token) => brand.colors[t];
const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio of two #rrggbb colors, e.g. 4.5 */
export const contrast = (a: string, c: string) => { const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** "5.4 to 1 ✓" when it passes `need` (4.5 for words, 3 for edges and icons), else ✗. */
export const ratio = (a: string, c: string, need = 4.5) => { const r = contrast(a, c); return `${r >= 10 ? Math.round(r) : r.toFixed(1)} to 1 ${r >= need ? "✓" : "✗"}`; };

export const b = (tone: "ok" | "in" | "bd" | "wn" | "gr", text: string) => `<span class="b ${tone}">${text}</span>`;
/** Green tick with words, for the one all-is-well state (Paid, Done). Not a badge. */
export const okmark = (label = "Paid") => `<span class="okmark"><i aria-hidden="true">✓</i>${label}</span>`;
export const tag = (t: string) => `<span class="tag">${t}</span>`;
export const note = (tone: "wn" | "ok" | "bd" | "in", html: string) => `<p class="note ${tone}" role="status">${html}</p>`;
export const btn = (kind: "p" | "o" | "d", label: string, href?: string, extra = "") =>
  href ? `<a class="btn ${kind} ${extra}" href="${href}">${label}</a>` : `<button type="button" class="btn ${kind} ${extra}">${label}</button>`;
const q = (s: string) => s.replaceAll('"', "&quot;");
/** A button that shows a pop-up message (the toast) when pressed. */
export const say = (kind: "p" | "o" | "d", label: string, message: string, extra = "") =>
  `<button type="button" class="btn ${kind} ${extra}" data-say="${q(message)}">${label}</button>`;

/** Back to the list: white pill with an accent chevron chip. "← Customers" works too; the arrow is dropped for the chip. */
export const backlink = (label: string, href: string, attrs = "") =>
  `<a class="back" href="${href}"${attrs}><span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></span>${label.replace(/^←\s*/, "")}</a>`;
/** Go to a list: the back pill mirrored, chip on the right. */
export const fwdlink = (label: string, href: string) =>
  `<a class="back fwd" href="${href}">${label}<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span></a>`;

/** Page title row. `actions` is ready HTML, at most two buttons; the rest belong in the panel. No subtitle by default:
 *  `lead` exists only for the rare page where a line under the title earns its place. */
export function head(o: { back?: [string, string]; title: string; badge?: string; actions?: string; lead?: string }) {
  return `${o.back ? backlink(o.back[0], o.back[1]) : ""}
  <div class="head"><h1>${o.title}</h1>${o.badge ?? ""}<span class="sp"></span>${o.actions ? `<div class="row-btns">${o.actions}</div>` : ""}</div>
  ${o.lead ? `<p class="lead">${o.lead}</p>` : ""}`;
}

/** Facts band in the primary color. Each fact: [label, value, optional small note]. Two to four facts. */
export function band(facts: [string, string, string?][]) {
  return `<dl class="band" style="--n:${facts.length}">${facts
    .map(([l, v, n]) => `<div><dt>${l}</dt><dd>${v}${n ? `<small>${n}</small>` : ""}</dd></div>`)
    .join("")}</dl>`;
}

/** Search box: results narrow as you type (mock.js hides cards and rows that don't match). Never a Search button. */
export const search = (placeholder: string) =>
  `<div class="search"><input type="search" data-search aria-label="${placeholder}" placeholder="${placeholder}"></div>`;

export type MenuItem = { label: string; href?: string; sub?: string; danger?: boolean; line?: boolean; say?: string };
/** Three-dot menu body. Danger rows go last, under a line. */
export function menu(items: MenuItem[]) {
  return `<div class="menu" role="menu">${items
    .map((i) => {
      if (i.line) return "<hr>";
      const inner = `${i.label}${i.sub ? `<small>${i.sub}</small>` : ""}`;
      const cls = i.danger ? ' class="dng"' : "";
      return i.href
        ? `<a role="menuitem"${cls} href="${i.href}">${inner}</a>`
        : `<button type="button" role="menuitem"${cls} data-say="${q(i.say ?? "Mockup: this button doesn't do anything yet.")}">${inner}</button>`;
    })
    .join("")}</div>`;
}

/** Person card: name, one mark, three dots, one or two lines of facts. `open` names a panel from layout()'s panels.
 *  `tickable` lets it be ticked in picking mode. The name link opens the full record; the rest of the card the panel.
 *  WHY a button stretched under the card, not data-open on the <article>: an article can't take focus, so the
 *  panel was mouse-only. The button covers the card (one big tap area, same look) and Tab + Enter or Space opens it;
 *  the name link and three dots sit above it (mock.css .opencard). */
export function card(o: { name: string; href?: string; marks?: string; facts?: string[]; menu?: MenuItem[]; open?: string; tickable?: boolean; extra?: string; cls?: string; attrs?: string }) {
  return `<article class="card${o.cls ? ` ${o.cls}` : ""}"${o.attrs ?? ""}${o.tickable ? " data-tickable" : ""}>
  ${o.open ? `<button type="button" class="opencard" data-open="${o.open}" aria-label="Show ${q(o.name)} in the side panel"></button>` : ""}<div class="top">${o.tickable ? '<span class="tick" aria-hidden="true">✓</span>' : ""}${o.href ? `<a class="name" href="${o.href}">${o.name}</a>` : `<span class="name">${o.name}</span>`}<span class="sp"></span>${o.marks ? `<span class="marks">${o.marks}</span>` : ""}${o.menu ? `<button type="button" class="dots" aria-label="More for ${o.name}" aria-expanded="false" aria-haspopup="menu">⋮</button>${menu(o.menu)}` : ""}</div>
  ${(o.facts ?? []).map((f) => `<div class="facts">${f}</div>`).join("")}${o.extra ?? ""}</article>`;
}
/** Value inside a facts line. */
export const v = (s: string | number) => `<b>${s}</b>`;

/** Group box: a heading bar in the primary color over the cards that belong to it. */
export const box = (title: string, sub: string, inner: string, right = "") =>
  `<section class="box"><header class="boxh"><b>${title}</b><span>${sub}</span>${right ? `<span class="sp"></span>${right}` : ""}</header><div class="boxb">${inner}</div></section>`;
/** Plain section: white, hairline edge. */
export const quiet = (title: string, inner: string) => `<section class="quiet"><h2>${title}</h2>${inner}</section>`;
export const sec = (t: string) => `<div class="sec">${t}</div>`;

/** Whole-row link for simple lists. With `open` the row is a real button (keyboard reaches it) that fills the panel;
 *  keep `right` to words and badges then, since a button can't hold another link or button. */
export const rowl = (o: { title: string; sub?: string; right?: string; href?: string; open?: string }) => {
  const inner = `<span class="m"><b>${o.title}</b>${o.sub ? `<small>${o.sub}</small>` : ""}</span>${o.right ?? ""}`;
  if (o.href) return `<a class="rowl" href="${o.href}">${inner}</a>`;
  return o.open ? `<button type="button" class="rowl" data-open="${o.open}">${inner}</button>` : `<div class="rowl card-lite">${inner}</div>`;
};

/** History timeline, newest first. Dot tone repeats the words: ok money in or done, in emails, wn changes, bd refunds. */
export const tl = (items: [title: string, sub: string, tone?: "ok" | "in" | "bd" | "wn"][]) =>
  `<ol class="tl">${items.map(([t, s, c]) => `<li${c ? ` class="${c}"` : ""}><b>${t}</b><small>${s}</small></li>`).join("")}</ol>`;
/** Small heading inside the side panel. */
export const ph = (t: string) => `<div class="ph">${t}</div>`;
/** Label and value line inside the side panel. */
export const opt = (l: string, val: string) => `<div class="opt"><span class="l">${l}</span><span class="v">${val}</span></div>`;
/** Filter chips with ×, above a list. */
export const chips = (items: string[]) => `<div class="chips">${items.map((c) => `<button type="button" class="chipx" data-say="Mockup: this would take the filter off.">${c} ×</button>`).join("")}</div>`;

/** Stack of full-width panel actions. */
export const actions = (items: string[]) => `<div class="btns">${items.join("")}</div>`;
export const pbtn = (label: string, href?: string) => btn("o", label, href, "w");
export const pprim = (label: string, href?: string) => btn("p", label, href, "w");
export const pdanger = (label: string, href?: string) => btn("d", label, href, "w");

// Form bits
type F = { label: string; req?: boolean; hint?: string; help?: string; full?: boolean; value?: string; placeholder?: string };
const fl = (o: F) => `<span>${o.label}${o.req ? ' <i aria-hidden="true">*</i>' : ""}${o.hint ? ` <em>${o.hint}</em>` : ""}</span>`;
const wrap = (o: F, inner: string) => `<label class="f${o.full ? " full" : ""}">${fl(o)}${inner}${o.help ? `<small>${o.help}</small>` : ""}</label>`;
export const input = (o: F & { type?: string }) =>
  wrap(o, `<input type="${o.type ?? "text"}" value="${o.value ?? ""}" placeholder="${o.placeholder ?? ""}">`);
export const select = (o: F & { options: string[]; selected?: string }) =>
  wrap(o, `<select>${o.options.map((x) => `<option${x === o.selected ? " selected" : ""}>${x}</option>`).join("")}</select>`);
export const textarea = (o: F & { rows?: number }) => wrap({ ...o, value: undefined }, `<textarea rows="${o.rows ?? 3}" placeholder="${o.placeholder ?? ""}">${o.value ?? ""}</textarea>`);
export const readonly = (o: F & { extra?: string }) => wrap(o, `<div class="ro">${o.value}${o.extra ?? ""}</div>`);

/** Checkbox, two looks: "sw" switch for one yes or no, "card" tick card for picking items from a list (put those in list()). */
const tickSvg = `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
type Cx = { on?: boolean; sub?: string; dis?: boolean; cls?: string };
export const cx = (kind: "sw" | "card", label: string, o: Cx = {}) =>
  `<label class="cx cx-${kind} ${o.cls ?? ""}"><input type="checkbox"${o.on ? " checked" : ""}${o.dis ? " disabled" : ""}><span class="bx" aria-hidden="true">${kind === "card" ? tickSvg : ""}</span><span class="cxt">${label}${o.sub ? `<small>${o.sub}</small>` : ""}</span></label>`;
/** A group of tick cards or a slider, with a legend saying what the list is. */
export const list = (legend: string, inner: string) => `<fieldset class="dsfs"><legend>${legend}</legend>${inner}</fieldset>`;
/** Slider: pick exactly one of two to four short choices, and every view switch (List or Calendar). Real radios underneath. */
export const rs = (name: string, opts: string[], on = 0, o: { dis?: boolean; cls?: string } = {}) =>
  `<div class="rs ${o.cls ?? ""}" role="radiogroup" style="--n:${opts.length}">${opts.map((x, i) => `<label><input type="radio" name="${name}"${i === on ? " checked" : ""}${o.dis ? " disabled" : ""}><span>${x}</span></label>`).join("")}<span class="thumb" aria-hidden="true"></span></div>`;
/** Choice buttons: pick several very short items (days of the week), all the same width. */
export const chs = (name: string, opts: string[], on: number[] = [], cls = "", dis = false) =>
  `<div class="days dschoice ${cls}">${opts.map((x, i) => `<label><input type="checkbox" name="${name}"${on.includes(i) ? " checked" : ""}${dis ? " disabled" : ""}><span>${x}</span></label>`).join("")}</div>`;
export const fsec = (title: string, note: string, inner: string) => `<section class="fsec"><h2>${title}</h2>${note ? `<p>${note}</p>` : ""}${inner}</section>`;
export const grid = (...fields: string[]) => `<div class="fgrid">${fields.join("")}</div>`;
export const grid2 = (...fields: string[]) => `<div class="fgrid keep2">${fields.join("")}</div>`;
export const savebar = (left: string, buttons: string) => `<div class="savebar">${left ? `<b>${left}</b>` : ""}<span class="sp"></span>${buttons}</div>`;
export const save = (label: string, msg = "Mockup: nothing is saved.") => `<button type="button" class="btn p" data-say="${q(msg)}">${label}</button>`;
/** Save bar for a create or edit form: Cancel (goes back, saves nothing) beside the main button. Always both. */
export const formbar = (left: string, saveLabel: string, cancelHref: string, msg?: string) =>
  savebar(left, `<a class="btn g" href="${cancelHref}">Cancel</a>${save(saveLabel, msg)}`);

/**
 * Picking bar, shown only in picking mode. `count` is shown after "N selected"; "sum" adds up the ticked cards'
 * data-amt. Put pickAct() buttons in `inner`. The leave button reads Cancel until an action works, then Done.
 */
export const bulk = (count: string, inner: string) =>
  `<div class="savebar bulk"><b data-bulkcount="${count}" aria-live="polite">0 selected</b>${inner}<button type="button" class="btn g" data-pick-stop>Cancel</button><p class="pickerr" role="alert" hidden></p></div>`;
/**
 * An action in the picking bar. `done` is what the hidden status line says ({n} becomes the count); `mark` is HTML
 * added to each ticked card's facts so the change itself shows; `fail` makes it fail with that message instead.
 */
export const pickAct = (label: string, o: { done: string; mark?: string; fail?: string; kind?: "p" | "g" }) =>
  `<button type="button" class="btn ${o.kind ?? "p"}" data-needsel data-pick-act data-done="${q(o.done)}"${o.mark ? ` data-mark="${q(o.mark)}"` : ""}${o.fail ? ` data-fail="${q(o.fail)}"` : ""}>${label}</button>`;

/**
 * The main page shape: main column + 340px side panel (a bottom card on a phone, opened by the pale button).
 * `admin` is the panel with nothing open; `panels` are what each card's `open` fills it with.
 */
export function layout(o: { top?: string; main: string; adminLabel: string; admin: string; panels?: Record<string, string> }) {
  const templates = Object.entries(o.panels ?? {}).map(([k, h]) => `<template id="p-${k}">${h}</template>`).join("");
  return `${o.top ?? ""}<button type="button" class="adminbtn" data-admin-open>${o.adminLabel}</button>
  <div class="layout"><div class="mainc">${o.main}</div>
  <aside class="panel" id="panel" aria-label="${o.adminLabel}"><span class="grab"></span><button type="button" class="pclose" aria-label="Close">×</button><div id="panelbody"><h2>${o.adminLabel}</h2>${o.admin}</div></aside></div>
  <div class="scrim"></div>${templates}`;
}

// Design system page helpers: the same entry layout on every page.
export type Status = "built" | "changing" | "new";
export const STATUS: Record<Status, string> = { built: "Live as is", changing: "Live, changing in the redesign", new: "Not built yet" };
/** Swatch: a brand token with its plain name and what it's for. */
export const sw = (name: string, t: Token | "white", use: string) => {
  const h = t === "white" ? "#FFFFFF" : hex(t);
  return `<li><span class="sw" style="--c:${h}"></span><span><b>${name}</b> ${h}<small>${use}</small></span></li>`;
};
/** One working example with a caption. States are drawn as stills side by side so they show on a phone. */
export const demo = (label: string, html: string) => `<figure class="dsd"><div>${html}</div><figcaption>${label}</figcaption></figure>`;
export const dodont = (good: [string, string], bad: [string, string]) => `<div class="dsdo">
  <div class="yes"><b>Do</b><div class="dsx">${good[0]}</div><p>${good[1]}</p></div>
  <div class="no"><b>Don't</b><div class="dsx">${bad[0]}</div><p>${bad[1]}</p></div></div>`;
export const toastDemo = (t: string) => `<div class="dstoast" role="status">${t}</div>`;
export const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
/** A titled section with a status tag, used by Brand, Foundations and Patterns. */
export const dsSec = (o: { id: string; name: string; status?: Status; note?: string; purpose?: string; body: string }) => `<section class="ds" id="${o.id}">
  <div class="dsh"><h2>${o.name}</h2>${o.status ? `<span class="st ${o.status}">${STATUS[o.status]}</span>` : ""}</div>
  ${o.note ? `<p class="dsnote">${o.note}</p>` : ""}${o.purpose ? `<p class="dsp">${o.purpose}</p>` : ""}${o.body}</section>`;
/** "On this page" pills. */
export const toc = (items: [string, string][]) => `<nav class="dstoc" aria-label="On this page">${items.map(([h, n]) => `<a href="${h}">${n}</a>`).join("")}</nav>`;

/** One design-system component entry, in the skill's template order (Components pages 03, 03b, 03c). */
export function entry(o: {
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
