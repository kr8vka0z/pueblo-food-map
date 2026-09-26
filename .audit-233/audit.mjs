// Scratch (never committed): #233 touch-target + spacing audit of `/`.
// Usage: OUT=<dir> TAG=before|after [LOCALE=es] [WEBGL=0] [W=360 H=740] node audit.mjs
// Measures every visible interactive control's visual box AND its real hit
// area (elementFromPoint scan along the centre lines, so ::before overlays and
// overlapping neighbours are both accounted for).
import { chromium } from "playwright-chromium";
import fs from "node:fs";

const OUT = process.env.OUT;
const TAG = process.env.TAG ?? "run";
const LOCALE = process.env.LOCALE ?? "en";
const WEBGL = process.env.WEBGL !== "0";
const W = Number(process.env.W ?? 360), H = Number(process.env.H ?? 740);
const mobile = W < 768;
const prefix = `${OUT}/${TAG}-${LOCALE}-${WEBGL ? "gl" : "nogl"}-${W}`;

const browser = await chromium.launch({
  args: WEBGL ? ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] : ["--disable-gpu", "--disable-webgl", "--disable-3d-apis"],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 2,
  geolocation: { latitude: 38.2544, longitude: -104.6091 }, permissions: ["geolocation"],
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function measure(state) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${prefix}-${state}.png` });
  const rows = await page.evaluate(() => {
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="switch"], [role="menuitem"], [role="menuitemradio"], [role="tab"], [role="checkbox"], [role="radio"], [role="option"], summary, label:has(input)';
    const els = [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === "hidden" || cs.pointerEvents === "none") return false;
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
      if (el.closest("[inert],[aria-hidden=true]")) return false;
      // a label wrapping an input is measured as the label only
      if (el.tagName === "INPUT" && el.closest("label")) return false;
      // a wrapper (e.g. <li role=menuitem>) around one control is measured as that control
      const inner = el.querySelector('button, a[href]');
      if (inner && el.tagName === "LI") return false;
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const hit = document.elementFromPoint(cx, cy);
      return hit && (el === hit || el.contains(hit) || hit.contains(el) || hit.closest("label") === el);
    });
    const owns = (el, x, y) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      const h = document.elementFromPoint(x, y);
      return !!h && (h === el || el.contains(h) || h.closest("label") === el);
    };
    const run = (el, cx, cy, dx, dy) => { let n = 0; while (n < 500 && owns(el, cx + dx * (n + 1), cy + dy * (n + 1))) n++; return n; };
    return els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const L = run(el, cx, cy, -1, 0), R = run(el, cx, cy, 1, 0), U = run(el, cx, cy, 0, -1), D = run(el, cx, cy, 0, 1);
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.getAttribute("title") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 42);
      return { i, pin: !!el.closest('.mapboxgl-marker'), tag: el.tagName.toLowerCase(), name, vis: { x: r.left, y: r.top, w: r.width, h: r.height },
        hit: { x: cx - L, y: cy - U, w: L + R + 1, h: U + D + 1 },
        pseudo: (() => { const b = getComputedStyle(el, "::before"); return b.position === "absolute" ? `${parseFloat(b.width).toFixed(1)}x${parseFloat(b.height).toFixed(1)}` : ""; })() };
    });
  });
  const gap = (a, b) => Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w), Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
  for (const r of rows) {
    let best = null;
    for (const o of rows) {
      if (o === r || o.pin || inside(r.vis, o.vis) || inside(o.vis, r.vis)) continue;
      const g = gap(r.hit, o.hit);
      const ov = Math.min(r.hit.x + r.hit.w, o.hit.x + o.hit.w) - Math.max(r.hit.x, o.hit.x) > 1.5 && Math.min(r.hit.y + r.hit.h, o.hit.y + o.hit.h) - Math.max(r.hit.y, o.hit.y) > 1.5;
      if (ov) r.overlap = o.name;
      if (!best || g < best.g) best = { g, name: o.name };
    }
    r.nearest = best;
    r.small = Math.min(r.hit.w, r.hit.h) < 47; // ±1px scan tolerance
    r.tight = best && best.g < 7; // ±1px: the scan works in whole pixels, layout doesn't
  }
  fs.writeFileSync(`${prefix}-${state}.json`, JSON.stringify(rows, null, 1));
  console.log(`\n### ${state}`);
  const pins = rows.filter((r) => r.pin);
  if (pins.length) console.log(`(map pins: ${pins.length} measured, ${pins.filter((r) => r.small).length} under 48 — omitted below)`);
  for (const r of rows) {
    if (r.pin) continue;
    const f = [r.small && "SMALL", r.tight && "TIGHT", r.overlap && "OVERLAP"].filter(Boolean).join(",");
    console.log(`${f.padEnd(19)} ${r.tag.padEnd(6)} ${r.name.padEnd(42)} vis ${Math.round(r.vis.w)}x${Math.round(r.vis.h)} hit ${Math.round(r.hit.w)}x${Math.round(r.hit.h)} @${Math.round(r.vis.x)},${Math.round(r.vis.y)} gap ${r.nearest ? Math.round(r.nearest.g) + "→" + r.nearest.name.slice(0, 20) : "-"}${r.pseudo ? " ::before " + r.pseudo : ""}`);
  }
}

const esc = () => page.keyboard.press("Escape");
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await measure("1-splash");
await page.getByRole("button", { name: LOCALE === "es" ? /Encuentra comida/ : /Find food near me/ }).click();
await page.waitForTimeout(WEBGL ? 4000 : 1500);
await measure("2-home");

// Filters panel
await page.getByRole("button", { name: /^(Filters|Filtros)/ }).first().click();
await page.waitForTimeout(500);
await measure("3-filters");
// scroll the panel through to catch rows below the fold
const scrolled = await page.evaluate(() => {
  const s = [...document.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.closest('[role="dialog"]'));
  if (!s) return false; s.scrollTop = s.scrollHeight; return true;
});
if (scrolled) await measure("3b-filters-scrolled");
await esc(); await page.waitForTimeout(400);

// Menu (includes the language toggle)
await page.getByRole("button", { name: /^(Menu|Menú)$/ }).click();
await measure("4-menu");
// List view via menu (map mode only; no-WebGL is already list)
const listItem = page.getByRole(/.*/.test("") ? "button" : "button", { name: /^(List view|Vista de lista|Lista)/i });
if (await listItem.count()) { await listItem.first().click(); } else { await esc(); }
await page.waitForTimeout(800);
await measure("5-list");

// Venue card via list row
const firstRow = page.locator("ul li button").first();
await firstRow.click();
await page.waitForTimeout(1200);
await measure("7-card");
const details = page.getByRole("button", { name: /(Show details|Ver detalles|Mostrar detalles)/i });
if (await details.count()) { await details.first().click(); await page.waitForTimeout(800); await measure("8-card-expanded"); }
await page.getByRole("button", { name: /(to saved|a guardados)/i }).first().click().catch(() => console.log("no fav button"));

await page.getByRole("button", { name: /^(Close|Cerrar)/ }).first().click().catch(() => esc());
await page.waitForTimeout(800);
// Search popover
await page.getByRole("combobox").first().click().catch(() => page.locator("input").first().click());
await page.waitForTimeout(400);
await measure("6-search-focus");
await esc(); await page.locator("body").click({ position: { x: 5, y: 300 } }).catch(() => {});
await page.waitForTimeout(300);

// Typed search (clear button + empty-state category chips)
await page.getByRole("combobox").first().click();
await page.getByRole("combobox").first().fill("zzzz");
await page.waitForTimeout(800);
await measure("6b-search-typed");
await page.getByRole("combobox").first().fill("");
await esc(); await page.waitForTimeout(400);
// Saved list (a venue was favourited in the card step)
const savedNav = page.getByRole("button", { name: /^(Saved|Guardados)$/ });
await savedNav.click(); await measure("10-saved");
console.log("\nerrors:", errors.length ? errors : "none");
await browser.close();
