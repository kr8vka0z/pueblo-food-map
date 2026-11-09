// Design system: Logo options. Six candidate marks (A to F) beside today's pin, each shown large, with the Fraunces
// wordmark side by side and stacked, as a phone app icon with a round mask, at true 16 and 32 pixel tab size, one
// color for a photocopied flyer, on a welcome-screen header and on a link preview. Kyle picks one or two to refine.
// The SVG files in assets/logo-options/ are written from the shapes below: after changing a shape, run
// `bun pages/06-logo.ts` from the kit folder to rewrite them (the build only copies them). CSS: mock.css "logo".
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dsSec, hex, toc, ul, type Page } from "../lib";

// Colors copied from brand.ts (itself from globals.css @theme). Standalone SVG files can't read brand.css, so the
// hex values are written into each file.
const SAGE = hex("color-sage-600"), ORANGE = hex("color-brand-orange"), NAVY = hex("color-brand-navy"), BONE = hex("color-bone-50");

/** How a mark is painted. `color` on light paper, `mono` black only (a photocopied flyer), `onsage` on the app icon. */
type V = "color" | "mono" | "onsage";
/** A mark in a 64 by 64 box. `cuts` are holes (drawn black in a mask, so they are see-through in every version),
 *  `art` is the shape the holes cut into, `over` sits on top, uncut. `small` drops detail that turns to mush at 16
 *  pixels (the tab icon gets the plain version, as every icon set does). */
type Drawn = { cuts: string; art: string; over?: string };
type Mark = { id: string; name: string; idea: string; catch: string; draw: (v: V, small: boolean) => Drawn };

const paint = (v: V, light: string, onsage: string) => (v === "mono" ? "#000" : v === "onsage" ? onsage : light);
const stroke = (d: string, w: number, c: string) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const cut = (d: string, w?: number) => (w ? stroke(d, w, "#000") : `<path d="${d}" fill="#000"/>`);
const dot = (x: number, y: number, r: number) => `M${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}Z`;

const MARKS: Mark[] = [
  {
    id: "a", name: "Pin with a bowl",
    idea: "The map pin everyone knows, with a warm bowl of food where the dot would be.",
    catch: "The steam is too fine for a browser tab, so the tab icon drops it and shows a pin with a bowl.",
    draw: (v, small) => {
      const pin = "M32 61L14.94 37.25A21 21 0 1 1 49.06 37.25Z";
      // A bowl, not a smile: the rim sticks out past the bowl, and three wisps of steam rise from it.
      const bowl = small ? "M15.5 20.5H48.5A2 2 0 0 1 48.5 24.5H46.5A14.5 14.5 0 0 1 17.5 24.5H15.5A2 2 0 0 1 15.5 20.5Z"
        : "M18 22.5H46A1.75 1.75 0 0 1 46 26H44.5A12.5 12.5 0 0 1 19.5 26H18A1.75 1.75 0 0 1 18 22.5Z";
      const steam = small ? "" : ["M25 18.5c-2.6-2.4 2.6-4.4 0-7.2", "M32 18.5c-2.8-2.8 2.8-5.2 0-9", "M39 18.5c-2.6-2.4 2.6-4.4 0-7.2"].map((d) => cut(d, 3)).join("");
      // Mono and the app icon cut the bowl out; on light paper it is filled orange, the brand's food color.
      return v === "color" ? { cuts: steam, art: `<path d="${pin}" fill="${SAGE}"/><path d="${bowl}" fill="${ORANGE}"/>` }
        : { cuts: cut(bowl) + steam, art: `<path d="${pin}" fill="${paint(v, SAGE, BONE)}"/>` };
    },
  },
  {
    id: "b", name: "Pueblo chile pin",
    idea: "A map pin made from a Pueblo chile, green stem on top, the pin's dot in the middle. Nobody else's food map could use it.",
    catch: "On its own, the chile could read as a hot sauce or a salsa brand, so it leans on the name beside it.",
    draw: (v) => {
      // Long and leaning, the tip curling right, like a Pueblo (Mirasol) chile hanging from its stem.
      const body = "M18 28C18 23 24 22 32 22.5C40 22 46 23 46 28C46 41 46.5 52 41.2 60C40.4 61.4 38.6 61.2 38.6 59.6C38 49 18 44 18 28Z";
      const cap = "M15 28C14 13 50 13 49 28C44 24 38 23.5 32 25.5C26 23.5 20 24 15 28Z";
      const green = paint(v, SAGE, BONE);
      return {
        cuts: cut("M15 28C20 24 26 23.5 32 25.5C38 23.5 44 24 49 28", 3.2) + cut(dot(32, 33.5, 5.5)),
        art: `<path d="${body}" fill="${paint(v, ORANGE, ORANGE)}"/><path d="${cap}" fill="${green}"/>${stroke("M32 19C32 12 36 7 42 5", 5, green)}`,
      };
    },
  },
  {
    id: "c", name: "Plate with a pin",
    idea: "A plate seen from above with a map pin standing in the middle: a meal, and where to find it. (Compass notches on the rim were tried and dropped: they made it look like a gun sight.)",
    catch: "Round and simple, but plates are common in restaurant logos, and the pin is small inside it at tab size.",
    draw: (v, small) => {
      // The tab icon has no room for the plate's inner ring, so its pin grows to fill the plate instead.
      const pin = small ? "M32 50L22.27 34.4A11.5 11.5 0 1 1 41.73 34.4Z" : "M32 44L25.23 33.26A8 8 0 1 1 38.77 33.26Z";
      const pd = small ? dot(32, 28.5, 4) : dot(32, 29, 3);
      const well = small ? "" : stroke(dot(32, 32, 21).replace(/Z$/, ""), 2.6, "#000");
      // On a photocopy the pin is a pin-shaped hole in the plate with its dot left standing.
      return v === "mono"
        ? { cuts: well + cut(pin), art: `<path d="${dot(32, 32, 29.5)}" fill="#000"/>`, over: `<path d="${pd}" fill="#000"/>` }
        : { cuts: well, art: `<path d="${dot(32, 32, 29.5)}" fill="${paint(v, SAGE, BONE)}"/>`, over: `<path d="${pin}${pd}" fill-rule="evenodd" fill="${ORANGE}"/>` };
    },
  },
  {
    id: "d", name: "Sprout pin",
    idea: "A map pin with two leaves growing from its top: gardens, fresh food, and a community that grows.",
    catch: "Sprouts are a common sign for gardening and health brands, so it says “garden” louder than “pantry”.",
    draw: (v) => {
      const pin = "M32 62L19.71 47.24A16 16 0 1 1 44.29 47.24Z";
      const green = paint(v, SAGE, BONE);
      return {
        cuts: cut(dot(32, 37, 6)),
        art: `<path d="${pin}" fill="${paint(v, ORANGE, ORANGE)}"/>${stroke("M32 23V12", 4.5, green)}<path d="M31 15.5C27 6 19 3 10.5 5C12.5 13.5 21 17.5 31 15.5Z" fill="${green}"/><path d="M33 12.5C37 3.5 45 0.5 53.5 2.5C51.5 11 43 15 33 12.5Z" fill="${green}"/>`,
      };
    },
  },
  {
    id: "e", name: "P monogram",
    idea: "A serif P like the one in the name, whose round part is a map pin with its dot. It can stand in for the whole name.",
    catch: "A letter needs learning before it means anything, and it is a drawn letter in the spirit of Fraunces, not the font's own P.",
    draw: (v) => {
      const stem = "M8 6H25V54H31V58H8V54H15V10H8Z";
      const bowl = "M23 6H36A18 18 0 0 1 50.6 34.6C45 42 35 46 25 48.5H23Z";
      return { cuts: cut(dot(36, 24, 7.5)), art: `<path d="${bowl}" fill="${paint(v, ORANGE, ORANGE)}"/><path d="${stem}" fill="${paint(v, NAVY, BONE)}"/>` };
    },
  },
  {
    id: "f", name: "Folded map with a route",
    idea: "A paper map folded in three, with a walking route that ends at a pin: the whole job of the site in one picture.",
    catch: "The most detail of the six, so it is the hardest to read at tab size and on a bad photocopy.",
    draw: (v, small) => {
      const panels = ["M6 15L23 9V53L6 59Z", "M23 9L41 15V59L23 53Z", "M41 15L58 9V53L41 59Z"];
      const pin = "M47.5 31L41.44 20.5A7 7 0 1 1 53.56 20.5Z";
      const p = paint(v, SAGE, BONE);
      return {
        // The tab icon drops the route: at 16 pixels it is a smear across the folds.
        cuts: cut("M23 9V53", 2.4) + cut("M41 15V59", 2.4) + (small ? "" : cut("M12 51C16 41 26 45 29 37C31.5 30.5 37 30 41 29", 3.6)) + stroke(pin, 6, "#000"),
        art: panels.map((d) => `<path d="${d}" fill="${p}"/>`).join(""),
        over: `<path d="${pin}${small ? "" : dot(47.5, 17, 2.6)}" fill-rule="evenodd" fill="${paint(v, ORANGE, ORANGE)}"/>`,
      };
    },
  },
];

/** One SVG document. `box` is its own size; the mark is placed at `at` and scaled by `k`. */
function svg(m: Mark, v: V, o: { box: number; at?: number; k?: number; bg?: string; small?: boolean; rx?: number }) {
  const d = m.draw(v, !!o.small);
  const t = o.at || o.k ? ` transform="translate(${o.at ?? 0} ${o.at ?? 0}) scale(${o.k ?? 1})"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.box} ${o.box}" width="${o.box}" height="${o.box}">${o.bg ? `<rect width="${o.box}" height="${o.box}"${o.rx ? ` rx="${o.rx}"` : ""} fill="${o.bg}"/>` : ""}<g${t}><mask id="k" maskUnits="userSpaceOnUse" x="-4" y="-4" width="72" height="72"><rect x="-4" y="-4" width="72" height="72" fill="#fff"/>${d.cuts}</mask><g mask="url(#k)">${d.art}</g>${d.over ?? ""}</g></svg>\n`;
}

/** Every file per mark: color on light, one color, the 512 app icon (full bleed, so Android's round mask trims the
 *  corners; the mark stays inside the middle 288 pixels, the safe circle), and the tab icon on a sage tile. */
export function logoFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of MARKS) {
    out[`${m.id}-mark.svg`] = svg(m, "color", { box: 64 });
    out[`${m.id}-mono.svg`] = svg(m, "mono", { box: 64 });
    out[`${m.id}-app.svg`] = svg(m, "onsage", { box: 512, at: 112, k: 4.5, bg: SAGE });
    out[`${m.id}-tab.svg`] = svg(m, "onsage", { box: 64, at: 5, k: 0.84375, bg: SAGE, rx: 14, small: true });
  }
  // Today's app icon (public/icons/icon-512.png) redrawn for side by side: the 96 box of 01-brand.ts's pinMark.
  const today = `<path d="M48 18c-11.6 0-21 9.2-21 20.6C27 54 48 78 48 78s21-24 21-39.4C69 27.2 59.6 18 48 18z" fill="${ORANGE}" stroke="#FFFFFF" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="38" r="8" fill="#FFFFFF"/>`;
  out["today-app.svg"] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="512" height="512"><rect width="96" height="96" fill="${SAGE}"/>${today}</svg>\n`;
  out["today-tab.svg"] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="64" height="64"><rect width="96" height="96" rx="21" fill="${SAGE}"/>${today}</svg>\n`;
  return out;
}

if (import.meta.main) {
  const dir = join(import.meta.dir, "..", "assets", "logo-options");
  mkdirSync(dir, { recursive: true });
  for (const [f, s] of Object.entries(logoFiles())) writeFileSync(join(dir, f), s);
  console.log(`wrote ${Object.keys(logoFiles()).length} files to ${dir}`);
}

// The page. Every picture is an <img> of a file in assets/logo-options/, drawn by the browser at the size shown, so
// the 16 and 32 pixel tab icons are the real thing, not a big picture shrunk.
const src = (f: string) => `assets/logo-options/${f}.svg`;
const img = (f: string, n: number, alt = "", cls = "") => `<img src="${src(f)}" width="${n}" height="${n}" alt="${alt}"${cls ? ` class="${cls}"` : ""}>`;
const WM = "Pueblo Food Map";
const fig = (cls: string, body: string, cap: string) => `<figure class="lo-f ${cls}"><div>${body}</div><figcaption>${cap}</figcaption></figure>`;

/** The seven pictures for one option. `m` null is today: no mark, the typed name alone. */
function tiles(m: Mark | null) {
  const id = m ? m.id : "today";
  const mk = (n: number, alt = "") => (m ? img(`${id}-mark`, n, alt) : "");
  return `<div class="lo-g">
  ${fig("big", m ? mk(150, `Option ${m.id.toUpperCase()}: ${m.name}`) : img("today-app", 150, "Today: the orange pin app icon", "lo-rr"), m ? "The mark" : "Today's only mark is the app icon")}
  ${fig("lock", `<span class="lo-h">${mk(44)}<span class="lo-wm">${WM}</span></span><span class="lo-s">${mk(56)}<span class="lo-wm">${WM}</span></span>`, m ? "In a header on bone 50: side by side, and stacked" : "Today: the name alone, no mark")}
  ${fig("app", `${img(`${id}-app`, 96, "", "lo-rr")}${img(`${id}-app`, 96, "", "lo-round")}`, "Phone app icon: square, and in Android's round mask")}
  ${fig("tab", `<span class="lo-tab">${img(`${id}-tab`, 16)}<span>${WM}</span></span><span class="lo-tabs">${img(`${id}-tab`, 16)}${img(`${id}-tab`, 32)}</span>`, "Browser tab, at its real 16 and 32 pixels")}
  ${fig("mono", m ? `<span class="lo-h">${img(`${id}-mono`, 40)}<span class="lo-wm">${WM}</span></span>` : `<span class="lo-h"><span class="lo-wm">${WM}</span></span>`, m ? "One color, on a photocopied flyer" : "One color: only the name")}
  ${fig("hello", `<span class="lo-hi">${mk(40)}<span class="lo-wm">${WM}</span><small>A free, community-built map of food resources across Pueblo County.</small></span>`, "Top of the welcome screen")}
  ${fig("og", `<span class="lo-og">${m ? img(`${id}-mark`, 64) : ""}<span class="lo-wm">${WM}</span><small>pueblofoodmap.com</small></span>`, "Link preview, 1200 by 630")}
  </div>`;
}

const glance = dsSec({
  id: "glance", name: "All six at a glance",
  purpose: "Each mark at its real tab sizes and larger, so the small ones can be judged as a phone shows them.",
  body: `<div class="lo-sheet">${[null, ...MARKS].map((m) => {
    const id = m ? m.id : "today";
    return `<div class="lo-row"><b>${m ? `${m.id.toUpperCase()}. ${m.name}` : "Today: the pin"}</b><span class="lo-ic">${m ? `<span class="paper">${img(`${id}-mark`, 16)}${img(`${id}-mark`, 32)}${img(`${id}-mark`, 96)}</span>` : ""}<span class="tile">${img(`${id}-tab`, 16)}${img(`${id}-tab`, 32)}</span></span></div>`;
  }).join("")}</div>
  <p class="dssz">Left: the mark on bone 50 at 16, 32 and 96 pixels. Right: the tab icon at 16 and 32. A, C and F have a simpler tab icon, without the steam, the plate's inner ring, or the route: that detail turns to a smudge at 16 pixels.</p>`,
});

const todaySec = dsSec({
  id: "today", name: "Today: the pin and the typed name", status: "built",
  purpose: "Today the name is typed in Fraunces, and the only picture is the orange pin on green used as the app icon. The pin is the same as every other map's, and on a flyer there is nothing but the name.",
  body: tiles(null),
});

const options = MARKS.map((m) => dsSec({
  id: `opt-${m.id}`, name: `${m.id.toUpperCase()}. ${m.name}`, status: "new",
  purpose: m.idea,
  body: `<p class="lo-catch"><b>The catch:</b> ${m.catch}</p>${tiles(m)}`,
}));

const how = dsSec({
  id: "rules", name: "Whichever you pick",
  body: ul([
    "The mark always sits beside or above the name in Fraunces, never in place of it, except where there's no room: the app icon and the browser tab.",
    "Colors only from the site's own: sage 600, orange and navy on light paper; bone 50 and orange on green; black alone on a flyer.",
    "No gradients, glows, shadows or outlines, so it copies cleanly on a pantry's photocopier.",
    "The app icon keeps the mark inside the middle of the square, so Android's round mask never clips it.",
    "The files are drawn shapes (SVG), sharp at any size and a few hundred bytes each.",
  ]),
});

const all = [glance, todaySec, ...options, how];
const items: [string, string][] = [["#glance", "At a glance"], ["#today", "Today"], ...MARKS.map((m): [string, string] => [`#opt-${m.id}`, `${m.id.toUpperCase()}. ${m.name}`]), ["brand.html#logo", "← Brand: Logo"]];

export const pages: Page[] = [{
  slug: "logo", route: "Proposed: a logo mark (none yet)", title: "Design system: Logo options", area: "Design system", nav: "Brand",
  blurb: "Six logo ideas, each beside the Fraunces name, as an app icon, a tab icon, on a flyer and a link preview.",
  changed: [
    "Six ideas for a logo mark to sit beside the name: a pin with a bowl, a Pueblo chile pin, a plate with a pin, a sprout pin, a P monogram, and a folded map with a route.",
    "Each is shown as the site would use it: in the header, as the phone app icon, as the browser tab icon at its real size, in one color on a flyer, on the welcome screen and on a link preview.",
  ],
  kept: ["The name stays typed in Fraunces, as today. Only a mark is added beside it."],
  check: ["Pick one or two to refine; anything not mentioned is not chosen."],
  html: `<div class="head"><h1>Logo options</h1></div>${toc(items)}${all.join("")}`,
}];
