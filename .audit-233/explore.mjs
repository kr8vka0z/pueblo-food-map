// Scratch: list interactive elements per state to plan the audit. Never committed.
import { chromium } from "playwright-chromium";
const OUT = process.env.OUT;
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
const list = async (label) => {
  await page.screenshot({ path: `${OUT}/explore-${label}.png` });
  const items = await page.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="radio"], summary';
    return [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    }).map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName} ${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}`; });
  });
  console.log(`--- ${label}\n` + items.join("\n"));
};
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await list("splash");
const step = process.argv[2];
await browser.close();
