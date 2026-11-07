// Design system: Patterns. A placeholder this round: the Components page goes first so the owner can settle the
// entry layout. The kit's starter patterns are in the design skill's mockup-kit/pages/05-patterns.ts.
import { dsSec, fwdlink, type Page } from "../lib";

export const pages: Page[] = [{
  slug: "patterns", route: "DESIGN.md → Patterns", title: "Design system: Patterns", area: "Design system", nav: "Patterns",
  blurb: "Coming in the next round: how the pieces combine for jobs that repeat, with their exact words.",
  changed: ["Nothing here yet. This page fills in after the Components entry layout is settled."],
  html: `<div class="head"><h1>Patterns</h1></div>
  ${dsSec({ id: "next", name: "Coming in the next round", note: "Jobs that repeat across the site (finding a place, getting directions, sending a report), each with its exact words, go here.", body: fwdlink("Open Components", "components.html") })}`,
}];
