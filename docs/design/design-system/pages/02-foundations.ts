// Design system: Foundations. Colors (the build's contrast gate), type, spacing and layout, corners, shadows,
// layering, motion, the rules for every piece and the older-phone guardrails. Every pair the code really uses for
// words (4.5 to 1) or for edges and icons (3 to 1) goes through used(), and build.ts stops when contrastFailures
// isn't empty. Known fails are shown through ratio() only (the "show" path), so they're on the page without
// stopping the build. Sizes are the compiled values from src/app/globals.css @theme (its spacing 5, 6, 8 and 10
// are 24, 32, 48 and 64 pixels), checked with @tailwindcss/node, not stock Tailwind's numbers.
import { brand } from "../brand";
import { contrast, cx, dodont, dsSec, fwdlink, hex, ratio, toc, ul, type Page, type Token } from "../lib";

const h3 = (t: string) => `<h3>${t}</h3>`;
const PAPER = hex("color-bone-50");
const WHITE = "#FFFFFF";
export const contrastFailures: string[] = [];
const used = (label: string, fg: string, bg: string, need = 4.5) => {
  const r = contrast(fg, bg);
  if (r < need) contrastFailures.push(`${label}: ${fg} on ${bg} is ${r.toFixed(1)} to 1, needs ${need} to 1`);
  return ratio(fg, bg, need);
};
// "text" 4.5 to 1, "edge" 3 to 1 (both checked by the build), "show" the ratio is shown but the code never uses
// the pair (a ✗ there is expected), "deco" decoration only, "-" not used there (a fill, or the background itself)
type Need = "text" | "edge" | "show" | "deco" | "-";
const cr = (label: string, fg: string, bg: string, need: Need) =>
  need === "-" ? "—" : need === "deco" ? `${ratio(fg, bg).split(" ").slice(0, 3).join(" ")}, decoration only` : need === "show" ? ratio(fg, bg) : used(label, fg, bg, need === "text" ? 4.5 : 3);
type Sw = [name: string, t: Token, job: string, onPaper: Need, onWhite: Need];
// tok: the CSS name shown under the swatch, when it differs from the brand.ts key (the event tokens share a hex)
const swatchHex = (name: string, h: string, tok: string, job: string, p: Need, w: Need) =>
  `<div class="fsw"><span class="fchip" style="--c:${h}"></span><div><b>${name}</b> <code>${h}</code><small>${job}</small><small class="fcr">On the paper <i>${cr(`${name} on the paper`, h, PAPER, p)}</i> · On white <i>${cr(`${name} on white`, h, WHITE, w)}</i></small><small class="ftok">--${tok}</small></div></div>`;
const swatch = ([name, t, job, p, w]: Sw) => swatchHex(name, hex(t), t, job, p, w);
const swatches = (l: Sw[]) => `<div class="fsws">${l.map(swatch).join("")}</div>`;
/** A real foreground-on-background pair from the code, checked by the build. */
const pairHex = (label: string, fg: string, bg: string, need: 4.5 | 3, where: string) =>
  `<li><span class="fpair" style="background:${bg};color:${fg}">Aa</span><span><b>${label}</b> ${used(label, fg, bg, need)}<small>${where}</small></span></li>`;
const pair = (label: string, fg: Token, bg: Token, need: 4.5 | 3, where: string) => pairHex(label, hex(fg), hex(bg), need, where);
/** A pair that fails or is never used for words: shown with its ✗, never checked by the build. */
const fail = (label: string, fg: string, bg: string, need: 4.5 | 3, where: string) =>
  `<li><span class="fpair" style="background:${bg};color:${fg}">Aa</span><span><b>${label}</b> ${ratio(fg, bg, need)}<small>${where}</small></span></li>`;
const CATS = ["pantry", "grocery", "convenience", "farm", "garden", "landscape", "meal", "blessing"] as const;
const CAT_NAME: Record<(typeof CATS)[number], string> = { pantry: "Food Pantry", grocery: "Grocery", convenience: "Convenience Store", farm: "Farm", garden: "Community Garden", landscape: "Edible Landscape", meal: "Meal Site", blessing: "Blessing Box" };

const colors = dsSec({
  id: "colors", name: "Colors", status: "changing",
  note: "What changes (decided, Kyle): the hover fill becomes sage 100, never a grey; the category becomes colored words under the name instead of a filled pill, so the category colors now carry words and are checked for it. Every color is copied from src/app/globals.css, the source of truth. The ratios are worked out from those values each time this site builds, so they can't go stale.",
  purpose: "Bone is the paper, ink is the words, sage is everything you can press, orange and navy are the Pueblo Food Project brand and stay rare. ✓ means easy to read: words need 4.5 to 1, edges and icons 3 to 1.",
  body: `${h3("Brand")}${swatches([
    ["Navy", "color-brand-navy", "The wordmark, words on orange, the bottom bar's open item", "text", "text"],
    ["Orange", "color-brand-orange", "The one main action on a screen: the splash buttons, Show places in Filters, the Filters count, the admin's Add place. Never words on light colors (a ✗ there is normal).", "show", "show"],
    ["Yellow", "color-brand-yellow", "Support badges only, with ink words on it", "-", "-"],
  ])}
  <p class="dssz"><b>Orange is the one main action.</b> One orange thing per screen, so the eye knows where to go. Use it when a screen has a single job (find food near me, show the places). Don't use it for a second action, a hover or a label: those are sage. Orange buttons get no hover change.</p>
  ${h3("The event pin: orange's one exception")}<div class="fsws">
    ${swatchHex("Event pin", hex("color-brand-orange"), "color-event-pin", "The star pin's fill, the event card's Get directions button, the star in the event strip and lists", "show", "show")}
    ${swatchHex("Event outline", hex("color-brand-navy"), "color-event-outline", "The star pin's edge and star, the event strip's bar, words on the Get directions button", "text", "text")}
  </div>
  <p class="dssz">Same colors as orange and navy, with their own names (Kyle, 2026-10-10), so an event reads as different from every place at arm's length and the exception can be found in the code. Nothing else on an event card is orange.</p>
  ${h3("Bone: the paper")}${swatches([
    ["Bone 50", "color-bone-50", "The paper every page sits on; words on sage, navy and the category pill", "-", "-"],
    ["Bone 100", "color-bone-100", "Resting chips, the loading box, the location help card. Live today it's also the hover fill; that moves to sage 100.", "deco", "-"],
    ["Bone 200", "color-bone-200", "Card borders and dividers", "deco", "deco"],
    ["Bone 300", "color-bone-300", "Search bar, bottom bar and outline button edges at rest, where the words carry the control. Also the text-box edge: see Known fails.", "deco", "deco"],
  ])}
  ${h3("Ink: the words")}${swatches([
    ["Ink 400", "color-ink-400", "Section labels (HOURS), placeholders, small icons", "text", "text"],
    ["Ink 500", "color-ink-500", "Second lines: distance, hours today, the bottom bar's words", "text", "text"],
    ["Ink 700", "color-ink-700", "Everyday words", "text", "text"],
    ["Ink 900", "color-ink-900", "Place names and headings", "text", "text"],
  ])}
  ${h3("Sage: everything you can press")}${swatches([
    ["Sage 50", "color-sage-50", "Plentiful link fill, the good-news tag", "-", "-"],
    ["Sage 100", "color-sage-100", "SNAP and WIC badge fill, and the hover fill on everything you can point at (decided, Kyle)", "-", "-"],
    ["Sage 500", "color-sage-500", "Keyboard focus ring, today's line in the hours, the Plentiful link's edge. Never words: 4.4 to 1 on white.", "edge", "edge"],
    ["Sage 600", "color-sage-600", "The main color: the Walk button, filled buttons, link hovers", "text", "text"],
    ["Sage 700", "color-sage-700", "Link and phone words, SNAP and WIC words", "text", "text"],
  ])}
  <p class="dssz"><b>The hover fill is sage 100.</b> Use it under the pointer on anything you can press that isn't a filled button: bottom bar items, menu rows, list rows, chips. Words on it stay ink 500 or darker (ink 400 is ${ratio(hex("color-ink-400"), hex("color-sage-100"))} on it). Category words and Boxes while it's on never sit on it: raspberry is ${ratio(hex("color-cat-blessing"), hex("color-sage-100"))} there, so a Boxes-on item gets no hover fill (Kyle). Never a grey and never a brightening (see Motion).</p>
  ${h3("Clay and alerts")}${swatches([
    ["Clay 100", "color-clay-100", "Pale fill for reports and warnings", "-", "-"],
    ["Clay 500", "color-clay-500", "The filled save star, the × on the outside-the-county message, the Donate heart", "edge", "edge"],
    ["Clay 700", "color-clay-700", "Words on the clay fill", "text", "text"],
    ["Success", "color-success", "Thank-you lines after a check-in, Stocked", "text", "text"],
    ["Warning", "color-warning", "Low (a box running low)", "-", "text"],
    ["Danger", "color-danger", "Error words, Empty, the remove buttons. The only error red.", "text", "text"],
  ])}
  ${h3("Category colors: map pins and the category words")}
  <div class="fsws">${CATS.map((c) => swatch([CAT_NAME[c], `color-cat-${c}`, c === "blessing" ? "Pin fill, the category words, and the Boxes item in the bottom bar while it's on" : c === "garden" ? "Pin fill and the category words (the same green as sage 600)" : "Pin fill and the category words", "text", "text"])).join("")}</div>
  <p class="dssz">A data palette: one color per kind of place, so a pantry pin and a garden pin differ at arm's length. Use them only for that kind of place (its pin, its words on a card). Never for a button, a link or a state: grocery blue is the only blue on the site and means grocery, nothing else. On a card the category is colored words on their own line under the name, 14 pixels semibold, with middle dots between the pieces: <span class="fi-cat" style="color:${hex("color-cat-pantry")}">Food Pantry · SNAP · WIC</span> (decided, Kyle). Every one passes on the paper and on white; raspberry is the closest at ${ratio(hex("color-cat-blessing"), PAPER)}.</p>
  ${h3("Words on a fill, as the code uses them")}
  <ul class="fpairs">
    ${pair("Navy on orange", "color-brand-navy", "color-brand-orange", 4.5, "The splash buttons, Show places, the event card's Get directions")}
    ${pair("Bone 50 on sage 600", "color-bone-50", "color-sage-600", 4.5, "The Walk button, filled buttons, Filters")}
    ${pair("Bone 50 on sage 700", "color-bone-50", "color-sage-700", 4.5, "A filled button with the pointer over it")}
    ${pair("Sage 700 on sage 100", "color-sage-700", "color-sage-100", 4.5, "SNAP and WIC badges")}
    ${pair("Sage 700 on sage 50", "color-sage-700", "color-sage-50", 4.5, "The Plentiful link, the good-news tag")}
    ${pair("Clay 700 on clay 100", "color-clay-700", "color-clay-100", 4.5, "Public report tag, problem tag")}
    ${pair("Ink 700 on yellow", "color-ink-700", "color-brand-yellow", 4.5, "Support badges")}
    ${pair("Ink 500 on sage 100", "color-ink-500", "color-sage-100", 4.5, "A bottom bar item with the pointer over it (decided)")}
    ${pair("Ink 700 on sage 100", "color-ink-700", "color-sage-100", 4.5, "A menu or list row with the pointer over it (decided)")}
    ${pair("Navy on sage 100", "color-brand-navy", "color-sage-100", 4.5, "The open bottom bar item with the pointer over it (decided)")}
    ${pair("Ink 500 on bone 100", "color-ink-500", "color-bone-100", 4.5, "A bottom bar item with the pointer over it, live today")}
    ${pair("Bone 50 on navy", "color-bone-50", "color-brand-navy", 4.5, "The event strip, the preview tag, the NOW label")}
    ${pairHex("White on navy", WHITE, hex("color-brand-navy"), 4.5, "The event's name in the happening-today strip")}
    ${pair("Orange on navy", "color-brand-orange", "color-brand-navy", 4.5, "The strip's status line and star (Happening now)")}
    ${pair("Sage 500 ring on sage 100", "color-sage-500", "color-sage-100", 3, "Keyboard ring on an item that also has the pointer over it")}
  </ul>
  <p class="dssz">The category pill, live today, puts bone 50 words on each category color. It becomes colored words (above), but every pair passes either way:</p>
  <ul class="fpairs">${CATS.map((c) => pair(`Bone 50 on ${CAT_NAME[c].toLowerCase()}`, "color-bone-50", `color-cat-${c}`, 4.5, "The category pill on a place card, live today")).join("")}</ul>
  ${h3("Known fails and pairs never used for words")}
  <p class="dssz">Shown so nobody reaches for them. The build doesn't check these, because the first two are live today and listed as known live issues.</p>
  <ul class="fpairs">
    ${fail("Bone 300 edge on white", hex("color-bone-300"), WHITE, 3, "Known fail: the faint text-box edge on every form (PublicForm.tsx:81, formClasses.ts). An edge needs 3 to 1.")}
    ${fail("Warning on clay 100", hex("color-warning"), hex("color-clay-100"), 4.5, "Known fail: the Low tag in the admin's boxes table (AllBoxesTable.tsx:37)")}
    ${fail("Sage 500 words on white", hex("color-sage-500"), WHITE, 4.5, "Never words: sage 500 is for rings and edges. npm run lint refuses it as a fill behind words.")}
    ${fail("Orange words on the paper", hex("color-brand-orange"), PAPER, 4.5, "Never: orange is a fill with navy words on it")}
    ${fail("Ink 400 on sage 100", hex("color-ink-400"), hex("color-sage-100"), 4.5, "Never: words on the hover fill stay ink 500 or darker")}
    ${(["pantry", "farm", "landscape", "blessing"] as const).map((c) => fail(`${CAT_NAME[c]} on sage 100`, hex(`color-cat-${c}`), hex("color-sage-100"), 4.5, "Never: category words don't sit on the hover fill")).join("")}
    ${fail("Raspberry on bone 100", hex("color-cat-blessing"), hex("color-bone-100"), 4.5, "Never: Boxes while it's on stays on the bone 50 paper")}
  </ul>
  ${h3("Do and don't")}
  ${dodont(
    [`<div class="fi-demo"><button type="button" class="fi-hov">Browse all places</button><button type="button" class="fi-hov is-hover">With the pointer over it</button></div>`, "Point at the rows: sage 100 fades in under ink words."],
    [`<div class="fi-demo"><button type="button" class="fi-hov fi-bad">Browse all places</button><button type="button" class="fi-hov fi-bad is-hover">With the pointer over it</button></div>`, "A grey fill (not one of ours) plus a brightening: the wrong temperature, and the fade stutters."],
  )}`,
});

// ── Type ─────────────────────────────────────────────────────────────────────────────────────────────────────
const D = "var(--display)", S = "var(--body)";
// [px, class, use, sample, font, weight, line height]
const sizes: [number, string, string, string, string, number, string][] = [
  [60, "text-6xl", "The wordmark on the splash, 768 pixels wide and up", "Pueblo", D, 400, "1"],
  [36, "text-4xl", "The wordmark on phones", "Pueblo Food Map", D, 400, "40px"],
  [30, "text-3xl", "Page titles on content pages: About, the help pages, Not found, a box's history", "About this map", D, 400, "36px"],
  [24, "text-2xl", "Page titles on form pages and a place's own page; an event's name on its card; admin page titles", "Share an event", D, 400, "32px"],
  [20, "text-xl", "A place's name on its card (leading tight); a thank-you title (semibold); admin section titles", "Eastside Community Pantry", D, 400, "1.25"],
  [18, "text-lg", "The location help card's title; the box check-in question; admin card titles", "Location is off", D, 400, "1.375"],
  [16, "text-base", "Inside every text box on a phone; empty-page titles (semibold); route steps", "Search for food near you", S, 400, "24px"],
  [14, "text-sm", "The everyday size: card lines, buttons, menu rows, field labels, and the category words (semibold)", "Open today · 9am – 1pm", S, 400, "20px"],
  [12, "text-xs", "The bottom bar's words (bold), field errors, small second lines, the map's hover tip", "Near me", S, 700, "16px"],
  [11, "text-[11px]", "Section labels in capitals (HOURS, CONTACT), tracked wider; the bottom bar's words under 360 pixels wide; small badges on the phone card", "HOURS", S, 600, "16px"],
  [10, "text-[10px]", "The smallest on the site, in three places: small badges on the computer card, the admin chart's week labels, a label on the report page", "WEEK OF NOV 2", S, 600, "14px"],
];
const typeRow = ([px, cls, use, sample, font, w, lh]: (typeof sizes)[number]) =>
  `<div class="fi-type"><div class="fi-tsample" style="font-family:${font};font-size:${px}px;font-weight:${w};line-height:${lh}${px <= 11 ? ";letter-spacing:.05em" : ""}">${sample}</div><small><b>${px} pixels</b> · <code>${cls}</code> · ${font === D ? "Fraunces" : "Public Sans"}<br>${use}</small></div>`;

const type = dsSec({
  id: "type", name: "Type", status: "built",
  note: "There is no type scale in @theme: the sizes are Tailwind's own (xs 12, sm 14, base 16 and up), plus a few written by hand. The list below is what the code uses, measured.",
  purpose: `Two typefaces, both self-hosted, so no page waits on another company's servers. <b>Fraunces</b> is the display serif, for headings only. <b>Public Sans</b> carries everything else. Think of a well-set community bulletin on cream paper: easy to read at a glance, not slick.`,
  body: `<div class="fi-faces">
    <div><span style="font-family:${D};font-size:30px;line-height:1.1;color:var(--color-ink-900)">Fraunces</span><small>Display. The wordmark, place names, page titles, short card and thank-you titles, admin titles (with the wordmark's 0.04em spacing). Normal weight, semibold at most, ink 900 (navy for the wordmark and the location help card). Loads without blocking the page.</small></div>
    <div><span style="font-family:${S};font-size:26px;line-height:1.1;color:var(--color-ink-700)">Public Sans</span><small>Everything else: body, buttons, badges, labels, hours, distances, placeholders. The one font loaded first. Four letter alternates are on everywhere (cv02, cv03, cv04, cv11) for cleaner numbers.</small></div>
  </div>
  ${h3("Sizes, and where each is used")}${sizes.map(typeRow).join("")}
  <p class="dssz">Written by hand outside the list: 13, 14, 15 and 18 pixels on the location help card (LocationHelpCard.tsx:154-193) and 15 pixels on two buttons there. New work picks from the list.</p>
  ${h3("Line heights and weights")}${ul([
    "Each size brings its own line height: 12 on 16, 14 on 20, 16 on 24, 18 on 28, 20 on 28, 24 on 32, 30 on 36.",
    "Paragraphs on content pages and cards open up to 1.625 (<code>leading-relaxed</code>, the most used). Names and titles close to 1.25 (<code>leading-tight</code>). Words inside buttons sit at 1 (<code>leading-none</code>). The bottom bar's words have a fixed 14-pixel line.",
    "Weights: 400 for reading, 500 for labels, 600 for the category words, empty-page titles and section labels, 700 for the bottom bar's words. Fraunces stays at 400.",
  ])}
  ${h3("On a 360-pixel phone")}${ul([
    "Text boxes are 16 pixels on a phone and drop to 14 from 768 pixels wide. Below 16 an iPhone zooms the whole page in when the box is tapped.",
    "The bottom bar's words drop from 12 to 11 pixels below 360 wide, so five items fit at 320.",
    "The wordmark is 36 pixels on phones and 60 from 768 wide.",
    "The longer Spanish splash button (Encuentra comida cerca de mí) gets less side padding below 640 wide and splits its two lines evenly, so one word is never left alone.",
    "Spanish runs longer than English: every label must wrap or shorten cleanly at 320 wide, never be cut off. Words never break in the middle.",
  ])}
  ${h3("Why, when, don't")}${ul([
    "<b>Why:</b> body words are ink 700 on bone 50, 13.7 to 1, past the strictest reading level (7 to 1). Small sizes stay legible because Public Sans is built for screens.",
    "<b>When:</b> Fraunces only for a heading a person scans for. Public Sans for anything a person reads, taps or types.",
    "<b>Don't:</b> Fraunces on a button, a badge, a label or running text at 16 pixels or smaller. Don't go lighter than ink 700 for reading, or smaller than the list above.",
  ])}
  ${dodont(
    [`<div class="fi-demo fi-card"><span style="font-family:${D};font-size:20px;line-height:1.25;color:var(--color-ink-900)">Eastside Community Pantry</span><span class="fi-cat" style="color:${hex("color-cat-pantry")}">Food Pantry · SNAP · WIC</span><span style="font-size:14px;color:var(--color-ink-500)">0.4 mi · Open today · 9am – 1pm</span></div>`, "Fraunces for the name, Public Sans for every line under it."],
    [`<div class="fi-demo fi-card"><span style="font-family:${D};font-size:14px;color:var(--color-ink-700)">Open today · 9am – 1pm. Bring a bag and an ID if you have one.</span><span class="fi-bbtn" style="font-family:${D}">Get directions</span></div>`, "Fraunces for small running text and a button: it's a headline face and gets hard to read small."],
  )}`,
});

// ── Spacing and layout ───────────────────────────────────────────────────────────────────────────────────────
const scale: [string, number, number, string][] = [
  ["1", 4, 4, "Inside small things: an icon to its words"],
  ["2", 8, 8, "Between items in a row; the gap above the bottom bar's words"],
  ["3", 12, 12, "Inside rows; the bottom bar's distance from the screen edges"],
  ["4", 16, 16, "The page gutters on a phone; inside cards"],
  ["5", 24, 20, "Inside the place card (px-5 pt-5); between form fields (space-y-5)"],
  ["6", 32, 24, "Page padding on wider screens"],
  ["8", 48, 32, "The 48-pixel tap floor in one class"],
  ["10", 64, 40, "Big gaps, and the thank-you page's button height"],
];
const spacing = dsSec({
  id: "spacing", name: "Spacing and layout", status: "built",
  note: "From @theme in src/app/globals.css: --spacing-1 to --spacing-10. Every other number is Tailwind's 4-pixel step.",
  purpose: "A 4-pixel grid: 4, 8, 12, 16, 24, 32, 48, 64. Most gaps and padding land on 16 or 24. The same few distances everywhere, so pages line up without anyone measuring.",
  body: `${h3("The scale")}<div class="fi-steps">${scale.map(([n, px, stock, use]) => `<div><code>${n}</code><b>${px} px</b><span class="fi-bar" style="width:${px}px"></span><small>${use}${px !== stock ? ` <em>Not ${stock}: see the trap below.</em>` : ""}</small></div>`).join("")}</div>
  ${h3("The trap for anyone building here")}
  <div class="fi-trap"><b>Four numbers don't mean what stock Tailwind says.</b> This site redefines spacing 5, 6, 8 and 10 as 24, 32, 48 and 64 pixels (stock Tailwind: 20, 24, 32 and 40). That reaches every class built on them: <code>p-5</code>, <code>gap-6</code>, <code>h-8</code>, <code>size-10</code>, <code>space-y-5</code>. Every other number is 4 times itself as usual, so <code>h-11</code> is 44, <code>h-12</code> and <code>min-h-12</code> are 48, and <code>h-8</code> is also 48.</div>
  <div class="fi-rows">
    <div><code>size-6</code><span>Stock 24 · here <b>32</b></span><small>The bottom bar's icons on phones (bottomNavShared.tsx:86). Its own comment says 24 (line 55).</small></div>
    <div><code>h-5 w-5</code><span>Stock 20 · here <b>24</b></span><small>The route step icons and the step arrows (DirectionButtons.tsx:227, 357)</small></div>
    <div><code>w-8 h-8</code><span>Stock 32 · here <b>48</b></span><small>The round heart behind Donate in the menu (HamburgerMenuContent.tsx:238)</small></div>
    <div><code>h-10</code><span>Stock 40 · here <b>64</b></span><small>The Back to map button on a form's thank-you (PublicForm.tsx:233)</small></div>
    <div><code>px-5 pt-5</code><span>Stock 20 · here <b>24</b></span><small>The place card's padding (VenueCardBody.tsx)</small></div>
  </div>
  <p class="dssz">When you mean 20 or 40 pixels, write it out (<code>p-[20px]</code>) or use a number that isn't remapped. Check the size in the browser, not in the Tailwind docs. Icons take a <code>size={n}</code> number, never a size class (see Icons).</p>
  ${h3("Page layout")}${ul([
    "The map fills the whole screen; nothing else is always there except the search bar and the bottom bar (under 10% of a computer screen).",
    "Content pages (About, the help pages, forms, a place's page) are one centred column, 512 pixels at most, with 16-pixel gutters. Admin editing forms widen to 672.",
    "The search bar is the full width less 16 pixels a side on a phone, 520 pixels centred from 768 wide. 48 pixels tall on a phone, 52 from 768.",
    "The computer side panel that holds a place's card is 380 pixels wide.",
  ])}
  ${h3("Breakpoints")}<div class="fi-rows">
    <div><code>under 360</code><span>Bottom bar words</span><small>Drop from 12 to 11 pixels so five items fit at 320</small></div>
    <div><code>640 (sm)</code><span>Small steps</span><small>A little more padding and type on content pages and admin</small></div>
    <div><code>768 (md)</code><span>Phone to computer</span><small>The bottom card becomes the side panel, the full-screen menu a 280-pixel dropdown, the search bar 520 centred, text boxes 16 to 14 pixels</small></div>
    <div><code>1024 (lg)</code><span>Admin columns</span><small>The admin dashboard, boxes and proposals go to columns</small></div>
    <div><code>1536 (2xl)</code><span>Bottom bar to a centred pill</span><small>The Mapbox credits stop lifting above the bar</small></div>
  </div>`,
});

// ── Corners ──────────────────────────────────────────────────────────────────────────────────────────────────
const R = brand.radius;
const corners = dsSec({
  id: "corners", name: "Corners", status: "built",
  note: "--radius-sm, md, lg, xl and full in @theme. The code writes them as rounded-[var(--radius-md)] or rounded-md; both give the token.",
  purpose: "Rounder as things get bigger. Fields and buttons are gently rounded, cards more, the sheet that slides up the most; the bars and pills are fully round.",
  body: `<div class="fcorners">${([[R.sm, "Small (sm)", "The map's hover tip, the SNAP and WIC badges, the event pin's NOW label"], [R.md, "Medium (md), the most used", "Text boxes, buttons, the Plentiful link, the filter panel, error boxes"], [R.lg, "Large (lg)", "Cards, popovers, the Donate card, the location help card, the Not found card, the computer card"], [R.xl, "Extra large (xl)", "The top corners of the phone's bottom card and the share preview sheet"], [999, "Fully round (full)", "The search bar, the bottom bar, pills, the category pill live today, round icon buttons"]] as [number, string, string][])
    .map(([r, n, use]) => `<div><span class="fcorner" style="border-radius:${r}px"></span><b>${n} · ${r === 999 ? "fully round" : `${r} px`}</b><small>${use}</small></div>`).join("")}</div>
  ${ul([
    "<b>Off the scale:</b> plain <code>rounded</code> is 4 pixels, not one of ours. It's on 46 small things: tick boxes, small count tags, thumbnails, focus outlines on text links. Two more write a token by hand: <code>rounded-[14px]</code> and the share sheet's <code>rounded-t-[20px]</code> (ShareEventForm.tsx:552).",
    "<b>Don't:</b> a new corner size. Pick the nearest of the five.",
  ])}`,
});

// ── Shadows ──────────────────────────────────────────────────────────────────────────────────────────────────
const E1 = "0 1px 2px rgba(26,24,23,0.04), 0 0 0 1px rgba(26,24,23,0.05)";
const E2 = "0 4px 12px rgba(26,24,23,0.06), 0 0 0 1px rgba(26,24,23,0.06)";
// The pin's shadow as PinShadow.tsx draws it: five ever-wider faint copies of the shape, 2 px down.
const PIN = "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0";
const pinShadow = (px: number) => `<g transform="translate(0 ${2 / px})" fill="#000" stroke="#000" stroke-linejoin="round">${[[8, 0.01], [6, 0.015], [4, 0.025], [2, 0.03], [1, 0.04]].map(([g, o]) => `<g opacity="${o}" stroke-width="${1.5 + g / px}"><path d="${PIN}"/></g>`).join("")}</g>`;
const pinSvg = (size: number, color: string, shadow = true) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="overflow:visible">${shadow ? pinShadow(size / 24) : ""}<path d="${PIN}" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
const shadows = dsSec({
  id: "shadows", name: "Shadows and lift", status: "built",
  note: "elevation-1 and elevation-2 are utilities in src/app/globals.css. The pin shadow is drawn in the SVG (PinShadow.tsx), never a CSS filter.",
  purpose: "A shadow means something floats over the map. Two levels, both tinted with ink 900, never plain black. Anything sitting flat on the paper gets a bone 200 line instead.",
  body: `<div class="fshadows">
    <div><span class="fshadow" style="box-shadow:${E1}"></span><b>Level 1</b><small>A hairline ring and a breath of shadow. The search bar, the admin's cards and tables.</small></div>
    <div><span class="fshadow" style="box-shadow:${E2}"></span><b>Level 2</b><small>Lifted: the phone's bottom card, the search popovers, the happening-today strip, the location help card, the route strip.</small></div>
    <div><span class="fshadow" style="box-shadow:0 4px 16px rgba(26,24,23,0.14),0 0 0 1px rgba(26,24,23,0.04)"></span><b>The bottom bar's own</b><small>0 4 16 ink at 14%: deeper, because it floats over the busiest part of the map (bottomNavShared.tsx:112).</small></div>
    <div><span class="fi-pinbox">${pinSvg(28, hex("color-cat-pantry"))}${pinSvg(28, hex("color-cat-grocery"))}${pinSvg(36, hex("color-cat-garden"))}</span><b>The map pin's shadow</b><small>Drawn inside the pin's SVG: five faint, ever-wider copies of its outline, 2 pixels down. A CSS filter was redrawn every frame for about 130 pins while the map moved (#722).</small></div>
  </div>
  ${ul([
    "<b>Backdrops</b> behind the menu and Filters are ink at 40% (the share preview sheet uses 45%, ShareEventForm.tsx:548); the guided tour dims to 55%. Never black.",
    "<b>Known drift:</b> four panels still use black-based shadows written by hand: the side panel 0 8 32 at 18% (DesktopSidePanel.tsx:175), the menu at 22% and 18% (HamburgerMenu.tsx:290, 315) and Filters at 22% (FilterPanel.tsx:304). Listed, not changed.",
    "<b>Don't:</b> a third level, a shadow on a card that sits on the paper, or a CSS drop-shadow filter on anything drawn on the map.",
  ])}`,
});

// ── Layering ─────────────────────────────────────────────────────────────────────────────────────────────────
const ladder: [string, string, string][] = [
  ["2", "Mapbox's own credits corners", "mapbox-gl.css, on the map"],
  ["2 / 3 / 4", "Event star pins: coming up, going on now, picked. Place pins sit under every event pin.", "EventMarker.tsx:62"],
  ["700", "The list view; the happening-today strip. Never on screen together.", "ListView.tsx, EventStrip.tsx, MapWrapper.tsx"],
  ["800", "The phone's bottom card", "BottomSheet.tsx, DirectionButtons.tsx"],
  ["900", "The computer side panel; the walking-route strip", "DesktopSidePanel.tsx, RouteStrip.tsx"],
  ["999", "Search popovers: results, no matches, the map or list suggestion", "SearchResultsPopover.tsx, EmptySearchPopover.tsx, ViewSuggestion.tsx"],
  ["1000", "The search bar; the bottom bar at 1536 wide and up", "SearchBar.tsx, bottomNavShared.tsx"],
  ["1001", "The menu's backdrop; the outside-the-county message; the no-events notice", "HamburgerMenu.tsx, MapWrapper.tsx, EventsEmptyNotice.tsx:42"],
  ["1002", "The menu panel", "HamburgerMenu.tsx"],
  ["1003", "The bottom bar below 1536 wide, above the menu so its own button can close it", "bottomNavShared.tsx"],
  ["1004 / 1005", "Filters backdrop and panel", "FilterPanel.tsx"],
  ["1100 / 1101", "The location help card; the share preview sheet's backdrop and sheet", "LocationHelpCard.tsx, ShareEventForm.tsx:548, 552"],
  ["9000", "The splash screen", "SplashScreen.tsx, HomePageClient.tsx"],
  ["9500", "The guided tour, over everything once the splash is gone", "GuidedTour.tsx:408"],
  ["top layer", "The photo viewer: a real dialog, above every number by design", "PhotoViewer.tsx"],
];
const layering = dsSec({
  id: "layering", name: "Layering", status: "built",
  note: "Checked against every z-index in src/ (2026-11-08). Three rungs are new since DESIGN.md's table: the no-events notice at 1001, the share preview sheet at 1100 and 1101, the guided tour at 9500.",
  purpose: "One ladder for everything that floats over the map, lowest first. A new floating thing joins a rung that's already here; it never gets a number of its own.",
  body: `<div class="fi-z">${ladder.map(([z, what, where]) => `<div><span>${z}</span><p>${what}<small>${where}</small></p></div>`).join("")}</div>
  ${ul([
    "Small numbers (z-10) inside one card or page only stack things inside it, and aren't on the ladder.",
    "Not checked: the home page's skip links take z-50 when focused (HomeShell.tsx:84), under the search bar's 1000. Whether the bar ever covers them hasn't been looked at in a browser.",
  ])}`,
});

// ── Motion ───────────────────────────────────────────────────────────────────────────────────────────────────
const mdemo = (time: string, label: string, html: string) => `<figure class="dsd"><div>${html}</div><figcaption><b>${time}</b> · ${label}</figcaption></figure>`;
const motion = dsSec({
  id: "motion", name: "Motion", status: "changing",
  note: "What changes (decided, Kyle): the hover brightening goes (PRESS_FEEDBACK, src/lib/interactionStyles.ts:17, hover:brightness-105). It made fades stutter; the hover becomes a sage 100 fill instead. Orange buttons get no hover change at all.",
  purpose: "Movement only to show what changed: a color fades, a card slides up, the map flies to a place, a live event pulses. Nothing bounces or moves for decoration. <b>Point at or tap each one below.</b>",
  body: `<div class="fmoff-bar">${cx("sw", "Show it the way people who turn off motion see it", { cls: "fmoff-sw" }).replace("<input", '<input onchange="this.closest(\'.ds\').classList.toggle(\'fmoff\', this.checked)"')}</div>
  <div class="dsrow fi-demo">
    ${mdemo("0.15 s", "Color change on a button: point at it", `<button type="button" class="fi-fill">Get directions</button>`)}
    ${mdemo("0.15 s", "The hover fill fading in: point at it", `<button type="button" class="fi-hov">Browse all places</button>`)}
    ${mdemo("0.25 s", "A switch turning on: the knob slides and the fill changes together. Tap it", cx("sw", "Open now", { cls: "fi-sw" }))}
    ${mdemo("0.5 s", "The bottom card sliding up: tap Open", `<div class="fmphone fi-sheet"><div class="fmlist"><button type="button" class="fi-fill" onclick="this.closest('.fmphone').classList.add('open')">Open a place</button></div><div class="fmscrim" onclick="this.closest('.fmphone').classList.remove('open')"></div><div class="fmsheet"><span class="grab"></span><b>Eastside Community Pantry</b><small>Food Pantry · 0.4 mi</small><button type="button" class="fi-hov" onclick="this.closest('.fmphone').classList.remove('open')">Close</button></div></div>`)}
    ${mdemo("2 s, repeating", "You are here: the dot breathes", `<span class="fi-dot" aria-hidden="true"></span>`)}
    ${mdemo("2.4 s, repeating", "An event going on now: two rings spread from the pin. With motion off, a still halo.", `<span class="fi-evt" aria-hidden="true"><span class="fi-ring"></span><span class="fi-ring late"></span><svg width="44" height="44" viewBox="2 1 20 21.5" style="overflow:visible;position:relative"><path d="${PIN}" fill="${hex("color-brand-orange")}" stroke="${hex("color-brand-navy")}" stroke-width="1.6" stroke-linejoin="round"/><polygon points="12,5.6 13.12,8.46 16.19,8.64 13.81,10.59 14.59,13.56 12,11.9 9.41,13.56 10.19,10.59 7.82,8.64 10.88,8.46" fill="${hex("color-brand-navy")}"/></svg></span>`)}
    ${mdemo("0.1 s", "A pin growing a little under the pointer (mouse only)", `<span class="fi-pin" tabindex="0" aria-label="Example pin">${pinSvg(28, hex("color-cat-meal"))}</span>`)}
  </div>
  ${h3("The tokens")}${ul([
    "<code>--ease-out-circ</code> cubic-bezier(0.32, 0.72, 0, 1): quick to start, gentle to stop. It's the curve the bottom card's drawer library uses for its own 0.5-second slide.",
    "<code>--duration-fast</code> 150 ms, <code>--duration-default</code> 250 ms, <code>--duration-slow</code> 400 ms.",
    "<b>Switches use the default: 250 ms on the default curve</b>, for the knob's slide and the fill's color together (Kyle, round 6: at 150 ms it snapped on too fast to see it move). That's every switch: Filters, and the motion switch at the top of this section. Live is 150 ms (FilterPanel.tsx:136 and :145).",
    "<b>Known drift:</b> the code uses none of the four by name (globals.css:96-99), and <code>duration-fast</code> isn't a class Tailwind makes. Live, color changes are <code>duration-150</code> (most), 100 on a few, 300 for the bottom bar sliding sideways when the side panel opens, all on Tailwind's default curve, cubic-bezier(0.4, 0, 0.2, 1). The map flies to an event in 0.8 seconds.",
  ])}
  ${h3("Reduced motion")}${ul([
    "One rule in globals.css: when someone has turned motion off on their device, every animation and transition finishes in 0.01 ms. Everything still happens, it just appears instead of moving.",
    "Where it needs more: the Near me spinner stops (<code>motion-reduce:animate-none</code>), loading words only pulse when motion is on (<code>motion-safe:animate-pulse</code>), and the map, the card's scroll and the guided tour jump instead of fly (<code>prefersReducedMotion()</code>, src/lib/useMediaQuery.ts:34).",
    "The event rings fall back to a still halo, and the NOW label is words, so nothing is lost.",
    "Hover effects that move (a pin growing) only run where there is a real mouse, so a phone never keeps one stuck.",
  ])}
  ${h3("Don't")}${ul(["A brightening or dimming filter on hover. Animate color, opacity or transform only.", "Anything that moves on its own except the two live signals above (you are here, an event going on now)."])}`,
});

// ── Rules for every piece ────────────────────────────────────────────────────────────────────────────────────
const rules = dsSec({
  id: "rules", name: "Rules for every piece", status: "changing",
  note: "Most hold live today. Where the code still breaks one (sub-48 buttons and fields, the hover brightening), it's listed under that component's Known live issue on the Components pages.",
  purpose: "These hold for everything, so they're checked on every page before Kyle sees it.",
  body: `<ol class="frules">${[
    ["Everything you tap is at least 48 by 48 pixels.", "A thumb on glass. A smaller drawing gets an invisible tap area around it; never shrink the look to hit the number."],
    ["Built for a 360-pixel phone, with the browser's address bar showing.", "Test at 360 by 640 or 740, not a tall 800 that never happens with the bar visible. Nothing scrolls sideways; 320 must not cut anything off."],
    ["Fast on slow 4G.", "About 400 kilobits a second. The home page stays under 460 KB, 340 KB of it code."],
    ["One orange action per screen.", "Orange with navy words, no hover change. The event pin is the one exception, with its own name."],
    ["No greys outside the bone and ink palette.", "Bone and ink are warm. No stock Tailwind colors at all; npm run lint refuses them. Errors are danger red, never red-500."],
    ["The keyboard ring is sage 500.", "2 pixels, 2 pixels out from the edge, 3 to 1 or more on the paper and on the hover fill."],
    ["Hover is a sage 100 fill.", "Never a grey, never a brightening. A Boxes-on item gets none."],
    ["An icon button beside a title lines up with the title's first line.", "Close in a card or panel header, for example, so a two-line title never pushes it to the middle."],
    ["The category is colored words under the name.", "14 pixels semibold, middle dots between pieces: Food Pantry · SNAP · WIC. No pill. The same style anywhere a category or SNAP and WIC shows."],
    ["No long dashes in anything a person reads.", "A period, a comma or a colon instead of the long dash (—). The one dash is the short one between two times, 9am – 1pm, as the place card shows hours, and a time range never splits across lines."],
    ["Every word ships in English and Spanish.", "Spanish uses tú. Labels that a screen reader says go through the same translation file."],
    ["Color is never the only sign.", "Boxes on also fills the heart; Hours unknown has its own icon and words."],
  ].map(([r, w]) => `<li><b>${r}</b><small>${w}</small></li>`).join("")}</ol>`,
});

const older = dsSec({
  id: "older-phones", name: "Built for older phones", status: "built",
  note: "A summary of DESIGN.md's Low-end device guardrails (#233), which has the measurements.",
  purpose: "People looking for food are more likely to be on a two- or three-year-old mid-range Android on a slow connection than on a new iPhone. Every change is checked against that phone before it ships.",
  body: `<div class="fi-older">
    <div><b>The phone</b><small>An average Android, 2 to 3 years old: a modest chip, little memory. 360 pixels wide, with 80 to 140 pixels of height lost to the browser's own bars. One thumb.</small></div>
    <div><b>The network</b><small>Slow 4G is the bar, not Wi-Fi. The home page: 380 KB measured (2026-09-24), budget 460 KB, of which code 340 KB.</small></div>
    <div><b>Thumb reach</b><small>Main actions sit low and centred, in the bottom bar. Nothing important in the top corners. No floating buttons on the map itself: a new control joins the search bar row or the bottom bar, or goes to Kyle as a mockup first.</small></div>
    <div><b>The browser's bars</b><small>Things pinned to the bottom use the small screen height (100svh, with a plain fallback) and the phone's safe area. A real iPhone showed a plain bottom: 0 already clears the toolbar; adding a toolbar reserve lifted the bar too high twice.</small></div>
    <div><b>Reading</b><small>Body words ink 700 on bone 50. Text boxes 16 pixels on phones so iPhones don't zoom.</small></div>
    <div><b>The check before merge</b><small>360 by 740 and 375 by 667, the processor slowed 4 times, Slow 4G, no sideways scroll, no console errors. A real phone when one is to hand.</small></div>
  </div>
  ${fwdlink("Open Components", "components.html")}`,
});

const parts = [colors, type, spacing, corners, shadows, layering, motion, rules, older];
const items: [string, string][] = [["#colors", "Colors"], ["#type", "Type"], ["#spacing", "Spacing and layout"], ["#corners", "Corners"], ["#shadows", "Shadows"], ["#layering", "Layering"], ["#motion", "Motion"], ["#rules", "Rules for every piece"], ["#older-phones", "Older phones"], ["icons.html", "Icons →"]];

export const pages: Page[] = [{
  slug: "foundations", route: "DESIGN.md → Foundations", title: "Design system: Foundations", area: "Design system", nav: "Foundations",
  blurb: "Colors with their contrast ratios, type, spacing, corners, shadows, layering, motion, and the rules every piece follows.",
  changed: [
    "Hover becomes a sage 100 fill everywhere, never a grey, and the hover brightening goes (decided, Kyle).",
    "The category becomes colored words under the name, so the category colors are now checked as words: all pass.",
    "Switches slide on in 250 ms with the default curve, knob and fill together (Kyle, round 6; live: 150 ms). The motion switch on this page now moves too: before, turning it on stopped its own slide.",
    "Everything else is the site as it is live today, written down from the code.",
  ],
  kept: [
    "The colors themselves: every one is copied from the site's theme, none changed.",
    "The event pin's orange, the one exception to orange as the main action (Kyle, 2026-10-10).",
  ],
  check: [
    "Known fails, listed and not changed: the text-box edge (bone 300 on white, 1.6 to 1) and the admin's Low tag (warning on clay 100, 4.0 to 1).",
    "Spacing 5, 6, 8 and 10 are 24, 32, 48 and 64 pixels on this site, not stock Tailwind's numbers. Anyone building here needs to know.",
    "The motion names in the theme are never used by the code. Keep them as the standard for new work, or drop them?",
  ],
  html: `<div class="head"><h1>Foundations</h1></div>${toc(items)}${parts.join("")}`,
}];
