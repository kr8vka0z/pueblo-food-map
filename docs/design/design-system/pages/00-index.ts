// The index: every page, grouped under brand.areas, each with its one-line blurb. build.ts hands it the page list.
import { brand } from "../brand";
import { type Page } from "../lib";

export const pages: Page[] = [{
  slug: "index", route: "Index", title: "All pages", area: "", nav: "Overview",
  blurb: "",
  changed: [
    "Every place, address and phone number is made up. The pieces on the Components page can be tapped; nothing saves and nothing leaves the page.",
    "Each page has Computer and Phone buttons and a Notes button on the top strip.",
    "To review: leave notes on the live link. Anything not mentioned counts as approved.",
  ],
  html: (all) => `<div class="head"><h1>${brand.siteName} mockups, ${brand.round.toLowerCase()}</h1></div>
${brand.areas.map((a) => {
  const ps = all.filter((p) => p.area === a);
  return ps.length ? `<div class="sec" style="margin-top:20px">${a}</div>${ps.map((p) => `<a class="rowl" href="${p.slug}.html"><span class="m"><b>${p.title}</b><small>${p.blurb}</small></span></a>`).join("")}` : "";
}).join("")}`,
}];
