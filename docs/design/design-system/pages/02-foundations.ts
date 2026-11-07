// Design system: Foundations. This round holds only the Colors section, because it is the contrast gate: every
// pair the code really uses for words (4.5 to 1) or for edges and icons (3 to 1) goes through used(), and build.ts
// stops when contrastFailures isn't empty. The rest of the page (type, spacing, corners, shadows, motion) comes
// in the next round. Each swatch's classification comes from how src/ uses that token (grep text-/border-/ring-).
import { contrast, dsSec, fwdlink, hex, ratio, type Page, type Token } from "../lib";

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
const swatch = ([name, t, job, p, w]: Sw) => `<div class="fsw"><span class="fchip" style="--c:${hex(t)}"></span><div><b>${name}</b> <code>${hex(t)}</code><small>${job}</small><small class="fcr">On the paper <i>${cr(`${name} on the paper`, hex(t), PAPER, p)}</i> · On white <i>${cr(`${name} on white`, hex(t), WHITE, w)}</i></small><small class="ftok">--${t}</small></div></div>`;
const swatches = (l: Sw[]) => `<div class="fsws">${l.map(swatch).join("")}</div>`;
/** A real foreground-on-background pair from the code, checked by the build. */
const pair = (label: string, fg: Token, bg: Token, need: 4.5 | 3, where: string) =>
  `<li><span class="fpair" style="background:${hex(bg)};color:${hex(fg)}">Aa</span><span><b>${label}</b> ${used(label, hex(fg), hex(bg), need)}<small>${where}</small></span></li>`;

const colors = dsSec({
  id: "colors", name: "Colors", status: "built",
  note: "Copied from src/app/globals.css, the source of truth. The ratios are worked out from those values each time this site builds, so they can't go stale.",
  purpose: "Bone is the paper, ink is the words, sage is everything you can press, orange and navy are the Pueblo Food Project brand and stay rare. ✓ means easy to read: words need 4.5 to 1, edges and icons 3 to 1.",
  body: `${h3("Brand")}${swatches([
    ["Navy", "color-brand-navy", "The wordmark, words on orange, the bottom bar's open item", "text", "text"],
    ["Orange", "color-brand-orange", "The splash buttons, the Filters count and Show places button, the event pin. Never words on light colors (a ✗ there is normal).", "show", "show"],
    ["Yellow", "color-brand-yellow", "Support badges only, with ink words on it", "-", "-"],
  ])}
  ${h3("Bone: the paper")}${swatches([
    ["Bone 50", "color-bone-50", "The paper every page sits on; words on sage, navy and the category colors", "-", "-"],
    ["Bone 100", "color-bone-100", "Hover fills, resting chips", "deco", "-"],
    ["Bone 200", "color-bone-200", "Card borders and dividers", "deco", "deco"],
    ["Bone 300", "color-bone-300", "Search bar, bottom bar and outline button edges at rest. The words inside carry those controls.", "deco", "deco"],
  ])}
  ${h3("Ink: the words")}${swatches([
    ["Ink 400", "color-ink-400", "Section labels (HOURS), placeholders, small icons", "text", "text"],
    ["Ink 500", "color-ink-500", "Second lines: distance, hours today, the bottom bar's words", "text", "text"],
    ["Ink 700", "color-ink-700", "Everyday words", "text", "text"],
    ["Ink 900", "color-ink-900", "Place names and headings", "text", "text"],
  ])}
  ${h3("Sage: everything you can press")}${swatches([
    ["Sage 50", "color-sage-50", "Plentiful link fill, the good-news tag", "-", "-"],
    ["Sage 100", "color-sage-100", "SNAP and WIC badge fill", "-", "-"],
    ["Sage 500", "color-sage-500", "Keyboard focus ring, today's line in the hours, the Plentiful link's edge. Never words: 4.4 to 1 on white.", "edge", "edge"],
    ["Sage 600", "color-sage-600", "The main color: the Walk button, link hovers", "text", "text"],
    ["Sage 700", "color-sage-700", "Link and phone words, SNAP and WIC words", "text", "text"],
  ])}
  ${h3("Clay and alerts")}${swatches([
    ["Clay 100", "color-clay-100", "Pale fill for reports and warnings", "-", "-"],
    ["Clay 500", "color-clay-500", "The filled save star, the × on the outside-the-county message", "edge", "edge"],
    ["Clay 700", "color-clay-700", "Words on the clay fill", "text", "text"],
    ["Success", "color-success", "Thank-you lines after a check-in, Stocked", "text", "text"],
    ["Warning", "color-warning", "Low (a box running low)", "-", "text"],
    ["Danger", "color-danger", "Error words, Empty, the remove buttons", "text", "text"],
  ])}
  ${h3("Category colors: map pins and the category badge")}${swatches([
    ["Pantry", "color-cat-pantry", "Pin and badge fill", "-", "-"],
    ["Grocery", "color-cat-grocery", "Pin and badge fill", "-", "-"],
    ["Convenience", "color-cat-convenience", "Pin and badge fill", "-", "-"],
    ["Farm", "color-cat-farm", "Pin and badge fill", "-", "-"],
    ["Garden", "color-cat-garden", "Pin and badge fill (the same green as sage 600)", "-", "-"],
    ["Edible landscape", "color-cat-landscape", "Pin and badge fill", "-", "-"],
    ["Meal site", "color-cat-meal", "Pin and badge fill", "-", "-"],
    ["Blessing box", "color-cat-blessing", "Pin and badge fill; also the Boxes word in the bottom bar when it's on", "text", "-"],
  ])}
  <p class="dssz">The pins sit on the map, not on the paper, so they have no paper ratio. The category badge on a place card puts bone 50 words on each of them: those pairs are below.</p>
  ${h3("Words on a fill, as the code uses them")}
  <ul class="fpairs">
    ${pair("Navy on orange", "color-brand-navy", "color-brand-orange", 4.5, "The splash buttons, Show places, the event card's Get directions")}
    ${pair("Bone 50 on sage 600", "color-bone-50", "color-sage-600", 4.5, "The Walk button, Filters")}
    ${pair("Bone 50 on sage 700", "color-bone-50", "color-sage-700", 4.5, "The Walk button with the pointer over it")}
    ${pair("Sage 700 on sage 100", "color-sage-700", "color-sage-100", 4.5, "SNAP and WIC badges")}
    ${pair("Sage 700 on sage 50", "color-sage-700", "color-sage-50", 4.5, "The Plentiful link, the good-news tag")}
    ${pair("Clay 700 on clay 100", "color-clay-700", "color-clay-100", 4.5, "Public report tag, problem tag")}
    ${pair("Ink 700 on yellow", "color-ink-700", "color-brand-yellow", 4.5, "Support badges")}
    ${pair("Ink 500 on bone 100", "color-ink-500", "color-bone-100", 4.5, "A bottom bar item with the pointer over it")}
    ${pair("Bone 50 on navy", "color-bone-50", "color-brand-navy", 4.5, "The event strip, the preview tag")}
    ${(["pantry", "grocery", "convenience", "farm", "garden", "landscape", "meal", "blessing"] as const).map((c) => pair(`Bone 50 on ${c}`, "color-bone-50", `color-cat-${c}`, 4.5, "Category badge on a place card")).join("")}
    ${pair("Sage 500 ring on bone 100", "color-sage-500", "color-bone-100", 3, "Keyboard ring on a bottom bar item with the pointer over it")}
  </ul>`,
});

const next = dsSec({
  id: "next", name: "Coming in the next round",
  note: "Type, spacing, corners, shadows, motion and the rules for every piece go here once the Components page's entry layout is settled.",
  body: fwdlink("Open Components", "components.html"),
});

export const pages: Page[] = [{
  slug: "foundations", route: "DESIGN.md → Foundations", title: "Design system: Foundations", area: "Design system", nav: "Foundations",
  blurb: "The colors with their contrast ratios. Type, spacing, corners, shadows and motion come in the next round.",
  changed: [
    "Nothing changes: these are the colors live on the site today.",
    "Only Colors is filled in this round. It stays because the build checks every color pair here and stops on one that's too faint.",
  ],
  check: ["Warning orange-brown words on the pale clay fill (the Low tag in the admin's boxes table) measure 4.0 to 1, under the 4.5 to 1 floor, so that pair isn't listed here as passing. Flagged for a later fix, not changed."],
  html: `<div class="head"><h1>Foundations</h1></div>${colors}${next}`,
}];
