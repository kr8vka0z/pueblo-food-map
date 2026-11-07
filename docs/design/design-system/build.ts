// Builds the mockup site: MOCK_DIST=<dir> bun build.ts → one HTML file per page in <dir>. Every file in pages/
// exports `pages`. brand.ts supplies the colors (written out as brand.css), fonts, logo and the admin menu.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { brand } from "./brand";
import { ICON_SET } from "./icons";
import type { Page } from "./lib";

const here = resolve(import.meta.dir);
// WHY no default inside the kit folder: the kit lives in a synced folder, and a dist/ there would sync everywhere.
if (!process.env.MOCK_DIST) { console.error("Set MOCK_DIST to the folder to build into, e.g. MOCK_DIST=/tmp/mocks/dist bun build.ts"); process.exit(1); }
const dist = resolve(process.env.MOCK_DIST);
// WHY: the build deletes MOCK_DIST before writing it, so a typo must never point that delete at real work.
// The master copy sits inside the design skill (synced to every machine; ../../SKILL.md exists only there): it never builds into itself; project copies may.
const master = existsSync(join(here, "..", "..", "SKILL.md")) && dist.startsWith(here + "/");
const unsafe = master || dist === "/" || dist === homedir() || dist === here || here.startsWith(dist + "/") || dist.split("/").includes(".git") || existsSync(join(dist, ".git"));
const allowed = dist.startsWith(here + "/") || dist.includes("/scratch/") || ["dist", "out", "build"].includes(basename(dist));
if (unsafe || !allowed) {
  console.error(`Refusing to build into ${dist}: the build deletes that folder first. Use a folder inside a project's copy of this kit (never the master copy in the design skill), a path containing /scratch/, or one named dist, out or build (never /, the home folder, the kit or a folder above it, or a git repo).`);
  process.exit(1);
}

const iconByName = new Map(ICON_SET.flatMap((c) => c.icons));
for (const [, items] of brand.nav) for (const [label, , icon] of items) if (!iconByName.has(icon)) console.warn(`menu item ${label}: no icon named ${icon} in icons.ts`);

const sideMenu = (active: string) => `<a class="logo" href="index.html"><img src="${brand.logo}" alt="">${brand.adminLabel}</a>
${brand.nav.map(([g, items]) => `${g ? `<div class="navg">${g}</div>` : ""}${items
  .map(([label, slug, icon]) => `<a class="navi${label === active ? " on" : ""}" href="${slug}.html"${label === active ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${iconByName.get(icon) ?? ""}</svg>${label}</a>`)
  .join("")}`).join("")}
<div class="navfoot"><span class="ava">${brand.user[0].toUpperCase()}</span>${brand.user}</div>`;

// brand.css: the custom properties mock.css reads, plus the few drawings whose color can't come from a variable.
const enc = (h: string) => h.replace("#", "%23");
const svgUrl = (stroke: string, w: number, d: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${enc(stroke)}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`;
const c = brand.colors;
const brandCss = `/* Written by build.ts from brand.ts. Edit brand.ts, not this file. */
${brand.fonts.files.map((f) => `@font-face{font-family:"${f.family}";src:url(assets/${f.file}) format("woff2");font-weight:${f.weight};font-display:swap}`).join("\n")}
:root{${Object.entries(c).map(([k, val]) => `--${k}:${val}`).join(";")};
--display:${brand.fonts.display};--body:${brand.fonts.body};
${Object.entries(brand.radius).map(([k, r]) => `--r-${k}:${r}px`).join(";")};
--chev-down:${svgUrl(c.primary, 2.6, "M6 9l6 6 6-6")};--chev-up:${svgUrl(c.primary, 2.6, "M6 15l6-6 6 6")};--tick:${svgUrl(c["on-accent"], 3, "M5 12.5l4.5 4.5L19 7.5")}}
`;

const docHead = (title: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${title}</title><link rel="stylesheet" href="brand.css"><link rel="stylesheet" href="mock.css"></head>`;

const pages: Page[] = [];
const contrastFailures: string[] = []; // a page file may export these (the Foundations page does)
for (const f of readdirSync(join(here, "pages")).sort()) {
  if (!f.endsWith(".ts")) continue;
  const m = await import(join(here, "pages", f));
  pages.push(...m.pages);
  contrastFailures.push(...(m.contrastFailures ?? []));
}
// Stops before anything is deleted, so a bad color never wipes the last good build.
if (contrastFailures.length) { console.error(`Brand colors too faint where they're used (brand.ts → colors):\n${contrastFailures.map((x) => `  ✗ ${x}`).join("\n")}`); process.exit(1); }
// Stable sort: index first, then by area (brand.areas order), file order inside an area.
const rank = (p: Page) => (p.slug === "index" ? -1 : brand.areas.indexOf(p.area));
for (const p of pages) if (p.slug !== "index" && !brand.areas.includes(p.area)) console.warn(`${p.slug}: area "${p.area}" is not in brand.areas`);
pages.sort((a, z) => rank(a) - rank(z));
const known = new Set(pages.map((p) => p.slug));
for (const [, items] of brand.nav) for (const [label, slug] of items) if (!known.has(slug)) console.warn(`menu item ${label}: no page ${slug}`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(here, "assets"), join(dist, "assets"), { recursive: true });
cpSync(join(here, "mock.css"), join(dist, "mock.css"));
cpSync(join(here, "mock.js"), join(dist, "mock.js"));
writeFileSync(join(dist, "brand.css"), brandCss);
writeFileSync(join(dist, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");

const list = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
pages.forEach((p, i) => {
  const prev = pages[i - 1], next = pages[i + 1];
  const html = typeof p.html === "function" ? p.html(pages) : p.html;
  // Review strip: not part of the design. Notes holds what changes, what's kept, and the calls to check.
  const strip = `<div class="rv"><a href="index.html">All pages</a><b>${i + 1} of ${pages.length}: ${p.title} <span class="big">· ${p.route}</span></b>
  ${prev ? `<a class="big" href="${prev.slug}.html" aria-label="Previous page">‹</a>` : ""}${next ? `<a class="big" href="${next.slug}.html" aria-label="Next page">›</a>` : ""}
  <button type="button" class="big" id="rvcomp" aria-pressed="true">Computer</button><button type="button" class="big" id="rvphone" aria-pressed="false">Phone</button><button type="button" id="rvnotesbtn">Notes</button></div>
  <div class="rvnotes"><h4>What changes</h4>${list(p.changed)}${p.kept?.length ? `<h4>Kept as is, not shown here</h4>${list(p.kept)}` : ""}${p.check?.length ? `<h4>Change for you to check</h4>${list(p.check)}` : ""}<p><button type="button" class="lnk" id="rvnotesclose">Close</button></p></div>`;
  const content = `<div class="wrap${p.narrow ? " narrow" : ""}">${html}</div>`;
  const shell = p.bare
    ? `<div class="shell"><div class="col">${content}</div></div>`
    : `<div class="shell"><aside class="side" aria-label="Admin menu">${sideMenu(p.nav)}</aside><div class="col"><div class="topbar"><button type="button" aria-label="Open menu" data-nav-open>≡</button>${brand.adminLabel}</div>${content}</div></div>
  <div class="drawer"><aside class="side" aria-label="Admin menu"><button type="button" data-nav-close class="lnk" style="color:#fff;align-self:flex-end">Close menu</button>${sideMenu(p.nav)}</aside></div>`;
  for (const m of html.matchAll(/href="([a-z0-9-]+)\.html/g)) if (!known.has(m[1])) console.warn(`${p.slug}: link to missing page ${m[1]}`);
  writeFileSync(join(dist, `${p.slug}.html`), `${docHead(`${p.title}, ${brand.siteName} mockup`)}<body>${strip}${shell}<div class="sr" role="status" id="toastsay"></div><div class="sr" role="status" id="picksay"></div><div class="toast" aria-hidden="true"></div><script src="mock.js"></script></body></html>`);
});
if (!known.has("index")) console.warn("no index page: add pages/00-index.ts");
console.log(`${pages.length} pages built into ${dist}`);
