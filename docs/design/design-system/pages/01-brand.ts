// Design system: Brand and feel. A placeholder this round: the Components page goes first so the owner can settle
// the entry layout. The kit's fill-in template for this page is in the design skill's mockup-kit/pages/01-brand.ts.
import { brand } from "../brand";
import { b, dsSec, fwdlink, type Page } from "../lib";

export const pages: Page[] = [{
  slug: "brand", route: "DESIGN.md → Overview", title: "Design system: Brand and feel", area: "Design system", nav: "Brand",
  blurb: "Coming in the next round: the feel, who it's for, how we sound, and the logo.",
  changed: ["Nothing here yet. This page fills in after the Components entry layout is settled."],
  html: `<div class="head"><h1>Brand and feel</h1>${b("wn", "Draft")}</div>
  ${dsSec({ id: "next", name: "Coming in the next round", note: "The feel, who it's for, how we sound and the logo rules go here once the Components page's entry layout is settled.", body: `<p class="dsp"><img src="${brand.logoOnLight}" alt="${brand.siteName}" style="height:34px;width:auto"></p>${fwdlink("Open Components", "components.html")}` })}`,
}];
