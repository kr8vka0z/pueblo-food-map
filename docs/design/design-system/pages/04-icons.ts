// Design system: the icon library. A placeholder this round: the Components page goes first so the owner can
// settle the entry layout. icons.ts still holds the Lucide shapes the Components page draws.
import { dsSec, fwdlink, type Page } from "../lib";

export const pages: Page[] = [{
  slug: "icons", route: "DESIGN.md → Icons", title: "Design system: Icon library", area: "Design system", nav: "Icons",
  blurb: "Coming in the next round: the icons the site uses, their sizes and what each one means.",
  changed: ["Nothing here yet. This page fills in after the Components entry layout is settled."],
  html: `<div class="head"><h1>Icon library</h1></div>
  ${dsSec({ id: "next", name: "Coming in the next round", note: "The icons the site uses (Lucide, plus the hand-drawn Boxes icon), their sizes and what each one means go here.", body: fwdlink("Open Components", "components.html") })}`,
}];
