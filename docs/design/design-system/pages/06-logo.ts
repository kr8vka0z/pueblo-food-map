// Design system: Logo options. Round 2 leads with eight variations on F (F1 to F8); the first six marks (A to F) and
// today's pin follow under Earlier options. Each mark is shown large, with the Fraunces wordmark side by side and
// stacked, as a phone app icon with a round mask, at true 16 and 32 pixel tab size, one color for a photocopied
// flyer, on a welcome-screen header and on a link preview. Kyle picks one variation, or a mix of two.
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

// Round 2: Kyle leans to F. Eight different takes on it, each keeping a folded paper map, a route and a place to
// get to. Every one has its own tab drawing (`small`), made for 16 pixels: fewer, bigger shapes, never a shrunk copy.
/** Map pin: head centred at (cx, cy), radius r, point at (cx, ty); the sides are tangent to the head. */
const pinD = (cx: number, cy: number, r: number, ty: number) => {
  const a = Math.acos(r / (ty - cy)), sx = +(r * Math.sin(a)).toFixed(2), sy = +(cy + r * Math.cos(a)).toFixed(2);
  return `M${cx} ${ty}L${+(cx - sx).toFixed(2)} ${sy}A${r} ${r} 0 1 1 ${+(cx + sx).toFixed(2)} ${sy}Z`;
};
/** A folded map: panel edges at xs, the top corner heights in tops, each panel h tall. */
const panelsD = (xs: number[], tops: number[], h: number) => xs.slice(1).map((x, i) => `M${xs[i]} ${tops[i]}L${x} ${tops[i + 1]}V${tops[i + 1] + h}L${xs[i]} ${tops[i] + h}Z`);
const foldsD = (xs: number[], tops: number[], h: number) => xs.slice(1, -1).map((x, i) => `M${x} ${tops[i + 1]}V${tops[i + 1] + h}`);
const outlineD = (xs: number[], tops: number[], h: number) => `M${xs.map((x, i) => `${x} ${tops[i]}`).join("L")}${[...xs].reverse().map((x, i) => `L${x} ${tops[xs.length - 1 - i] + h}`).join("")}Z`;
const X3 = [6, 23.33, 40.67, 58], T3 = [15, 10, 15, 10];

/** The shared build of a filled map: panels with fold gaps and route cut out, and an orange pin on top with a gap. */
function mapMark(v: V, o: { xs: number[]; tops: number[]; h: number; fold: number; route?: string; rw?: number; extraCuts?: string; pin?: string; pinDot?: string; ring?: number; top?: string }): Drawn {
  return {
    cuts: foldsD(o.xs, o.tops, o.h).map((d) => cut(d, o.fold)).join("") + (o.route ? cut(o.route, o.rw) : "") + (o.extraCuts ?? "") + (o.pin ? stroke(o.pin, o.ring ?? 6, "#000") : ""),
    art: panelsD(o.xs, o.tops, o.h).map((d) => `<path d="${d}" fill="${paint(v, SAGE, BONE)}"/>`).join(""),
    over: (o.pin ? `<path d="${o.pin}${o.pinDot ?? ""}" fill-rule="evenodd" fill="${paint(v, ORANGE, ORANGE)}"/>` : "") + (o.top ?? ""),
  };
}

const VARS: (Mark & { tabBg?: string })[] = [
  {
    id: "f1", name: "Refined",
    idea: "Today's F, tidied: three equal panels at matching fold angles, a bolder route, and a bigger pin sitting square on the last panel.",
    catch: "Still the busiest of the eight. The tab icon keeps the route but drops the pin's dot to stay clean.",
    draw: (v, small) => small
      ? mapMark(v, { xs: [4, 22.67, 41.33, 60], tops: [16, 9, 16, 9], h: 46, fold: 4, route: "M10 53C14 44 24 48 30 40", rw: 7, pin: pinD(46, 21, 11, 41), ring: 7 })
      : mapMark(v, { xs: X3, tops: T3, h: 44, fold: 2.6, route: "M11.5 52C14.5 43 21 45.5 25 39C29 32.5 36 36 43 33", rw: 4.6, pin: pinD(49, 20, 8.5, 35), pinDot: dot(49, 20, 3), ring: 6 }),
  },
  {
    id: "f2", name: "Two panels",
    idea: "One fold instead of two, so every shape is bigger: a map like an open book, a fat route, and a big pin.",
    catch: "One fold reads a little less like a map and a little more like an open book or a brochure.",
    draw: (v, small) => small
      ? mapMark(v, { xs: [5, 32, 59], tops: [16, 8, 16], h: 44, fold: 5, route: "M12 52C17 41 27 47 33 38", rw: 8, pin: pinD(44, 21, 12.5, 43), pinDot: dot(44, 21, 4.4), ring: 7 })
      : mapMark(v, { xs: [8, 32, 56], tops: [15, 9, 15], h: 42, fold: 3, route: "M14 50C18 39 28 46 34 37", rw: 5.4, pin: pinD(44, 22, 10, 39), pinDot: dot(44, 22, 3.6), ring: 6.5 }),
  },
  {
    id: "f3", name: "Walking dots",
    idea: "The route is a trail of dots, like footsteps, leading to the pin. The site's first job is walking directions, and this says it.",
    catch: "Dots are a common sign for “route” on many maps, so it is clear but not unique; on a poor copy the dots can fill in.",
    draw: (v, small) => small
      ? mapMark(v, { xs: [4, 22.67, 41.33, 60], tops: [16, 9, 16, 9], h: 46, fold: 4, extraCuts: [[12, 52], [21, 44], [31, 39]].map(([x, y]) => cut(dot(x, y, 4.2))).join(""), pin: pinD(46, 21, 11, 41), ring: 7 })
      : mapMark(v, { xs: X3, tops: T3, h: 44, fold: 2.6, extraCuts: [[12, 52], [16.5, 44.5], [23, 40.5], [30, 37.5], [37, 35]].map(([x, y]) => cut(dot(x, y, 2.6))).join(""), pin: pinD(49, 20, 8.5, 35), pinDot: dot(49, 20, 3), ring: 6 }),
  },
  {
    id: "f4", name: "Route draws a P",
    idea: "The route walks up the first panel and loops across the other two, drawing a P for Pueblo, and ends at the pin.",
    catch: "The P only shows once you notice it, and the loop leaves less room for the pin.",
    draw: (v, small) => small
      ? mapMark(v, { xs: [4, 22.67, 41.33, 60], tops: [16, 9, 16, 9], h: 46, fold: 4, route: "M15 57V22H35C43 22 47 26.5 47 33C47 39.5 43 44 35 44H31", rw: 7.5, pin: pinD(26, 37, 6.5, 50), ring: 5 })
      : mapMark(v, { xs: X3, tops: T3, h: 44, fold: 2.6, route: "M14 55V22H34C41 22 45 26 45 31.5C45 37 41 41 34 41H30", rw: 5, pin: pinD(25, 33, 5.6, 45), pinDot: dot(25, 33, 2.1), ring: 4.4 }),
  },
  {
    id: "f5", name: "River route",
    idea: "The route flows in from the map's edge like the Arkansas River through Pueblo: wide where it starts, narrowing as it bends to the pin.",
    catch: "A shape that runs off the edge reads as a river or a road more than a walk, so “walk to food” is a little weaker.",
    draw: (v, small) => {
      // A filled ribbon, not a line, so it can taper from river width down to a path at the pin.
      const river = small
        ? "M-2 38C10 30 20 44 30 37C37 32 41 34 44 37.5L47.5 41C43 41.5 40 42 34.5 46C22 55 12 41 -2 50Z"
        : "M-2 39C11 31 20 46 31 38.5C38 33.5 42 33.5 45.2 32L48.6 34.2C44.5 36 41 38 33 44C20 53.5 11 40 -2 48Z";
      return mapMark(v, small
        ? { xs: [4, 22.67, 41.33, 60], tops: [16, 9, 16, 9], h: 46, fold: 4, extraCuts: cut(river), pin: pinD(48, 21, 10.5, 41), ring: 7 }
        : { xs: X3, tops: T3, h: 44, fold: 2.6, extraCuts: cut(river), pin: pinD(48.5, 20, 8, 34), pinDot: dot(48.5, 20, 2.9), ring: 6 });
    },
  },
  {
    id: "f6", name: "Food at the end",
    idea: "The route ends at a steaming bowl instead of a plain pin, so the mark says food as well as map.",
    catch: "The most to take in: map, route and bowl. The bowl sitting on a map can read as a café sign.",
    draw: (v, small) => {
      const bowl = small ? "M31 20H61A2 2 0 0 1 61 24H58.5A12.5 12.5 0 0 1 33.5 24H31A2 2 0 0 1 31 20Z" : "M37.5 18H60.5A1.75 1.75 0 0 1 60.5 21.5H58.5A9.5 9.5 0 0 1 39.5 21.5H37.5A1.75 1.75 0 0 1 37.5 18Z";
      const steam = small ? [] : ["M45 13.5c-2.2-2 2.2-3.8 0-6.5", "M53 13.5c-2.2-2 2.2-3.8 0-6.5"];
      const g = small ? { xs: [4, 22.67, 41.33, 60], tops: [16, 9, 16, 9], h: 46, fold: 4, route: "M10 53C14 44 24 48 31 41", rw: 7 } : { xs: X3, tops: T3, h: 44, fold: 2.6, route: "M11.5 52C14.5 43 21 45.5 25 39C29 32.5 36 36 44 33", rw: 4.6 };
      const d = mapMark(v, g);
      return { ...d, cuts: d.cuts + stroke(bowl, small ? 7 : 5.5, "#000") + steam.map((s) => cut(s, 7)).join(""), over: `<path d="${bowl}" fill="${paint(v, ORANGE, ORANGE)}"/>${steam.map((s) => stroke(s, 2.8, paint(v, ORANGE, ORANGE))).join("")}` };
    },
  },
  {
    id: "f7", name: "Line drawing",
    idea: "Drawn with one pen line the weight of the name's letters: the map's edge, its folds, a dotted route and the pin, no fills.",
    catch: "Lighter than the others, so it looks quieter on the app icon; thin lines suit print best and screens least.",
    draw: (v, small) => {
      const w = small ? 6.5 : 4.4, ink = paint(v, SAGE, BONE), o = paint(v, ORANGE, ORANGE);
      const xs = small ? [5, 22.67, 41.33, 59] : X3, tops = small ? [17, 10, 17, 10] : T3, h = small ? 42 : 44;
      const pin = small ? pinD(46, 21, 9.5, 39) : pinD(48.5, 20, 7.5, 34);
      const route = small ? "M12 50C16 42 24 46 30 39" : "M12.5 51C15.5 43 21 45.5 25 39C29 32.5 35 36 41 33";
      return {
        cuts: stroke(pin, w + (small ? 7 : 6), "#000"),
        art: stroke(outlineD(xs, tops, h), w, ink) + foldsD(xs, tops, h).map((d) => stroke(d, w, ink)).join("") + `<path d="${route}" fill="none" stroke="${o}" stroke-width="${w}" stroke-linecap="round"${small ? "" : ` stroke-dasharray="0.01 8.6"`}/>`,
        // The tab's pin is filled: an outline 6.5 units wide around a 9.5 hole is a blob at 16 pixels anyway.
        over: small ? `<path d="${pin}" fill="${o}"/>` : `${stroke(pin, w, o)}<path d="${dot(48.5, 20, 2.4)}" fill="${o}"/>`,
      };
    },
  },
  {
    id: "f8", name: "Bold badge",
    idea: "The map turned orange and set in a navy rounded square, with a navy route and pin: the strongest contrast on cream paper.",
    catch: "A badge is a box, so it looks more like an app button than a logo, and orange stands for “find food” elsewhere on the site.",
    tabBg: NAVY,
    draw: (v, small) => {
      // On light paper the navy badge is part of the mark; on the sage app icon and the navy tab tile the tile is the badge.
      const badge = v !== "onsage";
      const xs = [12, 25.33, 38.67, 52], tops = [21, 16, 21, 16], h = 32;
      const pin = pinD(44.5, 27, 6, 39), line = paint(v, NAVY, NAVY);
      const sw = small ? 1.4 : 1;
      const art = (badge ? `<rect width="64" height="64" rx="14" fill="${paint(v, NAVY, NAVY)}"/>` : "") + (v === "mono" ? "" : panelsD(xs, tops, h).map((d) => `<path d="${d}" fill="${ORANGE}"/>`).join(""));
      const lines = foldsD(xs, tops, h).map((d) => stroke(d, 2.2 * sw, line)).join("") + stroke("M16 46C19 40 24 42 27.5 37C30.5 32.5 34.5 35 38.5 32.5", 4 * sw, line) + `<path d="${pin}${small ? "" : dot(44.5, 27, 2.2)}" fill-rule="evenodd" fill="${line}"/>`;
      const g = badge ? "" : ` transform="translate(32 34) scale(${small ? 1.45 : 1.35}) translate(-32 -34)"`;
      // One color: the map is a hole in the black badge, so the route and pin print black on paper.
      return { cuts: v === "mono" ? panelsD(xs, tops, h).map((d) => cut(d)).join("") : "", art: `<g${g}>${art}</g>`, over: `<g${g}>${lines}</g>` };
    },
  },
];

/** One SVG document. `box` is its own size; the mark is placed at `at` and scaled by `k`. */
function svg(m: Mark & { tabBg?: string }, v: V, o: { box: number; at?: number; k?: number; bg?: string; small?: boolean; rx?: number }) {
  const d = m.draw(v, !!o.small);
  const t = o.at || o.k ? ` transform="translate(${o.at ?? 0} ${o.at ?? 0}) scale(${o.k ?? 1})"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.box} ${o.box}" width="${o.box}" height="${o.box}">${o.bg ? `<rect width="${o.box}" height="${o.box}"${o.rx ? ` rx="${o.rx}"` : ""} fill="${o.bg}"/>` : ""}<g${t}><mask id="k" maskUnits="userSpaceOnUse" x="-4" y="-4" width="72" height="72"><rect x="-4" y="-4" width="72" height="72" fill="#fff"/>${d.cuts}</mask><g mask="url(#k)">${d.art}</g>${d.over ?? ""}</g></svg>\n`;
}

/** Every file per mark: color on light, one color, the 512 app icon (full bleed, so Android's round mask trims the
 *  corners; the mark stays inside the middle 288 pixels, the safe circle), and the tab icon on a sage tile. */
export function logoFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of [...MARKS, ...VARS]) {
    out[`${m.id}-mark.svg`] = svg(m, "color", { box: 64 });
    out[`${m.id}-mono.svg`] = svg(m, "mono", { box: 64 });
    out[`${m.id}-app.svg`] = svg(m, "onsage", { box: 512, at: 112, k: 4.5, bg: SAGE });
    out[`${m.id}-tab.svg`] = svg(m, "onsage", { box: 64, at: 5, k: 0.84375, bg: "tabBg" in m && m.tabBg ? m.tabBg : SAGE, rx: 14, small: true });
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
function tiles(m: Mark | null, tabCap = "Browser tab, at its real 16 and 32 pixels") {
  const id = m ? m.id : "today";
  const mk = (n: number, alt = "") => (m ? img(`${id}-mark`, n, alt) : "");
  return `<div class="lo-g">
  ${fig("big", m ? mk(150, `Option ${m.id.toUpperCase()}: ${m.name}`) : img("today-app", 150, "Today: the orange pin app icon", "lo-rr"), m ? "The mark" : "Today's only mark is the app icon")}
  ${fig("lock", `<span class="lo-h">${mk(44)}<span class="lo-wm">${WM}</span></span><span class="lo-s">${mk(56)}<span class="lo-wm">${WM}</span></span>`, m ? "In a header on bone 50: side by side, and stacked" : "Today: the name alone, no mark")}
  ${fig("app", `${img(`${id}-app`, 96, "", "lo-rr")}${img(`${id}-app`, 96, "", "lo-round")}`, "Phone app icon: square, and in Android's round mask")}
  ${fig("tab", `<span class="lo-tab">${img(`${id}-tab`, 16)}<span>${WM}</span></span><span class="lo-tabs">${img(`${id}-tab`, 16)}${img(`${id}-tab`, 32)}</span>`, tabCap)}
  ${fig("mono", m ? `<span class="lo-h">${img(`${id}-mono`, 40)}<span class="lo-wm">${WM}</span></span>` : `<span class="lo-h"><span class="lo-wm">${WM}</span></span>`, m ? "One color, on a photocopied flyer" : "One color: only the name")}
  ${fig("hello", `<span class="lo-hi">${mk(40)}<span class="lo-wm">${WM}</span><small>A free, community-built map of food resources across Pueblo County.</small></span>`, "Top of the welcome screen")}
  ${fig("og", `<span class="lo-og">${m ? img(`${id}-mark`, 64) : ""}<span class="lo-wm">${WM}</span><small>pueblofoodmap.com</small></span>`, "Link preview, 1200 by 630")}
  </div>`;
}

/** One row per mark: on bone 50 at 16, 32 and 96, then its tab icon at 16 and 32. */
const sheet = (list: (Mark | null)[]) => `<div class="lo-sheet">${list.map((m) => {
    const id = m ? m.id : "today";
    return `<div class="lo-row"><b>${m ? `${m.id.toUpperCase()}. ${m.name}` : "Today: the pin"}</b><span class="lo-ic">${m ? `<span class="paper">${img(`${id}-mark`, 16)}${img(`${id}-mark`, 32)}${img(`${id}-mark`, 96)}</span>` : ""}<span class="tile">${img(`${id}-tab`, 16)}${img(`${id}-tab`, 32)}</span></span></div>`;
  }).join("")}</div>`;

const fGlance = dsSec({
  id: "f-glance", name: "Variations on F, at a glance",
  purpose: "You leaned towards F, the folded map with a route. Here are eight different takes on it, each still a folded paper map, a route and a place to get to. The first row is F as it was.",
  body: `${sheet([MARKS.find((m) => m.id === "f")!, ...VARS])}
  <p class="dssz">Left: the mark on bone 50 at 16, 32 and 96 pixels. Right: the browser tab icon at 16 and 32. F lost the most at 16 pixels, so every variation has its own tab drawing, made for that size: fewer and bigger shapes, never a shrunk copy.</p>`,
});

const fVars = VARS.map((m) => dsSec({
  id: `opt-${m.id}`, name: `${m.id.toUpperCase()}. ${m.name}`, status: "new",
  purpose: m.idea,
  body: `<p class="lo-catch"><b>The catch:</b> ${m.catch}</p>${tiles(m, m.tabBg ? "Browser tab at its real 16 and 32 pixels: on navy, the badge itself" : "Browser tab at its real 16 and 32 pixels: its own drawing")}`,
}));

const earlier = `<h2 class="lo-part" id="earlier">Earlier options</h2><p class="lo-partp">The first round: today's pin and the six first ideas, kept for comparison.</p>`;

const glance = dsSec({
  id: "glance", name: "The first six at a glance",
  purpose: "Each mark at its real tab sizes and larger, so the small ones can be judged as a phone shows them.",
  body: `${sheet([null, ...MARKS])}
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

const all = [fGlance, ...fVars, how, earlier, glance, todaySec, ...options];
const items: [string, string][] = [["#f-glance", "F at a glance"], ...VARS.map((m): [string, string] => [`#opt-${m.id}`, `${m.id.toUpperCase()}. ${m.name}`]), ["#earlier", "Earlier options"], ["brand.html#logo", "← Brand: Logo"]];

export const pages: Page[] = [{
  slug: "logo", route: "Proposed: a logo mark (none yet)", title: "Design system: Logo options", area: "Design system", nav: "Brand",
  blurb: "Eight variations on F, the folded map with a route, then the first six logo ideas.",
  changed: [
    "New at the top: eight variations on F, the folded map with a route, which you leaned towards. Each is a different drawing, not a color change, and each has its own tab icon made for 16 pixels.",
    "Each is shown as the site would use it: in the header, as the phone app icon, as the browser tab icon at its real size, in one color on a flyer, on the welcome screen and on a link preview.",
    "The first six ideas and today's pin are still below, under Earlier options.",
  ],
  kept: ["The name stays typed in Fraunces, as today. Only a mark is added beside it."],
  check: ["Pick one variation (or mix two: say which parts)."],
  html: `<div class="head"><h1>Logo options</h1></div>${toc(items)}${all.join("")}`,
}];
